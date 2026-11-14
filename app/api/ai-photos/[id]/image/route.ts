import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/admin";
import { AI_PHOTOS_BUCKET, isRequestId, mimeForPath, type AiPhotoRow } from "@/lib/ai-photos";
import { db } from "@/lib/db";

/**
 * A picture of an AI photo request, streamed from the private bucket to the
 * person who asked for it (or an admin). Same-origin on purpose: the builder
 * iframe's CSP allows images from 'self' only.
 *
 *   ?which=input   the builder's picture that was sent (default: the result)
 *   ?download=1    save it instead of showing it
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  // one answer for "no such request" and "not yours": ids are not an oracle
  const notFound = () => Response.json({ error: "not found" }, { status: 404 });
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!isRequestId(id)) return notFound();

  const { data: row, error } = await db
    .from("ai_photo_requests")
    .select("user_id, input_path, result_path, status")
    .eq("id", id)
    .maybeSingle<Pick<AiPhotoRow, "user_id" | "input_path" | "result_path" | "status">>();
  if (error) {
    console.error(`GET /api/ai-photos/${id}/image failed:`, error.message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
  if (!row || (row.user_id !== userId && !(await isAdmin(userId)))) return notFound();

  const url = new URL(request.url);
  const path = url.searchParams.get("which") === "input" ? row.input_path : row.result_path;
  if (!path) return notFound();

  const file = await db.storage.from(AI_PHOTOS_BUCKET).download(path);
  if (file.error || !file.data) {
    console.error(`GET /api/ai-photos/${id}/image download failed:`, file.error?.message);
    return notFound();
  }
  const headers: Record<string, string> = {
    "content-type": mimeForPath(path),
    // private to this account, and revalidated every time: an admin can replace
    // the photo behind this same URL, and the new one must show at once
    "cache-control": "private, no-cache",
    "x-content-type-options": "nosniff",
  };
  if (url.searchParams.get("download")) {
    headers["content-disposition"] = `attachment; filename="archit-ai-photo.${path.slice(path.lastIndexOf(".") + 1)}"`;
  }
  return new Response(file.data, { headers });
}
