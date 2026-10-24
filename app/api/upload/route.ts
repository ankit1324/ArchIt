import crypto from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import sharp from "@/lib/sharp";
import { db } from "@/lib/db";
import { checkRateLimit, ipKey, rateLimitedResponse } from "@/lib/rate-limit";
import { readBodyCapped } from "@/lib/request";
import {
  declaredPixels,
  detectImageType,
  EXT_BY_MIME,
  MAX_INPUT_PIXELS,
  MAX_UPLOAD_BYTES,
} from "@/lib/upload";
import { THUMB_WIDTHS, thumbObjectNames } from "@/lib/url";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!(await checkRateLimit(ipKey(request, "upload", userId), 10, 60_000))) {
    return rateLimitedResponse();
  }

  // Multipart boundaries/headers add a little over the file itself; the exact
  // file.size check below is still the authoritative guard.
  const maxBody = MAX_UPLOAD_BYTES + 64 * 1024;
  const declaredBytes = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredBytes) && declaredBytes > maxBody) {
    return Response.json({ error: "max 8 MB" }, { status: 413 });
  }
  // Content-Length is advisory (absent when chunked); count the bytes as they
  // stream in so an oversized body is cut off, never buffered in full.
  const raw = await readBodyCapped(request, maxBody);
  if (!raw) return Response.json({ error: "max 8 MB" }, { status: 413 });

  let form: FormData;
  try {
    form = await new Response(raw as BodyInit, {
      headers: { "content-type": request.headers.get("content-type") ?? "" },
    }).formData();
  } catch {
    return Response.json({ error: "multipart body required" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "file field required" }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return Response.json({ error: "max 8 MB" }, { status: 413 });
  }

  // Trust magic bytes, not the client-supplied Content-Type.
  const buf = Buffer.from(await file.arrayBuffer());
  const mime = detectImageType(buf);
  const ext = mime ? EXT_BY_MIME[mime] : undefined;
  if (!mime || !ext) {
    return Response.json({ error: "only jpeg/png/webp/avif images" }, { status: 415 });
  }

  // Magic bytes alone admit anything that merely starts like an image (a JPEG
  // marker followed by HTML, say), and a tiny file can declare a huge canvas.
  // Both used to be stored anyway: the failed thumbnail just fell back to the
  // original, which every viewer's browser then fetched. Parse the header
  // before anything is stored — it must be a real image within the pixel
  // budget. Header only, so a truncated-but-valid photo still goes through as
  // before (without thumbnails).
  let meta: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    meta = await sharp(buf, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  } catch (e) {
    return /pixel limit/i.test((e as Error).message)
      ? Response.json({ error: "image too large (max 40 megapixels)" }, { status: 413 })
      : Response.json({ error: "unreadable image" }, { status: 415 });
  }
  const pixels = declaredPixels(meta);
  if (pixels === 0) return Response.json({ error: "unreadable image" }, { status: 415 });
  if (pixels > MAX_INPUT_PIXELS) {
    return Response.json({ error: "image too large (max 40 megapixels)" }, { status: 413 });
  }

  // Resized webp variants for markers (64px) and cards/panels (480px). Only
  // when every variant is stored does the original get the `-t` name that
  // tells readers they exist (lib/url.ts thumbnailUrl); otherwise it is saved
  // under a plain name and readers fall back to the original.
  const id = crypto.randomUUID();
  const thumbed = await storeThumbnails(`${id}-t`, buf);
  const name = `${thumbed ? `${id}-t` : id}${ext}`;
  const { error } = await db.storage
    .from("photos")
    .upload(name, buf, { contentType: mime });
  if (error) {
    console.error("Photo upload failed:", error.message);
    if (thumbed) await db.storage.from("photos").remove(thumbObjectNames(name));
    return Response.json({ error: "internal error" }, { status: 500 });
  }

  const { data } = db.storage.from("photos").getPublicUrl(name);
  return Response.json({ url: data.publicUrl }, { status: 201 });
}

/** Generate and upload every THUMB_WIDTHS variant; false (and nothing left behind) on any failure. */
async function storeThumbnails(base: string, buf: Buffer): Promise<boolean> {
  const names = THUMB_WIDTHS.map((w) => `${base}.w${w}.webp`);
  try {
    const variants = await Promise.all(
      THUMB_WIDTHS.map((w) =>
        sharp(buf, { limitInputPixels: MAX_INPUT_PIXELS })
          .rotate() // honour EXIF orientation before it is stripped
          .resize(w === 64 ? { width: 64, height: 64, fit: "cover" } : { width: w, withoutEnlargement: true })
          .webp({ quality: w === 64 ? 70 : 76 })
          .toBuffer(),
      ),
    );
    const results = await Promise.all(
      variants.map((v, i) =>
        db.storage.from("photos").upload(names[i], v, { contentType: "image/webp" }),
      ),
    );
    const failed = results.find((r) => r.error)?.error;
    if (failed) throw new Error(failed.message);
    return true;
  } catch (e) {
    console.warn("Thumbnail generation failed, storing original only:", (e as Error).message);
    await db.storage.from("photos").remove(names).catch(() => {});
    return false;
  }
}
