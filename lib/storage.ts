import "server-only";
import { db } from "./db";
import { createUploadCleanup, UPLOADS_BUCKET } from "./storage-cleanup";

/**
 * Live wiring of lib/storage-cleanup.ts (where the logic and its tests live):
 * Supabase Storage for the bucket, PostgREST count queries for the references.
 */
export const { removeUnreferencedUploads } = createUploadCleanup({
  publicUrl: (name) => db.storage.from(UPLOADS_BUCKET).getPublicUrl(name).data.publicUrl,
  references: {
    photo: (url) =>
      db.from("properties").select("id", { count: "exact", head: true }).eq("photo", url),
    photos: (url) =>
      db.from("properties").select("id", { count: "exact", head: true }).contains("photos", [url]),
    snapshot: (url) =>
      db.from("designs").select("id", { count: "exact", head: true }).eq("snapshot", url),
  },
  remove: (names) => db.storage.from(UPLOADS_BUCKET).remove(names),
});
