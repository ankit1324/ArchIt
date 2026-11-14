import crypto from "node:crypto";
import { requireAdmin } from "@/lib/admin";
import {
  AI_PHOTOS_BUCKET,
  cleanNote,
  extForMime,
  isRequestId,
  MAX_RESULT_BYTES,
  mimeForPath,
  sniffImage,
  type AiPhotoRow,
} from "@/lib/ai-photos";
import { AiRenderError, renderImage } from "@/lib/ai-render/gemini";
import { db } from "@/lib/db";
import { sanitizeImage } from "@/lib/image-sanitize";
import { afterResponse, notifyAiPhotoDecision } from "@/lib/notify";
import { readBodyCapped } from "@/lib/request";

/**
 * Finish an AI photo request.
 *
 *   multipart, field `file`          attach the photo the admin made by hand
 *   JSON { action: "generate" }      make it with the image model (needs
 *                                    GEMINI_API_KEY on a billed Google project)
 *   JSON { action: "reject", note }  turn it down; the note is shown to the user
 *
 * Attaching again replaces the result, so a poor photo can be redone.
 */

// "generate" waits on the image model, which usually answers in 10-30 s
export const maxDuration = 60;
const MODEL_TIMEOUT_MS = 50_000;

const fail = (status: number, error: string) => Response.json({ error }, { status });

/** What the admin sees for each way the model can fail. */
const MODEL_ERRORS: Record<AiRenderError["kind"], string> = {
  blocked: "The model declined this picture. Make it by hand and upload it.",
  no_image: "The model answered without a picture. Try again, or upload one.",
  busy: "The model is rate-limited. Try again in a minute.",
  config: "The API key cannot make images: its Google project needs billing (or the key or model id is wrong). Upload a photo made by hand instead.",
  timeout: "The model took too long. Try again.",
  upstream: "The model failed. Try again, or upload one.",
};

