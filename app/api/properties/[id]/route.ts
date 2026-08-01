import { auth } from "@clerk/nextjs/server";
import { db, listingToRow, rowToListing, PUBLIC_COLUMNS } from "@/lib/db";
import type { PropertyRow } from "@/lib/db";
import type { Listing } from "@/lib/types";
import { safeImageUrl } from "@/lib/url";
import { checkRateLimit, ipKey, rateLimitedResponse } from "@/lib/rate-limit";

/**
 * Public detail, but the owner contact field is paywalled (#3): it is only
 * included for the lister themself or after a verified contact_owner purchase
 * for this listing (same ledger pattern as the featured boost).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  const { id } = await params;
  const { data, error } = await db
    .from("properties")
    .select("*")
    .eq("id", id)
    .maybeSingle<PropertyRow>();
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
      const { count, error: purchaseError } = await db
        .from("purchases")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("purpose", "contact_owner")
        .eq("ref", id);
      if (purchaseError) {
        console.error(`contact purchase check failed for ${id}:`, purchaseError.message);
        return Response.json({ error: "internal error" }, { status: 500 });
      }
      includeOwner = Boolean(count);
    }
  }

  const listing = rowToListing(data);
  if (!includeOwner) delete listing.owner;
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

/**
 * The featured boost is a paid feature: only keep `featured: true` when a
 * verified featured_property purchase exists for this user + listing (the
 * client pays with ref = listing id). Anything else is forced to false, so a
 * lister can't flip it for free via the edit form.
 */
async function resolveFeatured(
  id: string,
  userId: string | null,
  requested: boolean | undefined,
): Promise<{ ok: boolean; response?: Response }> {
  if (!requested) return { ok: true };
  const { count, error } = await db
    .from("purchases")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId ?? "")
    .eq("purpose", "featured_property")
    .eq("ref", id);
  if (error) {
    console.error(`featured purchase check failed for ${id}:`, error.message);
    return {
      ok: false,
      response: Response.json({ error: "internal error" }, { status: 500 }),
    };
  }
  return { ok: Boolean(count) };
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const denied = await ownershipError(id);
  if (denied) return denied;

  const { userId } = await auth();
  if (!checkRateLimit(ipKey(request, "properties-write", userId), 30, 60_000)) {
    return rateLimitedResponse();
  }
  const l = (await request.json()) as Omit<Listing, "id">;
  if (
    (l.photo && !safeImageUrl(l.photo)) ||
    (l.photos && l.photos.some((p) => !safeImageUrl(p)))
  ) {
    return Response.json({ error: "invalid photo url" }, { status: 400 });
  }
  const featured = await resolveFeatured(id, userId, l.featured);
  if (!featured.ok) return featured.response!;

  const { data, error } = await db
    .from("properties")
    .update({ ...listingToRow(l), featured: Boolean(l.featured) })
    .eq("id", id)
    .select(PUBLIC_COLUMNS)
    .maybeSingle();
  if (error) {
    console.error(`PUT /api/properties/${id} failed:`, error.message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
  if (!data) return Response.json({ error: "not found" }, { status: 404 });
  // the lister may see their own owner field
  return Response.json({ ...rowToListing(data), owner: l.owner ?? undefined });
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
