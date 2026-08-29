import { auth } from "@clerk/nextjs/server";
import { db, listingToRow, rowToListing, ownsRow, OWNED_COLUMNS } from "@/lib/db";
import type { Listing } from "@/lib/types";
import { safeImageUrl } from "@/lib/url";
import { checkRateLimit, ipKey, rateLimitedResponse } from "@/lib/rate-limit";

// owner contact is paywalled (#3): the public list never includes it, and the
// raw lister user_id is dropped — each row carries a server-computed `mine`.
export async function GET() {
  const { userId } = await auth();
  const { data, error } = await db
    .from("properties")
    .select(OWNED_COLUMNS)
    .order("created_at");
  if (error) {
    console.error("GET /api/properties failed:", error.message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
  return Response.json(
    data.map((r) => ({ ...rowToListing(r), mine: ownsRow(r, userId) })),
  );
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
  if (!(await checkRateLimit(ipKey(request, "properties-write", userId), 30, 60_000))) {
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
    .select(OWNED_COLUMNS)
    .single();
  if (error) {
    console.error("POST /api/properties failed:", error.message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
  // the lister just typed the owner field — echo it back so the UI keeps it
  // without a paid lookup; they own the row they just created
  return Response.json(
    { ...rowToListing(data), owner: l.owner ?? undefined, mine: true },
    { status: 201 },
  );
}
