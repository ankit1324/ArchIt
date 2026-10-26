import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { validateReport } from "@/lib/moderation";
import { checkRateLimit, ipKey, rateLimitedResponse } from "@/lib/rate-limit";
import { parseJsonBody } from "@/lib/request";

/** Small bodies only: a reason and at most 1000 characters of details. */
const MAX_REPORT_BYTES = 8 * 1024;

/**
 * "Report listing" from the detail panel. Signed-in users only, rate-limited,
 * one report per (listing, reporter). Reports land in listing_reports for the
 * /admin queue; nothing about the listing changes until an admin acts.
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!(await checkRateLimit(ipKey(request, "reports", userId), 10, 60 * 60_000))) {
    return rateLimitedResponse();
  }
  // Per network too: the per-user cap alone lets one person flood the admin
  // queue (or mass-flag a competitor) by cycling throwaway accounts.
  if (!(await checkRateLimit(ipKey(request, "reports-ip"), 30, 60 * 60_000))) {
    return rateLimitedResponse();
  }
  const input = await parseJsonBody(request, validateReport, { maxBytes: MAX_REPORT_BYTES });
  if (input instanceof Response) return input;

  // Only listings the reporter can actually see are reportable: live ones.
  // (A lister reporting their own listing is pointless; refuse it too.)
  const { data: listing, error: lookupError } = await db
    .from("properties")
    .select("id, user_id, status")
    .eq("id", input.propertyId)
    .maybeSingle<{ id: string; user_id: string | null; status: string }>();
  if (lookupError) {
    console.error("POST /api/reports lookup failed:", lookupError.message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
  if (!listing || listing.status !== "live") {
    return Response.json({ error: "not found" }, { status: 404 });
  }
  if (listing.user_id === userId) {
    return Response.json({ error: "you cannot report your own listing" }, { status: 400 });
  }

  const { error } = await db.from("listing_reports").insert({
    property_id: input.propertyId,
    reporter_id: userId,
    reason: input.reason,
    details: input.details,
  });
  if (error?.code === "23505") {
    return Response.json({ error: "you have already reported this listing" }, { status: 409 });
  }
  if (error) {
    console.error("POST /api/reports failed:", error.message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
  return Response.json({ ok: true }, { status: 201 });
}
