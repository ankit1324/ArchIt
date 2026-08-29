import { auth } from "@clerk/nextjs/server";
import { db, listingToRow, rowToListing, ownsRow, OWNED_COLUMNS } from "@/lib/db";
import type { PropertyRow } from "@/lib/db";
import type { Listing } from "@/lib/types";
import { safeImageUrl } from "@/lib/url";
import { checkRateLimit, ipKey, rateLimitedResponse } from "@/lib/rate-limit";

/**
 * Public detail. The owner contact field used to be paywalled (#3): it was
 * only included for the lister themself or after a verified contact_owner
 * purchase for this listing.
 *
 * [PAYWALL DISABLED — free for now] Everyone gets the owner contact.
 * Restore the purchase check below to re-enable the paywall (plus the
 * "Contact owner" button in components/PropertyDetailPanel.tsx).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // session identity drives the `mine` flag (and, when restored, the
  // owner-contact paid gate below)
  const { userId } = await auth();
  const { id } = await params;
  // explicit column list (never select("*")): keeps `owner` under the gate
  // below and derives `mine` from user_id without ever returning it raw
  const { data, error } = await db
    .from("properties")
    .select(`${OWNED_COLUMNS}, owner`)
    .eq("id", id)
    .maybeSingle<PropertyRow>();
  if (error) {
    console.error(`GET /api/properties/${id} failed:`, error.message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
  if (!data) return Response.json({ error: "not found" }, { status: 404 });

  // [PAYWALL DISABLED — free for now] owner contact is included for everyone
  // (was `let` while the paid gate below could reassign it)
  const includeOwner = true;
  // --- original paid gate (restore to re-enable the paywall) ---
  // if (userId) {
  //   if (data.user_id === userId) {
  //     includeOwner = true;
  //   } else {
  //     const { count, error: purchaseError } = await db
  //       .from("purchases")
  //       .select("*", { count: "exact", head: true })
  //       .eq("user_id", userId)
  //       .eq("purpose", "contact_owner")
  //       .eq("ref", id);
  //     if (purchaseError) {
  //       console.error(`contact purchase check failed for ${id}:`, purchaseError.message);
  //       return Response.json({ error: "internal error" }, { status: 500 });
  //     }
  //     includeOwner = Boolean(count);
  //   }
  // }

  const listing = rowToListing(data);
  listing.mine = ownsRow(data, userId);
  if (!includeOwner || !listing.owner) delete listing.owner;
  return Response.json(listing);
}

/**
 * Only the authenticated lister may edit or delete. Row existence returns 404
 * regardless. Returns null when allowed, or a Response error.
 */
async function ownershipError(id: string): Promise<Response | null> {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { data, error } = await db
    .from("properties")
    .select("user_id")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error(`ownership check failed for property ${id}:`, error.message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
  if (!data) return Response.json({ error: "not found" }, { status: 404 });
  if (data.user_id !== userId) {
    return Response.json(
      { error: "only the lister can change this property" },
      { status: 403 },
    );
  }
  return null;
}

/*
 * [PAYWALL DISABLED — free for now] Unused while featuring is free (PUT reads
 * the flag from the request body). Restore this ledger lookup together with
 * the paywall in app/find/page.tsx and lib/purchases.ts applyEntitlement.
 *
 * async function resolveFeatured(
 *   id: string,
 *   userId: string,
 * ): Promise<{ ok: true; featured: boolean } | { ok: false; response: Response }> {
 *   const { count, error } = await db
 *     .from("purchases")
 *     .select("*", { count: "exact", head: true })
 *     .eq("user_id", userId)
 *     .eq("purpose", "featured_property")
 *     .eq("ref", id);
 *   if (error) {
 *     console.error(`featured purchase check failed for ${id}:`, error.message);
 *     return {
 *       ok: false,
 *       response: Response.json({ error: "internal error" }, { status: 500 }),
 *     };
 *   }
 *   return { ok: true, featured: Boolean(count) };
 * }
 */

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const denied = await ownershipError(id);
  if (denied) return denied;

  const { userId } = await auth();
  if (!(await checkRateLimit(ipKey(request, "properties-write", userId), 30, 60_000))) {
    return rateLimitedResponse();
  }
  const l = (await request.json()) as Omit<Listing, "id">;
  if (
    (l.photo && !safeImageUrl(l.photo)) ||
    (l.photos && l.photos.some((p) => !safeImageUrl(p)))
  ) {
    return Response.json({ error: "invalid photo url" }, { status: 400 });
  }
  // ownershipError() above already proved userId is the lister
  // [PAYWALL DISABLED — free for now] the featured flag comes straight from the
  // request body; restore the resolveFeatured() ledger lookup to re-gate it
  const featured = l.featured === true;

  const { data, error } = await db
    .from("properties")
    .update({ ...listingToRow(l), featured })
    .eq("id", id)
    .select(OWNED_COLUMNS)
    .maybeSingle();
  if (error) {
    console.error(`PUT /api/properties/${id} failed:`, error.message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
  if (!data) return Response.json({ error: "not found" }, { status: 404 });
  // ownershipError() above already proved the caller is the lister
  return Response.json({ ...rowToListing(data), owner: l.owner ?? undefined, mine: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const denied = await ownershipError(id);
  if (denied) return denied;

  const { count, error } = await db
    .from("properties")
    .delete({ count: "exact" })
    .eq("id", id);
  if (error) {
    console.error(`DELETE /api/properties/${id} failed:`, error.message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
  if (!count) return Response.json({ error: "not found" }, { status: 404 });
  return new Response(null, { status: 204 });
}
