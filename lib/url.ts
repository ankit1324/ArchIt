// Allowed image hosts — mirror of next.config.ts images.remotePatterns.
// Kept as a runtime constant (Next can't expose remotePatterns at runtime).
export const ALLOWED_IMAGE_HOSTS = [
  "images.unsplash.com",
  "tdbnwismmyllpufurqus.supabase.co",
];

/**
 * Returns `url` only when it is an absolute https URL on an allowlisted host,
 * otherwise null. Blocks user-controlled javascript:/data:/http URLs and
 * off-host fetches from ever reaching <Image>/<img> src.
 */
export function safeImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  if (!ALLOWED_IMAGE_HOSTS.includes(u.hostname)) return null;
  return url;
}

/**
 * Object name inside a Supabase Storage public bucket, derived from the URL
 * `getPublicUrl()` produced (`/storage/v1/object/public/<bucket>/<name>`), or
 * null when the URL is not one of ours. Lets a listing delete also drop its
 * uploaded photos without the row having to store object names separately.
 */
export function storageObjectName(url: string, bucket: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || !u.hostname.endsWith(".supabase.co")) return null;
  const prefix = `/storage/v1/object/public/${bucket}/`;
  if (!u.pathname.startsWith(prefix)) return null;
  let name: string;
  try {
    name = decodeURIComponent(u.pathname.slice(prefix.length));
  } catch {
    return null; // malformed percent-encoding: not a name we issued
  }
  // one flat level of uuid.ext names; refuse anything that could traverse
  if (!name || name.includes("/") || name.includes("..")) return null;
  return name;
}

/**
 * Uploads made since thumbnails were introduced are stored as `<uuid>-t.<ext>`
 * next to `<uuid>-t.w64.webp` and `<uuid>-t.w480.webp` (app/api/upload). The
 * `-t` marker is how a reader knows the variants exist without a DB column or
 * a probe request; older uploads (plain `<uuid>.<ext>`) have none.
 */
const THUMBED_NAME = /^([0-9a-f-]{36}-t)\.(?:jpg|png|webp|avif)$/;

export const THUMB_WIDTHS = [64, 480] as const;
export type ThumbWidth = (typeof THUMB_WIDTHS)[number];

/** True for a resized variant (`<uuid>-t.w<width>.webp`), never an original. */
export function isThumbObjectName(name: string): boolean {
  return /^[0-9a-f-]{36}-t\.w\d+\.webp$/.test(name);
}

/** Object names of the resized variants for an uploaded original. */
export function thumbObjectNames(name: string): string[] {
  const m = THUMBED_NAME.exec(name);
  return m ? THUMB_WIDTHS.map((w) => `${m[1]}.w${w}.webp`) : [];
}

/**
 * URL of the `width`px webp variant of an uploaded photo, or null when the
 * photo predates thumbnails (or isn't one of our uploads) — callers then fall
 * back to the original.
 */
export function thumbnailUrl(url: string | null | undefined, width: ThumbWidth): string | null {
  const safe = safeImageUrl(url);
  if (!safe) return null;
  const u = new URL(safe);
  const slash = u.pathname.lastIndexOf("/");
  let last: string;
  try {
    last = decodeURIComponent(u.pathname.slice(slash + 1));
  } catch {
    return null; // malformed percent-encoding: not one of our uploads
  }
  const m = THUMBED_NAME.exec(last);
  if (!m || !u.pathname.startsWith("/storage/v1/object/public/")) return null;
  u.pathname = `${u.pathname.slice(0, slash + 1)}${m[1]}.w${width}.webp`;
  u.search = "";
  u.hash = "";
  return u.toString();
}

/**
 * Smallest image that still looks right at `width` CSS px: our stored variant,
 * a resized Unsplash URL (seed data), else the original.
 */
export function sizedImageUrl(url: string | null | undefined, width: ThumbWidth): string | null {
  const safe = safeImageUrl(url);
  if (!safe) return null;
  const thumb = thumbnailUrl(safe, width);
  if (thumb) return thumb;
  const u = new URL(safe);
  if (u.hostname === "images.unsplash.com") {
    u.searchParams.set("w", String(width * 2));
    u.searchParams.set("q", "70");
    u.searchParams.set("auto", "format");
    return u.toString();
  }
  return safe;
}
