import { auth } from "@clerk/nextjs/server";
import { db, listingToRow, rowToListing, ownsRow, OWNED_COLUMNS } from "@/lib/db";
import type { PropertyRow } from "@/lib/db";
import { hasPurchase, type EntitlementResult } from "@/lib/entitlements";
import { PAYWALL_ENABLED } from "@/lib/paywall";
import { checkRateLimit, ipKey, rateLimitedResponse } from "@/lib/rate-limit";
import { parseJsonBody } from "@/lib/request";
import { removeUnreferencedUploads } from "@/lib/storage";
import { safeImageUrl } from "@/lib/url";
import { validateListing } from "@/lib/validators";

/**
 * Public detail. The owner contact field is paywalled (#3): it is only
 * included for the lister themself or after a verified contact_owner
 * purchase (₹50) for this listing.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // session identity drives the `mine` flag and the owner-contact paid gate
  const { userId } = await auth();
  const { id } = await params;
  // explicit column list (never select("*")): keeps `owner` under the gate
  // below and derives `mine` from user_id without ever returning it raw.
  // The ledger check runs alongside the select; it is only consulted when
  // the caller turns out not to be the lister.
  const [{ data, error }, purchase] = await Promise.all([
    db
      .from("properties")
      .select(`${OWNED_COLUMNS}, owner`)
      .eq("id", id)
      .maybeSingle<PropertyRow>(),
    // paywall off: any signed-in viewer sees the owner contact
    userId && !PAYWALL_ENABLED
      ? Promise.resolve<EntitlementResult>({ ok: true, granted: true })
      : userId
      ? hasPurchase(userId, "contact_owner", id)
      : Promise.resolve<EntitlementResult>({ ok: true, granted: false }),
  ]);
  if (error) {
    console.error(`GET /api/properties/${id} failed:`, error.message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
  if (!data) return Response.json({ error: "not found" }, { status: 404 });

  let includeOwner = false;
  if (userId) {
    if (data.user_id === userId) {
      includeOwner = true;
    } else {
      // fail closed with a 500 rather than silently denying a paid user
      if (!purchase.ok) {
        return Response.json({ error: purchase.error }, { status: 500 });
      }
      includeOwner = purchase.granted;
    }
  }

  const listing = rowToListing(data);
  listing.mine = ownsRow(data, userId);
  // tells the panel whether there is anything to unlock, without leaking it
  listing.hasOwner = Boolean(data.owner);
  if (!includeOwner || !listing.owner) delete listing.owner;
  return Response.json(listing);
}

/**
 * Only the authenticated lister may edit. The update is scoped to
 * `user_id = session user`, so another user's listing (or a missing one) is a
 * 404 — no pre-select, no ownership oracle.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const l = await parseJsonBody(request, (v) => validateListing(v, safeImageUrl));
  if (l instanceof Response) return l;

  // The featured flag is never taken from the body: it is whatever the ledger
  // says, so an edit can neither self-feature nor accidentally drop a paid boost.
  const [allowed, boost] = await Promise.all([
    checkRateLimit(ipKey(request, "properties-write", userId), 30, 60_000),
    hasPurchase(userId, "featured_property", id),
  ]);
  if (!allowed) return rateLimitedResponse();
  if (!boost.ok) return Response.json({ error: boost.error }, { status: 500 });

  // photos dropped in this edit are cleaned up after the write
  const { data: previous } = await db
    .from("properties")
    .select("photos")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle<{ photos: string[] | null }>();

  const { data, error } = await db
    .from("properties")
    .update({ ...listingToRow(l), featured: boost.granted })
    .eq("id", id)
    .eq("user_id", userId)
    .select(OWNED_COLUMNS)
    .maybeSingle();
  if (error) {
    console.error(`PUT /api/properties/${id} failed:`, error.message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
  if (!data) return Response.json({ error: "not found" }, { status: 404 });
  const kept = new Set(listingToRow(l).photos ?? []);
  const dropped = (previous?.photos ?? []).filter((p) => !kept.has(p));
  if (dropped.length) await removeUnreferencedUploads(`PUT /api/properties/${id}`, dropped);
  // the user_id filter above proved the caller is the lister
  return Response.json({ ...rowToListing(data), owner: l.owner ?? undefined, mine: true });
}

/** Best-effort removal of a listing's uploaded photos. Never fails the request. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  // Grab the photo URLs first (scoped to the lister) so the objects can be
  // dropped after the row is; a missing row short-circuits to 404 below.
  const { data: existing, error: selectError } = await db
    .from("properties")
    .select("photos")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle<{ photos: string[] | null }>();
  if (selectError) {
    console.error(`DELETE /api/properties/${id} lookup failed:`, selectError.message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
  if (!existing) return Response.json({ error: "not found" }, { status: 404 });

  const { count, error } = await db
    .from("properties")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) {
    console.error(`DELETE /api/properties/${id} failed:`, error.message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
  if (!count) return Response.json({ error: "not found" }, { status: 404 });

  await removeUnreferencedUploads(`DELETE /api/properties/${id}`, existing.photos ?? []);
  return new Response(null, { status: 204 });
}
