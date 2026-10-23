// Content-Security-Policy, shared between proxy.ts (per-request, nonce-based —
// the policy that guards every rendered page) and next.config.ts (the static
// policy for public/builder/, which proxy.ts never sees). Keep the origin lists
// here in sync with the code that reaches out to them — a missing origin shows
// up as a blocked request in the console (and, for the basemap, as a silently
// blank map).

const SUPABASE = "https://tdbnwismmyllpufurqus.supabase.co"; // NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_WS = "wss://tdbnwismmyllpufurqus.supabase.co"; // realtime, if ever enabled
// YouPI-PG self-hosted gateway (lib/checkout.ts): the checkout portal serves
// youpi.js (script-src) and the /checkout/:id iframe (frame-src). Read from env
// so a dev gateway on localhost and a production one on pay.<domain> both
// work without a code change. Unset = paywall cannot run, so nothing is listed.
const YOUPI = Array.from(
  new Set(
    [process.env.NEXT_PUBLIC_YOUPI_PORTAL_URL, process.env.YOUPI_API_URL]
      .filter((u): u is string => Boolean(u))
      .map((u) => {
        try {
          return new URL(u).origin;
        } catch {
          return "";
        }
      })
      .filter(Boolean),
  ),
);
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
// <SpeedInsights /> in app/layout.tsx. On Vercel the script is proxied same-origin
// from /_vercel/speed-insights/script.js, but off-platform (and in dev) it loads
// from va.vercel-scripts.com and beacons to vitals.vercel-insights.com. Both are
// listed so the component works in every environment.
const VERCEL_INSIGHTS = [
  "https://va.vercel-scripts.com",
  "https://vitals.vercel-insights.com",
];

const SCRIPT_HOSTS = [
  ...YOUPI,
  ...CLERK,
  "https://challenges.cloudflare.com",
  ...VERCEL_INSIGHTS,
];

export interface CspOptions {
  isDev: boolean;
  /**
   * When set, inline scripts are gated on this per-request nonce instead of
   * 'unsafe-inline' — Next.js stamps it onto its own framework/page scripts
   * (and ClerkProvider onto its injected ones). Without it inline scripts
   * fall back to 'unsafe-inline'. External SDK scripts (Clerk, YouPI, Vercel) load
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
    `img-src 'self' data: blob: https://images.unsplash.com ${SUPABASE} ${TILES.join(" ")} https://img.clerk.com`,
    `media-src 'self' blob:`,
    `connect-src 'self'${isDev ? " ws://localhost:* http://localhost:*" : ""} ${SUPABASE} ${SUPABASE_WS} ${[...CLERK, ...CLERK_EXTRA, ...YOUPI, ...TILES, NOMINATIM, ...VERCEL_INSIGHTS].join(" ")}`,
    // YouPI checkout renders in an iframe; Clerk uses one for its handshake and
    // Cloudflare Turnstile for bot protection.
    `frame-src 'self' ${[...YOUPI, ...CLERK, "https://challenges.cloudflare.com"].join(" ")}`,
    // maplibre-gl spawns its tile workers from blob: URLs.
    `worker-src 'self' blob:`,
    `manifest-src 'self'`,
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

/**
 * Policy for the static 3D builder (public/builder/, framed by DesignerOverlay).
 * Its only script is the esbuild bundle served from 'self' (three.js is
 * vendored into it), so there is no inline script, no CDN and no nonce to
 * thread through. It talks to nothing but our own /api/templates.
 */
export function buildBuilderCsp({ isDev }: { isDev: boolean }): string {
  return [
    `default-src 'self'`,
    `base-uri 'self'`,
    `object-src 'none'`,
    `frame-ancestors 'self'`,
    `form-action 'self'`,
    `script-src 'self'`,
    // the stylesheet is inline in builder.html; the walk overlay and plan set
    // style attributes at runtime
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src 'self' https://fonts.gstatic.com`,
    // furniture thumbnails, exports and the design sheet are data:/blob: URLs
    `img-src 'self' data: blob:`,
    `connect-src 'self'`,
    `worker-src 'none'`,
    `frame-src 'none'`,
    `manifest-src 'self'`,
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}
