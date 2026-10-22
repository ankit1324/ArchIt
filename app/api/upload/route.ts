import crypto from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { checkRateLimit, ipKey, rateLimitedResponse } from "@/lib/rate-limit";
import { readBodyCapped } from "@/lib/request";
import { detectImageType, EXT_BY_MIME, MAX_UPLOAD_BYTES } from "@/lib/upload";

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

  const name = `${crypto.randomUUID()}${ext}`;
  const { error } = await db.storage
    .from("photos")
    .upload(name, buf, { contentType: mime });
  if (error) {
    console.error("Photo upload failed:", error.message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }

  const { data } = db.storage.from("photos").getPublicUrl(name);
  return Response.json({ url: data.publicUrl }, { status: 201 });
}
