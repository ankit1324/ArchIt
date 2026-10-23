import { auth } from "@clerk/nextjs/server";
import { db, listingToRow, listingForViewer, OWNED_COLUMNS } from "@/lib/db";
import { onlyVisible } from "@/lib/moderation";
import { checkRateLimit, ipKey, rateLimitedResponse } from "@/lib/rate-limit";
import { parseJsonBody } from "@/lib/request";
import { safeImageUrl } from "@/lib/url";
import { validateListing } from "@/lib/validators";

/** Hard cap on the public list; the map renders every row it gets. */
const LIST_LIMIT = 1000;

// owner contact is paywalled (#3): the public list never includes it, and the
// raw lister user_id is dropped — each row carries a server-computed `mine`.
// Moderation: only live listings, plus the viewer's own pending/rejected ones.
export async function GET() {
  const { userId } = await auth();
  const base = db.from("properties").select(OWNED_COLUMNS);
  const { data, error } = await onlyVisible<typeof base>(base, userId)
    .order("created_at")
    .limit(LIST_LIMIT);
  if (error) {
    console.error("GET /api/properties failed:", error.message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
  if (data.length === LIST_LIMIT) {
    console.warn(
      `GET /api/properties hit the ${LIST_LIMIT}-row cap — listings beyond it are not served; paginate`,
    );
  }
  return Response.json(data.map((r) => listingForViewer(r, userId)));
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
  // New listings wait in the admin queue (/admin) until approved.
  const { data, error } = await db
    .from("properties")
    .insert({ ...listingToRow(l), user_id: userId, featured: false, status: "pending" })
    .select(OWNED_COLUMNS)
    .single();
  if (error) {
    console.error("POST /api/properties failed:", error.message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
  // the lister just typed the owner field — echo it back so the UI keeps it
  // without a paid lookup; they own the row they just created
  return Response.json(
    { ...listingForViewer(data, userId), owner: l.owner ?? undefined },
    { status: 201 },
  );
}
