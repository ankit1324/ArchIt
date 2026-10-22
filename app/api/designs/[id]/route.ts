import { auth } from "@clerk/nextjs/server";
import { db, designToRow, rowToDesign } from "@/lib/db";
import { builderUnlockError } from "@/lib/entitlements";
import { parseJsonBody } from "@/lib/request";
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
  const { count, error } = await db
    .from("designs")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) {
    console.error(`DELETE /api/designs/${id} failed:`, error.message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
  if (!count) return Response.json({ error: "not found" }, { status: 404 });
  return new Response(null, { status: 204 });
}
