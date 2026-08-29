// Content-Security-Policy, shared between proxy.ts (per-request, nonce-based —
// the policy that guards every rendered page) and next.config.ts (the static
// carve-out for public/builder/builder.html, whose inline importmap cannot
// receive a per-request nonce). Keep the origin lists here in sync with the
// code that reaches out to them — a missing origin shows up as a blocked
// request in the console (and, for the basemap, as a silently blank map).

const SUPABASE = "https://tdbnwismmyllpufurqus.supabase.co"; // NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_WS = "wss://tdbnwismmyllpufurqus.supabase.co"; // realtime, if ever enabled
const RAZORPAY = ["https://checkout.razorpay.com", "https://*.razorpay.com"]; // lib/checkout.ts
// Clerk: dev instances serve clerk.browser.js + the FAPI from *.clerk.accounts.dev,
// production instances from clerk.<your-domain> — add that host here at launch.
const CLERK = [
  "https://*.clerk.accounts.dev",
  "https://*.clerk.com",
  "https://*.clerk.dev",
];
const CLERK_EXTRA = ["https://clerk-telemetry.com", "https://*.clerk-telemetry.com"];
const TILES = [
  "https://tiles.openfreemap.org", // components/Map3D.tsx style + glyphs + sprites + vector tiles
  "https://server.arcgisonline.com", // satellite raster layer
];
const NOMINATIM = "https://nominatim.openstreetmap.org"; // app/find/page.tsx geocoding
const JSDELIVR = "https://cdn.jsdelivr.net"; // three.js ESM importmap in public/builder/builder.html
// <SpeedInsights /> in app/layout.tsx. On Vercel the script is proxied same-origin
// from /_vercel/speed-insights/script.js, but off-platform (and in dev) it loads
// from va.vercel-scripts.com and beacons to vitals.vercel-insights.com. Both are
// listed so the component works in every environment.
const VERCEL_INSIGHTS = [
  "https://va.vercel-scripts.com",
  "https://vitals.vercel-insights.com",
];

const SCRIPT_HOSTS = [
  ...RAZORPAY,
  ...CLERK,
  "https://challenges.cloudflare.com",
  JSDELIVR,
  ...VERCEL_INSIGHTS,
];

export interface CspOptions {
  isDev: boolean;
  /**
   * When set, inline scripts are gated on this per-request nonce instead of
   * 'unsafe-inline' — Next.js stamps it onto its own framework/page scripts
   * (and ClerkProvider onto its injected ones). Omit it only for the static
   * builder carve-out, whose inline importmap has no nonce and therefore must
   * keep 'unsafe-inline'. External SDK scripts (Clerk, Razorpay, Vercel) load
   * by src from the allow-listed hosts above, so no 'strict-dynamic' is needed.
   */
  nonce?: string;
}

/** Build the CSP header value. */
export function buildCsp({ isDev, nonce }: CspOptions): string {
  // 'unsafe-eval' is only needed in dev (React uses eval for error overlays/HMR).
  const evalPart = isDev ? " 'unsafe-eval'" : "";
  const inlinePart = nonce ? `'nonce-${nonce}'` : "'unsafe-inline'";
  const scriptSrc = `'self' ${inlinePart}${evalPart} ${SCRIPT_HOSTS.join(" ")}`;

  return [
    `default-src 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    // 'self', not 'none': DesignerOverlay embeds /builder/builder.html in a
    // same-origin iframe. 'none' blocks that too and silently kills the builder.
    // External clickjacking is still blocked — only our own origin may frame us.
    `frame-ancestors 'self'`,
    `form-action 'self'`,
    `script-src ${scriptSrc}`,
    `script-src-elem ${scriptSrc}`,
    // Tailwind and maplibre-gl both inject <style> tags at runtime, so styles
    // stay on 'unsafe-inline' (out of scope for the script XSS hardening).
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src 'self' data: https://fonts.gstatic.com`,
    // blob:/data: cover maplibre's canvas + WebGL textures and builder screenshots.
    `img-src 'self' data: blob: https://images.unsplash.com ${SUPABASE} ${TILES.join(" ")} https://img.clerk.com ${RAZORPAY.join(" ")}`,
    `media-src 'self' blob:`,
    `connect-src 'self'${isDev ? " ws://localhost:* http://localhost:*" : ""} ${SUPABASE} ${SUPABASE_WS} ${[...CLERK, ...CLERK_EXTRA, ...RAZORPAY, "https://lumberjack.razorpay.com", ...TILES, NOMINATIM, JSDELIVR, ...VERCEL_INSIGHTS].join(" ")}`,
    // Razorpay checkout renders in an iframe; Clerk uses one for its handshake and
    // Cloudflare Turnstile for bot protection.
    `frame-src 'self' ${[...RAZORPAY, ...CLERK, "https://challenges.cloudflare.com"].join(" ")}`,
    // maplibre-gl spawns its tile workers from blob: URLs.
    `worker-src 'self' blob:`,
    `manifest-src 'self'`,
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}
