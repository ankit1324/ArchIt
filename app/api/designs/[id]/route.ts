import { auth } from "@clerk/nextjs/server";
import { db, designToRow, rowToDesign } from "@/lib/db";
import { builderUnlockError } from "@/lib/entitlements";
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
  const locked = await builderUnlockError(userId);
  if (locked) return locked;
  const { id } = await params;
  // designs carry the full block list; allow the 1 MB design cap plus envelope
  const d = await parseJsonBody(request, (v) => validateDesign(v, safeImageUrl), {
    maxBytes: MAX_DESIGN_BYTES + 64 * 1024,
  });
  if (d instanceof Response) return d;
  // Each save uploads a fresh snapshot; remember the old one so it can be
  // dropped once the row no longer points at it.
  const { data: previous } = await db
    .from("designs")
    .select("snapshot")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle<{ snapshot: string | null }>();
  const { data, error } = await db
    .from("designs")
    .update(designToRow(d))
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .maybeSingle();
  if (error) {
    console.error(`PUT /api/designs/${id} failed:`, error.message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
  if (!data) return Response.json({ error: "not found" }, { status: 404 });
  if (previous?.snapshot && previous.snapshot !== data.snapshot) {
    await removeUnreferencedUploads(`PUT /api/designs/${id}`, [previous.snapshot]);
  }
  return Response.json(rowToDesign(data));
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
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
