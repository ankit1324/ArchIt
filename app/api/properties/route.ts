import { auth } from "@clerk/nextjs/server";
import {
  db,
  attachedDesigns,
  designAttachCheck,
  listingToRow,
  rowToListing,
  ownsRow,
  OWNED_COLUMNS,
} from "@/lib/db";
import type { PropertyRow } from "@/lib/db";
import { presentListing, validateListingWrite } from "@/lib/listing-presentation";
import type { Listing } from "@/lib/types";
import { safeImageUrl } from "@/lib/url";
import { checkRateLimit, ipKey, rateLimitedResponse } from "@/lib/rate-limit";

// owner contact is paywalled (#3): the public list never includes it, and the
// raw lister user_id is dropped — each row carries a server-computed `mine`.
// Attached designs are shown to visitors only while published (presentListing).
export async function GET() {
  const { userId } = await auth();
  const { data, error } = await db
    .from("properties")
    .select(OWNED_COLUMNS)
    .order("created_at")
    .overrideTypes<PropertyRow[], { merge: false }>();
  if (error) {
    console.error("GET /api/properties failed:", error.message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
  let designs;
  try {
    designs = await attachedDesigns(data.map((r) => r.design_id));
  } catch (e) {
    console.error("GET /api/properties design lookup failed:", e instanceof Error ? e.message : e);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
  return Response.json(
    data.map((r) => {
      const mine = ownsRow(r, userId);
      const design = r.design_id ? designs.get(r.design_id) : undefined;
      return presentListing({ ...rowToListing(r), mine }, r, design, mine);
    }),
  );
}

export async function POST(request: Request) {
  const l = (await request.json()) as Omit<Listing, "id">;
  // price is checked by validateListingWrite below (showcase listings store 0)
  if (!l.address || !l.coords) {
    return Response.json({ error: "address, coords required" }, { status: 400 });
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
  // a new listing has no stored design, so any designId must be the caller's
  // own published design
  let newDesign = null;
  if (typeof l.designId === "string") {
    try {
      newDesign = await designAttachCheck(l.designId, userId);
    } catch (e) {
      console.error("POST /api/properties design check failed:", e instanceof Error ? e.message : e);
      return Response.json({ error: "internal error" }, { status: 500 });
    }
  }
  const v = validateListingWrite(l, null, newDesign);
  if (!v.ok) return Response.json({ error: v.error }, { status: v.status });
  // [PAYWALL DISABLED — free for now] featuring is a free toggle, so the flag
  // is trusted from the client body on create. Original paid-boost behaviour
  // (force false, then flip via PUT only after a verified featured_property
  // purchase with ref = this listing's id) — restore to re-enable the paywall:
  // .insert({ ...listingToRow(l), user_id: userId, featured: false })
  const { data, error } = await db
    .from("properties")
    .insert({
      ...listingToRow({ ...l, price: v.price, defaultView: v.defaultView }),
      design_id: v.designId,
      user_id: userId,
      featured: l.featured === true,
    })
    .select(OWNED_COLUMNS)
    .single<PropertyRow>();
  if (error) {
    console.error("POST /api/properties failed:", error.message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
  // the lister just typed the owner field — echo it back so the UI keeps it
  // without a paid lookup; they own the row they just created
  // best-effort: the row is already written, so a failed lookup must not turn
  // the create into an error (the client would retry and duplicate it)
  const designs = await attachedDesigns([data.design_id]).catch((e) => {
    console.error("POST /api/properties design lookup failed:", e instanceof Error ? e.message : e);
    return new Map<string, { published: boolean; snapshot: string | null }>();
  });
  return Response.json(
    presentListing(
      { ...rowToListing(data), owner: l.owner ?? undefined, mine: true },
      data,
      data.design_id ? designs.get(data.design_id) : undefined,
      true,
    ),
    { status: 201 },
  );
}
