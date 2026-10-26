import { requireAdmin } from "@/lib/admin";
import { logAdminAction } from "@/lib/admin-audit";
import { db, listingToRow, type PropertyRow } from "@/lib/db";
import { validateListingDecision } from "@/lib/moderation";
import { afterResponse, notifyListingDecision } from "@/lib/notify";
import { parseJsonBody } from "@/lib/request";
import { removeUnreferencedUploads } from "@/lib/storage";
import { safeImageUrl } from "@/lib/url";
import { validateListing } from "@/lib/validators";

/**
 * Approve or reject a listing from the /admin queue. Either decision can be
 * reversed later (approve a rejected listing, reject a live one). The lister
 * is emailed after the response.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminId = await requireAdmin();
  if (adminId instanceof Response) return adminId;
  const { id } = await params;
  const decision = await parseJsonBody(request, validateListingDecision);
  if (decision instanceof Response) return decision;

  const approved = decision.action === "approve";
  const target = approved ? "live" : "rejected";
  const { data, error } = await db
    .from("properties")
    .update({
      status: target,
      reviewed_at: new Date().toISOString(),
      reviewed_by: adminId,
      review_note: decision.note,
    })
    .eq("id", id)
    // Only an actual change: a double-submit or a stale tab must not re-email
    // the lister or add a second audit entry.
    .neq("status", target)
    .select("id, building_name, address, user_id, status")
    .maybeSingle<{
      id: string;
      building_name: string | null;
      address: string;
      user_id: string | null;
      status: string;
    }>();
  if (error) {
    console.error(`POST /api/admin/listings/${id} failed:`, error.message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
  if (!data) {
    // Nothing updated: either no such listing, or it's already in that state.
    const { data: existing, error: lookupError } = await db
      .from("properties")
      .select("id, status")
      .eq("id", id)
      .maybeSingle<{ id: string; status: string }>();
    if (lookupError) {
      console.error(`POST /api/admin/listings/${id} lookup failed:`, lookupError.message);
      return Response.json({ error: "internal error" }, { status: 500 });
    }
    if (!existing) return Response.json({ error: "not found" }, { status: 404 });
    // Idempotent: the page refreshes and shows the current state.
    return Response.json({ id: existing.id, status: existing.status, unchanged: true });
  }

  await logAdminAction({
    adminId,
    action: decision.action,
    targetType: "listing",
    targetId: data.id,
    note: decision.note,
  });
  afterResponse(() =>
    notifyListingDecision({
      listerId: data.user_id,
      listingName: data.building_name || data.address,
      approved,
      note: decision.note,
    }),
  );
  return Response.json({ id: data.id, status: data.status });
}

/**
 * Edit any listing's details as an admin. Same validation as the lister's own
 * edit, but status, owner (user_id) and the paid `featured` flag are left
 * exactly as they are, and the edit does not send the listing back to review.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminId = await requireAdmin();
  if (adminId instanceof Response) return adminId;
  const { id } = await params;
  const l = await parseJsonBody(request, (v) => validateListing(v, safeImageUrl));
  if (l instanceof Response) return l;

  const { data: previous, error: lookupError } = await db
    .from("properties")
    .select("*")
    .eq("id", id)
    .maybeSingle<PropertyRow>();
  if (lookupError) {
    // a DB error is not a missing listing
    console.error(`PATCH /api/admin/listings/${id} lookup failed:`, lookupError.message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
  if (!previous) return Response.json({ error: "not found" }, { status: 404 });

  // featured comes from the ledger, never from an edit
  const { featured: _featured, ...next } = listingToRow(l);
  void _featured;
  // what the edit actually changed, for the audit log
  const changed = (Object.keys(next) as (keyof typeof next)[]).filter(
    (k) => JSON.stringify(next[k] ?? null) !== JSON.stringify(previous[k] ?? null),
  );
  if (!changed.length) return Response.json({ id, unchanged: true });
  const { data, error } = await db
    .from("properties")
    .update(next)
    .eq("id", id)
    .select("id")
    .maybeSingle<{ id: string }>();
  if (error) {
    console.error(`PATCH /api/admin/listings/${id} failed:`, error.message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
  if (!data) return Response.json({ error: "not found" }, { status: 404 });

  const kept = new Set([...(next.photos ?? []), ...(next.photo ? [next.photo] : [])]);
  // legacy rows keep their only photo in `photo` with photos null
  const before = new Set([...(previous.photos ?? []), ...(previous.photo ? [previous.photo] : [])]);
  const dropped = [...before].filter((p) => !kept.has(p));
  if (dropped.length) await removeUnreferencedUploads(`PATCH /api/admin/listings/${id}`, dropped);
  await logAdminAction({
    adminId,
    action: "edit",
    targetType: "listing",
    targetId: id,
    details: { name: next.building_name || next.address, changed },
  });
  return Response.json({ id });
}

/** Permanently delete a listing (and its now-unreferenced photos). */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminId = await requireAdmin();
  if (adminId instanceof Response) return adminId;
  const { id } = await params;
  const note = new URL(request.url).searchParams.get("note")?.trim().slice(0, 500) || null;

  const { data, error } = await db
    .from("properties")
    .delete()
    .eq("id", id)
    .select("id, building_name, address, user_id, photo, photos")
    .maybeSingle<Pick<PropertyRow, "id" | "building_name" | "address" | "user_id" | "photo" | "photos">>();
  if (error) {
    console.error(`DELETE /api/admin/listings/${id} failed:`, error.message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
  if (!data) return Response.json({ error: "not found" }, { status: 404 });

  // legacy rows keep their only photo in `photo` with photos null
  await removeUnreferencedUploads(`DELETE /api/admin/listings/${id}`, [
    ...(data.photos ?? []),
    ...(data.photo ? [data.photo] : []),
  ]);
  await logAdminAction({
    adminId,
    action: "delete",
    targetType: "listing",
    targetId: id,
    note,
    // the row is gone; keep enough to know what it was
    details: { name: data.building_name || data.address, lister: data.user_id },
  });
  return new Response(null, { status: 204 });
}
