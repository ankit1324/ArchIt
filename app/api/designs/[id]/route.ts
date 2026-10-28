import { auth } from "@clerk/nextjs/server";
import { db, designUpdateRow, rowToDesign } from "@/lib/db";
import { builderUnlockError } from "@/lib/entitlements";
import { designEditNeedsReview } from "@/lib/moderation";
import { checkRateLimit, ipKey, rateLimitedResponse } from "@/lib/rate-limit";
import { parseJsonBody } from "@/lib/request";
import { removeUnreferencedUploads } from "@/lib/storage";
import { safeImageUrl } from "@/lib/url";
import { MAX_DESIGN_BYTES, validateDesign } from "@/lib/validators";

// Updates/deletes are owner-only — the user_id filter makes other users' ids a 404.
// Like the collection route, these require the paid builder_unlock.

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  // shared bucket across POST/PUT/DELETE: each write uploads up to ~1 MB
  if (!(await checkRateLimit(ipKey(request, "designs-write", userId), 30, 60_000))) {
    return rateLimitedResponse();
  }
  const locked = await builderUnlockError(userId);
  if (locked) return locked;
  const { id } = await params;
  // designs carry the full block list; allow the 1 MB design cap plus envelope
  const d = await parseJsonBody(request, (v) => validateDesign(v, safeImageUrl), {
    maxBytes: MAX_DESIGN_BYTES + 64 * 1024,
  });
  if (d instanceof Response) return d;
  // Each save uploads a fresh snapshot; remember the old one so it can be
  // dropped once the row no longer points at it. name/design are read too:
  // a change to what visitors see re-queues listings that attach this design.
  const { data: previous } = await db
    .from("designs")
    .select("snapshot, name, design")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle<{ snapshot: string | null; name: string; design: unknown }>();
  const { data, error } = await db
    .from("designs")
    // designUpdateRow drops plot_lng/plot_lat: a published design's map pin
    // moves only via the publish route (the designer sends [0, 0] for
    // standalone designs). Editing a published design keeps it published.
    .update(designUpdateRow(d))
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .maybeSingle();
  if (error) {
    console.error(`PUT /api/designs/${id} failed:`, error.message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
  if (!data) return Response.json({ error: "not found" }, { status: 404 });
  // An approved listing showing this design must not change under the
  // reviewer: like a listing's own photo edit (statusAfterEdit), a new
  // snapshot/geometry/name sends the owner's live listings that attach it
  // back to review. Best effort: the design is already saved.
  if (designEditNeedsReview(previous, data)) {
    const { error: requeueError } = await db
      .from("properties")
      .update({ status: "pending" })
      .eq("user_id", userId)
      .eq("design_id", id)
      .eq("status", "live");
    if (requeueError) {
      console.error(`PUT /api/designs/${id}: listing re-review failed:`, requeueError.message);
    }
  }
  if (previous?.snapshot && previous.snapshot !== data.snapshot) {
    await removeUnreferencedUploads(`PUT /api/designs/${id}`, [previous.snapshot]);
  }
  return Response.json(rowToDesign(data));
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  // shared bucket across POST/PUT/DELETE: each write uploads up to ~1 MB
  if (!(await checkRateLimit(ipKey(request, "designs-write", userId), 30, 60_000))) {
    return rateLimitedResponse();
  }
  const locked = await builderUnlockError(userId);
  if (locked) return locked;
  const { id } = await params;
  const { data: deleted, error } = await db
    .from("designs")
    .delete()
    .eq("id", id)
    .eq("user_id", userId)
    .select("snapshot");
  if (error) {
    console.error(`DELETE /api/designs/${id} failed:`, error.message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
  if (!deleted?.length) return Response.json({ error: "not found" }, { status: 404 });
  await removeUnreferencedUploads(
    `DELETE /api/designs/${id}`,
    deleted.map((r) => r.snapshot),
  );
  return new Response(null, { status: 204 });
}