async function attach(row: Pick<AiPhotoRow, "id" | "status" | "user_id" | "design_name" | "result_path">, image: Buffer, mime: string, adminId: string) {
  const path = `out/${row.id}-${crypto.randomUUID()}.${extForMime(mime)}`;
  const upload = await db.storage.from(AI_PHOTOS_BUCKET).upload(path, image, { contentType: mime, upsert: false });
  if (upload.error) {
    console.error(`ai-photos ${row.id}: result upload failed:`, upload.error.message);
    return fail(500, "Could not store the photo. Try again.");
  }
  // Only if nobody changed the request since we read it: two admins (or Upload
  // and Generate) finishing the same request at once must not both "win", leave
  // an unreferenced photo behind, and send the user two "ready" emails.
  let update = db
    .from("ai_photo_requests")
    .update({ status: "done", result_path: path, admin_note: null, completed_at: new Date().toISOString(), completed_by: adminId })
    .eq("id", row.id)
    .eq("status", row.status);
  update = row.result_path ? update.eq("result_path", row.result_path) : update.is("result_path", null);
  const { data: updated, error } = await update.select("id");
  if (error || !updated?.length) {
    if (error) console.error(`ai-photos ${row.id}: marking done failed:`, error.message);
    await db.storage.from(AI_PHOTOS_BUCKET).remove([path]);
    return error
      ? fail(500, "Could not save the result. Try again.")
      : fail(409, "Someone else just changed this request. Reload the page.");
  }
  // a replaced result is no longer referenced by anything
  if (row.result_path) await db.storage.from(AI_PHOTOS_BUCKET).remove([row.result_path]);
  // `row` was read before this update: only the first completion tells the
  // user, so uploading a better photo later does not send a second "ready"
  if (row.status !== "done") {
    afterResponse(() => notifyAiPhotoDecision({ userId: row.user_id, designName: row.design_name, done: true }));
  }
  return Response.json({ id: row.id, status: "done" });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminId = await requireAdmin();
  if (adminId instanceof Response) return adminId;
  const { id } = await params;
  if (!isRequestId(id)) return fail(404, "not found");

  const { data: row, error } = await db
    .from("ai_photo_requests")
    .select("id, status, user_id, design_name, prompt, input_path, result_path")
    .eq("id", id)
    .maybeSingle<Pick<AiPhotoRow, "id" | "status" | "user_id" | "design_name" | "prompt" | "input_path" | "result_path">>();
  if (error) {
    console.error(`POST /api/admin/ai-photos/${id} failed:`, error.message);
    return fail(500, "internal error");
  }
  if (!row) return fail(404, "not found");

  /* ---- a photo made by hand ---- */
  if ((request.headers.get("content-type") ?? "").startsWith("multipart/form-data")) {
    const raw = await readBodyCapped(request, MAX_RESULT_BYTES + 64 * 1024);
    if (!raw) return fail(413, "The photo is larger than 4 MB. Save it as JPEG or WebP, or make it smaller.");
    let form: FormData;
    try {
      form = await new Response(raw as BodyInit, {
        headers: { "content-type": request.headers.get("content-type") ?? "" },
      }).formData();
    } catch {
      return fail(400, "Choose a photo to upload.");
    }
    const file = form.get("file");
    if (!(file instanceof File) || !file.size) return fail(400, "Choose a photo to upload.");
    if (file.size > MAX_RESULT_BYTES) return fail(413, "The photo is larger than 4 MB. Save it as JPEG or WebP, or make it smaller.");
    const buf = Buffer.from(await file.arrayBuffer());
    // trust the bytes, not the file name or the browser's label
    const mime = sniffImage(buf);
    if (!mime) return fail(415, "Upload a JPEG, PNG or WebP image.");
    let clean: Buffer;
    try {
      clean = await sanitizeImage(buf, mime); // re-encode: drops metadata and anything that is not pixels
    } catch {
      return fail(415, "That file is not a readable image.");
    }
    return attach(row, clean, mime, adminId);
  }

  let body: { action?: unknown; note?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return fail(400, "invalid request");
  }

  /* ---- turn it down ---- */
  if (body.action === "reject") {
    if (row.status !== "pending") return fail(409, "Only a waiting request can be rejected.");
    const note = cleanNote(body.note) || null;
    const { data: rejected, error: upErr } = await db
      .from("ai_photo_requests")
      .update({ status: "rejected", admin_note: note, completed_at: new Date().toISOString(), completed_by: adminId })
      .eq("id", id)
      .eq("status", "pending")
      .select("id");
    if (upErr) {
      console.error(`ai-photos ${id}: reject failed:`, upErr.message);
      return fail(500, "internal error");
    }
    // only when this call made the change: a double click must not email twice
    if (rejected?.length) {
      afterResponse(() => notifyAiPhotoDecision({ userId: row.user_id, designName: row.design_name, done: false, note }));
    }
    return Response.json({ id, status: "rejected" });
  }

  /* ---- make it with the image model ---- */
  if (body.action === "generate") {
    const apiKey = process.env.GEMINI_API_KEY || "";
    if (!apiKey) return fail(503, "No GEMINI_API_KEY is set. Make the photo by hand and upload it.");
    const input = await db.storage.from(AI_PHOTOS_BUCKET).download(row.input_path);
    if (input.error || !input.data) {
      console.error(`ai-photos ${id}: input download failed:`, input.error?.message);
      return fail(500, "Could not read the picture for this request.");
    }
    try {
      const out = await renderImage(
        {
          imageBase64: Buffer.from(await input.data.arrayBuffer()).toString("base64"),
          mime: mimeForPath(row.input_path),
          prompt: row.prompt,
        },
        {
          fetch,
          apiKey,
          model: process.env.AI_RENDER_MODEL || "gemini-nano-banana-2.1",
          baseUrl: process.env.AI_RENDER_API_BASE || "https://generativelanguage.googleapis.com/v1",
          timeoutMs: MODEL_TIMEOUT_MS,
        },
      );
      const buf = Buffer.from(out.base64, "base64");
      const mime = sniffImage(buf);
      if (!mime) return fail(502, "The model sent something that is not an image. Try again.");
      return attach(row, buf, mime, adminId);
    } catch (err) {
      if (err instanceof AiRenderError) {
        console.error(`ai-photos ${id}: model ${err.kind}: ${err.message}${err.detail ? ` | ${err.detail}` : ""}`);
        return fail(err.kind === "config" ? 503 : 502, MODEL_ERRORS[err.kind]);
      }
      console.error(`ai-photos ${id}: generate failed:`, err);
      return fail(500, "internal error");
    }
  }

  return fail(400, "unknown action");
}
