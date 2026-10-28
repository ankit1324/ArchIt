import { auth } from "@clerk/nextjs/server";
import { db, designAttachCheck, listingToRow, OWNED_COLUMNS } from "@/lib/db";
import type { PropertyRow } from "@/lib/db";
import { validateListingWrite } from "@/lib/listing-presentation";
import { presentListings } from "@/lib/properties";
import { isAdmin } from "@/lib/admin";
import { canViewListing, changesReviewedContent, statusAfterEdit } from "@/lib/moderation";
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
 * purchase (₹50) for this listing. A listing that isn't live (pending review
 * or rejected) is a 404 for everyone but its lister and admins.
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
  // the Clerk admin lookup only runs for a non-live listing seen by a non-lister
  const admin = !canViewListing(data, userId) && (await isAdmin(userId));
  if (!canViewListing(data, userId, admin)) {
    return Response.json({ error: "not found" }, { status: 404 });
  }

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

  // attached design: visitors see it only while it is published
  const [listing] = await presentListings([data], userId, `GET /api/properties/${id}`);
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

  // photos dropped in this edit are cleaned up after the write; the reviewed
  // fields decide whether the edit sends the listing back into review.
  // design_id / default_view are read too: an edit that omits them keeps them.
  const { data: previous, error: previousError } = await db
    .from("properties")
    .select("photo, photos, status, building_name, owner, address, city, design_id, default_view")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle<
      Pick<
        PropertyRow,
        | "photo"
        | "photos"
        | "building_name"
        | "owner"
        | "address"
        | "city"
        | "design_id"
        | "default_view"
      > & {
        status: string | null;
      }
    >();
  // A failed read is not "no row": treating it as one would detach the design,
  // reset default_view and re-queue review on a transient DB error.
  if (previousError) {
    console.error(`PUT /api/properties/${id} previous-row read failed:`, previousError.message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
  // no row for this lister: the scoped update below answers 404
  const storedDesignId = previous?.design_id ?? null;

  // designId: absent = keep the stored one, null = detach, the stored id =
  // keep (even if since unpublished), anything else must be the caller's own
  // published design
  let newDesign: Awaited<ReturnType<typeof designAttachCheck>> = null;
  if (typeof l.designId === "string" && l.designId !== storedDesignId) {
    try {
      newDesign = await designAttachCheck(l.designId, userId);
    } catch (e) {
      console.error(`PUT /api/properties/${id} design check failed:`, e instanceof Error ? e.message : e);
      return Response.json({ error: "internal error" }, { status: 500 });
    }
  }
  const v = validateListingWrite(l, storedDesignId, newDesign, previous?.default_view ?? null);
  if (!v.ok) return Response.json({ error: v.error }, { status: v.status });

  const next = listingToRow({ ...l, price: v.price });
  // a newly attached design is new content on a reviewed listing, like a photo
  const reviewedChange =
    !previous || changesReviewedContent(previous, next) || v.designId !== storedDesignId;
  const { data, error } = await db
    .from("properties")
    .update({
      ...next,
      design_id: v.designId,
      default_view: v.defaultView,
      featured: boost.granted,
      status: statusAfterEdit(previous?.status, reviewedChange),
    })
    .eq("id", id)
    .eq("user_id", userId)
    .select(OWNED_COLUMNS)
    .maybeSingle<PropertyRow>();
  if (error) {
    console.error(`PUT /api/properties/${id} failed:`, error.message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
  if (!data) return Response.json({ error: "not found" }, { status: 404 });
  const kept = new Set(next.photos ?? []);
  const dropped = (previous?.photos ?? []).filter((p) => !kept.has(p));
  if (dropped.length) await removeUnreferencedUploads(`PUT /api/properties/${id}`, dropped);
  // the user_id filter above proved the caller is the lister
  const [listing] = await presentListings([data], userId, `PUT /api/properties/${id}`);
  return Response.json({ ...listing, owner: l.owner ?? undefined });
}

/** Best-effort removal of a listing's uploaded photos. Never fails the request. */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  // same write budget as POST/PUT: each delete fans out into storage
  // reference checks per photo, so it must not be an unmetered loop
  if (!(await checkRateLimit(ipKey(request, "properties-write", userId), 30, 60_000))) {
    return rateLimitedResponse();
  }
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
