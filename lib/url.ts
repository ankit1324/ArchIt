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
