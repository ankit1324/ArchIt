import crypto from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import {
  AI_PHOTOS_BUCKET,
  cleanDesignName,
  extForMime,
  MAX_PENDING_REQUESTS,
  MAX_REQUESTS_PER_DAY,
  toAiPhotoItem,
  type AiPhotoRow,
} from "@/lib/ai-photos";
import { buildRenderPrompt } from "@/lib/ai-render/prompt";
import { MAX_IMAGE_BYTES, parseRenderRequest } from "@/lib/ai-render/request";
import { db } from "@/lib/db";
import { afterResponse, notifyAiPhotoRequested } from "@/lib/notify";
import { sanitizeImage } from "@/lib/image-sanitize";
import { readBodyCapped } from "@/lib/request";

/**
 * AI photo requests. Nothing is generated here: a request stores the builder's
 * picture and the written brief for an admin, who makes the photograph and
 * attaches it (see app/api/admin/ai-photos). The requester polls GET for it.
 *
 * GET  -> { items }              my requests, newest first
 * POST -> { id, status } (201)   ask for a photo of this view
 */

const DAY_MS = 24 * 60 * 60_000;
// base64 inflates the picture by a third; the rest of the body is a few hundred bytes
const MAX_BODY_BYTES = Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 16 * 1024;
const LIST_COLUMNS = "id, status, design_name, created_at, completed_at, admin_note, result_path";

const fail = (status: number, error: string, message: string) =>
  Response.json({ error, message }, { status, headers: { "cache-control": "no-store" } });

export async function GET() {
  const { userId } = await auth();
  if (!userId) return fail(401, "unauthorized", "Sign in to see your AI photos.");
  const { data, error } = await db
    .from("ai_photo_requests")
    .select(LIST_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20)
    .returns<Pick<AiPhotoRow, "id" | "status" | "design_name" | "created_at" | "completed_at" | "admin_note" | "result_path">[]>();
  if (error) {
    console.error("GET /api/ai-photos failed:", error.message);
    return fail(500, "internal", "Could not load your AI photos.");
  }
  return Response.json({ items: (data ?? []).map(toAiPhotoItem) }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return fail(401, "unauthorized", "Sign in to request an AI photo.");

  const raw = await readBodyCapped(request, MAX_BODY_BYTES);
  if (!raw) return fail(413, "too_large", "That picture is too large.");
  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return fail(400, "invalid", "Invalid request.");
  }
  const parsed = parseRenderRequest(body);
  if (!parsed.ok) return fail(400, "invalid", parsed.error);
  const brief = parsed.value;
  const designName = cleanDesignName((body as { designName?: unknown }).designName);

  // Each request is work for a person: a short queue per user, and a daily cap.
  const pending = await db
    .from("ai_photo_requests")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "pending");
  if (pending.error) {
    console.error("POST /api/ai-photos pending count failed:", pending.error.message);
    return fail(500, "internal", "Could not send your request. Try again.");
  }
  // a HEAD count on a missing table has no error, only count null
  if (pending.count === null) {
    console.error("POST /api/ai-photos: pending count unavailable (is the ai_photo_requests migration applied?)");
    return fail(500, "internal", "Could not send your request. Try again.");
  }
  if (pending.count >= MAX_PENDING_REQUESTS) {
    return fail(429, "queue_full", `You already have ${MAX_PENDING_REQUESTS} photos being made. Wait for one to arrive, then ask again.`);
  }
  // the daily cap counts requests that were really filed, so a failed send
  // (storage or database down) never uses up someone's allowance
  const today = await db
    .from("ai_photo_requests")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", new Date(Date.now() - DAY_MS).toISOString());
  if (today.error) {
    console.error("POST /api/ai-photos daily count failed:", today.error.message);
    return fail(500, "internal", "Could not send your request. Try again.");
  }
  if ((today.count ?? MAX_REQUESTS_PER_DAY) >= MAX_REQUESTS_PER_DAY) {
    return fail(429, "rate_limited", `You can ask for ${MAX_REQUESTS_PER_DAY} AI photos a day. Try again tomorrow.`);
  }

  // re-encode: admins download and open this file, so keep pixels only
  let picture: Buffer;
  try {
    picture = await sanitizeImage(Buffer.from(brief.imageBase64, "base64"), brief.mime);
  } catch {
    return fail(400, "invalid", "That picture could not be read.");
  }

  const inputPath = `in/${crypto.randomUUID()}.${extForMime(brief.mime)}`;
  const upload = await db.storage
    .from(AI_PHOTOS_BUCKET)
    .upload(inputPath, picture, { contentType: brief.mime, upsert: false });
  if (upload.error) {
    console.error("POST /api/ai-photos upload failed:", upload.error.message);
    return fail(500, "internal", "Could not send your request. Try again.");
  }

  const { data, error } = await db
    .from("ai_photo_requests")
    .insert({
      user_id: userId,
      design_name: designName,
      place: brief.place ?? null,
      brief: { style: brief.style, floors: brief.floors, facing: brief.facing ?? null, time: brief.time },
      prompt: buildRenderPrompt(brief),
      input_path: inputPath,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) {
    console.error("POST /api/ai-photos insert failed:", error?.message);
    // don't leave a picture nobody will ever look at
    await db.storage.from(AI_PHOTOS_BUCKET).remove([inputPath]);
    return fail(500, "internal", "Could not send your request. Try again.");
  }
  // after the response: a slow or failed email must not hold up or fail the request
  afterResponse(() => notifyAiPhotoRequested({ designName }));
  return Response.json({ id: data.id, status: "pending" }, { status: 201, headers: { "cache-control": "no-store" } });
}
