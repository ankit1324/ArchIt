import type { NextConfig } from "next";
import { buildCsp } from "./lib/csp";

const isDev = process.env.NODE_ENV === "development";

// The main app CSP is set per-request in proxy.ts with a nonce (so script-src
// drops 'unsafe-inline'). The one exception is public/builder/builder.html: it
// is a static file with an inline importmap that cannot receive a per-request
// nonce, and proxy.ts excludes .html from its matcher. So the builder keeps the
// relaxed 'unsafe-inline' CSP, scoped to /builder only, set here.
const builderCsp = buildCsp({ isDev });

const SHARED_SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // SAMEORIGIN, not DENY: DENY also blocks our own builder iframe.
  // Legacy fallback for browsers without CSP frame-ancestors support.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // The app never asks for camera/mic/geolocation — deny them outright.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=(), payment=(self)",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Everything gets the shared hardening headers. Content-Security-Policy
        // is intentionally NOT here — proxy.ts sets the nonce-based policy for
        // rendered pages.
        source: "/(.*)",
        headers: SHARED_SECURITY_HEADERS,
      },
      {
        // Static builder carve-out: proxy.ts never runs for .html, so set its
        // (relaxed, nonce-less) CSP here.
        source: "/builder/:path*",
        headers: [{ key: "Content-Security-Policy", value: builderCsp }],
      },
    ];
  },
  images: {
    // Default is WebP only. AVIF first lets the hero still (the LCP candidate,
    // rendered through next/image) land noticeably smaller on browsers that
    // negotiate it; WebP stays as the fallback, JPEG for anything older.
    formats: ["image/avif", "image/webp"],
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
