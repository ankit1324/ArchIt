import { auth } from "@clerk/nextjs/server";
import { db, listingToRow, rowToListing, PUBLIC_COLUMNS } from "@/lib/db";
import type { Listing } from "@/lib/types";
import { safeImageUrl } from "@/lib/url";
import { checkRateLimit, ipKey, rateLimitedResponse } from "@/lib/rate-limit";

// owner contact is paywalled (#3): the public list never includes it
export async function GET() {
  const { data, error } = await db
    .from("properties")
    .select(PUBLIC_COLUMNS)
    .order("created_at");
  if (error) {
    console.error("GET /api/properties failed:", error.message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
  return Response.json(data.map(rowToListing));
}

export async function POST(request: Request) {
  const l = (await request.json()) as Omit<Listing, "id">;
  if (!l.address || !l.price || !l.coords) {
    return Response.json({ error: "address, price, coords required" }, { status: 400 });
  }
  if (
    (l.photo && !safeImageUrl(l.photo)) ||
    (l.photos && l.photos.some((p) => !safeImageUrl(p)))
  ) {
    return Response.json({ error: "invalid photo url" }, { status: 400 });
  }
  // lister recorded from the session, never from the client body
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!checkRateLimit(ipKey(request, "properties-write", userId), 30, 60_000)) {
    return rateLimitedResponse();
  }
  // [PAYWALL DISABLED — free for now] featuring is a free toggle, so the flag
  // is trusted from the client body on create. Original paid-boost behaviour
  // (force false, then flip via PUT only after a verified featured_property
  // purchase with ref = this listing's id) — restore to re-enable the paywall:
  // .insert({ ...listingToRow(l), user_id: userId, featured: false })
  const { data, error } = await db
    .from("properties")
    .insert({ ...listingToRow(l), user_id: userId, featured: l.featured === true })
    .select(PUBLIC_COLUMNS)
    .single();
  if (error) {
    console.error("POST /api/properties failed:", error.message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
  // the lister just typed the owner field — echo it back so the UI keeps it
  // without a paid lookup
  return Response.json(
    { ...rowToListing(data), owner: l.owner ?? undefined },
    { status: 201 },
  );
}
