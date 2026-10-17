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

// the Supabase host only serves public Storage objects to next/image
// (next.config.ts remotePatterns pins its pathname)
const STORAGE_HOST = "tdbnwismmyllpufurqus.supabase.co";
const STORAGE_PUBLIC_PATH = "/storage/v1/object/public/";

/**
 * safeImageUrl, narrowed to what next.config.ts remotePatterns lets
 * next/image load: on the Supabase host only public Storage objects with no
 * query string. Use it for author-controlled URLs passed to <Image> (design
 * snapshots), which would otherwise throw in dev and 400 in prod.
 */
export function nextImageUrl(url: string | null | undefined): string | null {
  const safe = safeImageUrl(url);
  if (!safe) return null;
  const u = new URL(safe);
  if (u.hostname !== STORAGE_HOST) return safe;
  return u.pathname.startsWith(STORAGE_PUBLIC_PATH) && !u.search ? safe : null;
}
