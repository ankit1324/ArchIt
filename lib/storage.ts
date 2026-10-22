import "server-only";
import { db } from "./db";
import { storageObjectName } from "./url";

const BUCKET = "photos";

/**
 * Best-effort delete of uploaded images that no row points at any more.
 *
 * Uploads are flat uuid names with no owner recorded, and any row may carry any
 * URL on our storage host (safeImageUrl only checks the host). So an object is
 * removed only after confirming that no listing (photo / photos[]) and no
 * design (snapshot) still references it — otherwise deleting your own row
 * could take down an image someone else's row is using.
 *
 * Call after the row that dropped the URL has been written. Never throws.
 */
export async function removeUnreferencedUploads(context: string, urls: unknown[]): Promise<void> {
  const candidates = [
    ...new Set(urls.filter((u): u is string => typeof u === "string" && u !== "")),
  ].filter((u) => storageObjectName(u, BUCKET) !== null);
  if (candidates.length === 0) return;

  try {
    const names: string[] = [];
    for (const url of candidates) {
      const [photo, photos, snapshot] = await Promise.all([
        db.from("properties").select("id", { count: "exact", head: true }).eq("photo", url),
        db.from("properties").select("id", { count: "exact", head: true }).contains("photos", [url]),
        db.from("designs").select("id", { count: "exact", head: true }).eq("snapshot", url),
      ]);
      const failed = photo.error ?? photos.error ?? snapshot.error;
      if (failed) {
        // can't prove it's unused — keep it
        console.warn(`${context}: upload reference check failed:`, failed.message);
        continue;
      }
      if (!photo.count && !photos.count && !snapshot.count) {
        names.push(storageObjectName(url, BUCKET)!);
      }
    }
    if (names.length === 0) return;
    const { error } = await db.storage.from(BUCKET).remove(names);
    if (error) console.warn(`${context}: upload cleanup failed:`, error.message);
  } catch (e) {
    console.warn(`${context}: upload cleanup threw:`, e);
  }
}
