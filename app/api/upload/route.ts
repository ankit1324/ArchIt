import crypto from "node:crypto";
import { db } from "@/lib/db";
import { EXT_BY_MIME, MAX_UPLOAD_BYTES } from "@/lib/upload";

export async function POST(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "file field required" }, { status: 400 });
  }
  const ext = EXT_BY_MIME[file.type];
  if (!ext) {
    return Response.json({ error: "only jpeg/png/webp/avif images" }, { status: 415 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return Response.json({ error: "max 8 MB" }, { status: 413 });
  }

  const name = `${crypto.randomUUID()}${ext}`;
  const { error } = await db.storage
    .from("photos")
    .upload(name, Buffer.from(await file.arrayBuffer()), {
      contentType: file.type,
    });
  if (error) return Response.json({ error: error.message }, { status: 500 });

  const { data } = db.storage.from("photos").getPublicUrl(name);
  return Response.json({ url: data.publicUrl }, { status: 201 });
}
