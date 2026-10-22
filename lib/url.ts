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
  const name = decodeURIComponent(u.pathname.slice(prefix.length));
  // one flat level of uuid.ext names; refuse anything that could traverse
  if (!name || name.includes("/") || name.includes("..")) return null;
  return name;
}
