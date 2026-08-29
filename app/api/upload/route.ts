import crypto from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { checkRateLimit, ipKey, rateLimitedResponse } from "@/lib/rate-limit";
import { detectImageType, EXT_BY_MIME, MAX_UPLOAD_BYTES } from "@/lib/upload";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!(await checkRateLimit(ipKey(request, "upload", userId), 10, 60_000))) {
    return rateLimitedResponse();
  }

  // Reject oversized bodies before request.formData() buffers the whole payload
  // into memory. Content-Length includes multipart boundaries/headers, so allow
  // a little headroom over MAX_UPLOAD_BYTES; the exact file.size check below is
  // still the authoritative guard. This only stops the pathological case (a
  // several-hundred-MB body that would otherwise be materialized in full).
  const declaredBytes = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredBytes) && declaredBytes > MAX_UPLOAD_BYTES + 64 * 1024) {
    return Response.json({ error: "max 8 MB" }, { status: 413 });
  }

  const form = await request.formData();
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
