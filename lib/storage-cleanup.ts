import { isThumbObjectName, storageObjectName, thumbObjectNames } from "./url.ts";

/**
 * The upload-cleanup logic with storage and the reference queries injected, so
 * it is unit-testable without Supabase or "server-only". lib/storage.ts wires
 * the real client.
 */

export const UPLOADS_BUCKET = "photos";

type CountResult = PromiseLike<{ count: number | null; error: { message: string } | null }>;

export interface UploadCleanupDeps {
  /** getPublicUrl(name) on the uploads bucket: the canonical URL /api/upload returned. */
  publicUrl(name: string): string;
  /** Rows still pointing at `url`, one query per place an upload can be used. */
  references: {
    /** properties.photo = url */
    photo(url: string): CountResult;
    /** properties.photos contains url */
    photos(url: string): CountResult;
    /** designs.snapshot = url */
    snapshot(url: string): CountResult;
  };
  /** Delete these object names from the uploads bucket. */
  remove(names: string[]): PromiseLike<{ error: { message: string } | null }>;
}

export function createUploadCleanup(deps: UploadCleanupDeps) {
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
  async function removeUnreferencedUploads(context: string, urls: unknown[]): Promise<void> {
    // Only exact canonical URLs (what /api/upload returned) are candidates. A
    // variant spelling of the same object — a query string, a fragment,
    // percent-encoding — would not match the exact-string reference checks
    // below, so another row's use of the canonical URL would go unseen and its
    // image would be deleted. Such variants are never deleted.
    const candidates: Array<{ url: string; name: string }> = [];
    for (const url of new Set(urls)) {
      if (typeof url !== "string" || url === "") continue;
      const name = storageObjectName(url, UPLOADS_BUCKET);
      if (!name) continue;
      // resized variants are derived from their original and only ever removed
      // with it (below); a row pointing at one directly must not delete it
      // out from under the original that thumbnailUrl() maps onto it
      if (isThumbObjectName(name)) continue;
      if (deps.publicUrl(name) !== url) continue;
      candidates.push({ url, name });
    }
    if (candidates.length === 0) return;

    try {
      const names: string[] = [];
      for (const { url, name } of candidates) {
        const [photo, photos, snapshot] = await Promise.all([
          deps.references.photo(url),
          deps.references.photos(url),
          deps.references.snapshot(url),
        ]);
        const failed = photo.error ?? photos.error ?? snapshot.error;
        if (failed) {
          // can't prove it's unused — keep it
          console.warn(`${context}: upload reference check failed:`, failed.message);
          continue;
        }
        if (!photo.count && !photos.count && !snapshot.count) {
          // its resized variants (app/api/upload) go with it
          names.push(name, ...thumbObjectNames(name));
        }
      }
      if (names.length === 0) return;
      const { error } = await deps.remove(names);
      if (error) console.warn(`${context}: upload cleanup failed:`, error.message);
    } catch (e) {
      console.warn(`${context}: upload cleanup threw:`, e);
    }
  }

  return { removeUnreferencedUploads };
}
