import { SpeedInsights } from "@vercel/speed-insights/next";
import Analytics from "@/components/Analytics";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

// Self-hosted rather than next/font/google: a build that has to reach Google
// Fonts is a build that can fail offline. See assets/fonts/README.md.
// The suite's type, from the landing page: Manrope for text, Fraunces for
// display headings (class `font-display`, see globals.css). Both are variable
// files, so one request per family covers every weight.
const manrope = localFont({
  src: "../assets/fonts/manrope-latin-wght-normal.woff2",
  weight: "200 800",
  style: "normal",
  variable: "--font-manrope",
});

// preload: false. Most pages paint a Fraunces heading, but not every one does,
// and the italic cut is only used for emphasis; adjustFontFallback keeps the
// swap from shifting layout.
const fraunces = localFont({
  src: [
    { path: "../assets/fonts/fraunces-latin-wght-normal.woff2", weight: "100 900", style: "normal" },
    { path: "../assets/fonts/fraunces-latin-wght-italic.woff2", weight: "100 900", style: "italic" },
  ],
  variable: "--font-fraunces",
  adjustFontFallback: "Times New Roman",
  preload: false,
});

const SITE_DESCRIPTION =
  "Plan your plot, lay out rooms and explore your home in 3D, right in the browser. Free to start; sign in to save your designs.";

// Neutral suite-wide defaults. Pages refine title/description; the OG image
// comes from app/opengraph-image.tsx. Note: nested fields (openGraph, robots,
// alternates) are replaced, not merged, by any segment that sets them.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "ArchIt — Plan your home in 3D",
    template: "%s · ArchIt",
  },
  description: SITE_DESCRIPTION,
  applicationName: "ArchIt",
  appleWebApp: { title: "ArchIt", statusBarStyle: "default" },
  openGraph: {
    siteName: "ArchIt",
    type: "website",
    locale: "en_IN",
    title: "ArchIt — Plan your home in 3D",
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "ArchIt — Plan your home in 3D",
    description: SITE_DESCRIPTION,
  },
};

// viewport-fit=cover lets env(safe-area-inset-*) report the notch / home
// indicator insets that /find's bottom sheet and the dashboard tab bar pad by
export const viewport: Viewport = {
  themeColor: "#f8f7f2", // --color-paper
  viewportFit: "cover",
};

// No headers()/auth() here: anything request-bound in the root layout makes
// every route dynamic. Marketing and legal pages prerender; the Clerk provider
// (and the per-request CSP nonce it needs) lives in app/(app)/layout.tsx.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${manrope.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="h-full">
        {children}
        {/* Both report for signed-out landing traffic too. Their scripts and
            beacons are same-origin under /_vercel, so the CSP needs no new
            allowance. */}
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
