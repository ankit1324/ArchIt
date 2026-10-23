import { auth } from "@clerk/nextjs/server";
import { db, listingToRow, rowToListing, OWNED_COLUMNS } from "@/lib/db";
import { parseBBox, parseCursor, parseLimit } from "@/lib/listing-query";
import { listProperties } from "@/lib/properties";
import { checkRateLimit, ipKey, rateLimitedResponse } from "@/lib/rate-limit";
import { parseJsonBody } from "@/lib/request";
import { safeImageUrl } from "@/lib/url";
import { validateListing } from "@/lib/validators";

// owner contact is paywalled (#3): the public list never includes it, and the
// raw lister user_id is dropped — each row carries a server-computed `mine`.
//
// ?bbox=w,s,e,n limits to a map viewport ("search as I move"); ?limit and
// ?cursor page through the set. The body stays a plain array for existing
// callers — the next page's cursor rides in the X-Next-Cursor header.
export async function GET(request: Request) {
  const { userId } = await auth();
  const params = new URL(request.url).searchParams;
  const bbox = parseBBox(params.get("bbox"));
  const limit = parseLimit(params.get("limit"));
  const cursor = parseCursor(params.get("cursor"));
  if (bbox === "invalid" || limit === "invalid" || cursor === "invalid") {
    return Response.json({ error: "invalid bbox, limit or cursor" }, { status: 400 });
  }
  try {
    const page = await listProperties({ userId, bbox, cursor, limit });
    return Response.json(page.listings, {
      headers: page.nextCursor ? { "X-Next-Cursor": page.nextCursor } : undefined,
    });
  } catch (error) {
    console.error("GET /api/properties failed:", (error as Error).message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  // lister recorded from the session, never from the client body
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!(await checkRateLimit(ipKey(request, "properties-write", userId), 30, 60_000))) {
    return rateLimitedResponse();
  }
  const l = await parseJsonBody(request, (v) => validateListing(v, safeImageUrl));
  if (l instanceof Response) return l;

  // featured is a paid boost (₹250 featured_property): never trusted from the
  // body. It starts false and is flipped server-side once a purchase with
  // ref = this listing's id is recorded (lib/purchases.ts applyEntitlement).
  const { data, error } = await db
    .from("properties")
    .insert({ ...listingToRow(l), user_id: userId, featured: false })
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
