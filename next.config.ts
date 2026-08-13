import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Third-party origins the app actually talks to. Keep this list in sync with
// the code that reaches out to them — a missing origin shows up as a blocked
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
const CLERK_EXTRA = [
  "https://clerk-telemetry.com",
  "https://*.clerk-telemetry.com",
];
const TILES = [
  "https://tiles.openfreemap.org", // components/Map3D.tsx style + glyphs + sprites + vector tiles
  "https://server.arcgisonline.com", // satellite raster layer
];
const NOMINATIM = "https://nominatim.openstreetmap.org"; // app/find/page.tsx geocoding
const JSDELIVR = "https://cdn.jsdelivr.net"; // three.js ESM importmap in public/builder/builder.html

// NOTE: script-src uses 'unsafe-inline' because Next.js injects inline bootstrap
// scripts (and public/builder/builder.html ships an inline importmap). Upgrading
// to a nonce means generating one per request in proxy.ts, forwarding it via the
// x-nonce header and moving this CSP there — that also forces every page to render
// dynamically, so it is a deliberate, separate change rather than a config tweak.
const csp = [
  `default-src 'self'`,
  `base-uri 'self'`,
  `object-src 'none'`,
  // 'self', not 'none': DesignerOverlay embeds /builder/builder.html in a
  // same-origin iframe. 'none' blocks that too and silently kills the builder.
  // External clickjacking is still blocked — only our own origin may frame us.
  `frame-ancestors 'self'`,
  `form-action 'self'`,
  // 'unsafe-eval' is only needed in dev (React uses eval for error overlays/HMR).
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} ${[...RAZORPAY, ...CLERK, "https://challenges.cloudflare.com", JSDELIVR].join(" ")}`,
  `script-src-elem 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} ${[...RAZORPAY, ...CLERK, "https://challenges.cloudflare.com", JSDELIVR].join(" ")}`,
  // Tailwind and maplibre-gl both inject <style> tags at runtime.
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
  `font-src 'self' data: https://fonts.gstatic.com`,
  // blob:/data: cover maplibre's canvas + WebGL textures and builder screenshots.
  `img-src 'self' data: blob: https://images.unsplash.com ${SUPABASE} ${TILES.join(" ")} https://img.clerk.com ${RAZORPAY.join(" ")}`,
  `media-src 'self' blob:`,
  `connect-src 'self'${isDev ? " ws://localhost:* http://localhost:*" : ""} ${SUPABASE} ${SUPABASE_WS} ${[...CLERK, ...CLERK_EXTRA, ...RAZORPAY, "https://lumberjack.razorpay.com", ...TILES, NOMINATIM, JSDELIVR].join(" ")}`,
  // Razorpay checkout renders in an iframe; Clerk uses one for its handshake and
  // Cloudflare Turnstile for bot protection.
  `frame-src 'self' ${[...RAZORPAY, ...CLERK, "https://challenges.cloudflare.com"].join(" ")}`,
  // maplibre-gl spawns its tile workers from blob: URLs.
  `worker-src 'self' blob:`,
  `manifest-src 'self'`,
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // SAMEORIGIN, not DENY: DENY also blocks our own builder iframe.
          // Legacy fallback for browsers without CSP frame-ancestors support.
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: csp },
          // The app never asks for camera/mic/geolocation — deny them outright.
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(self)",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      {
        protocol: "https",
        hostname: "tdbnwismmyllpufurqus.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
