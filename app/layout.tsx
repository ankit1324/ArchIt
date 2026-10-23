import { SpeedInsights } from "@vercel/speed-insights/next";
import Analytics from "@/components/Analytics";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

// Self-hosted rather than next/font/google: a build that has to reach Google
// Fonts is a build that can fail offline. See assets/fonts/README.md.
// One variable file replaces the 400–800 static cuts this used to request.
// preload: false — the landing page sets its own type (Fraunces/Manrope) and
// never paints Jakarta, so a root-level preload was 27KB of wasted bandwidth on
// the most-visited page. App and legal pages still get it via the CSS below.
const jakarta = localFont({
  src: "../assets/fonts/plus-jakarta-sans-latin-wght-normal.woff2",
  weight: "200 800", // the file's own wght range; 400–800 is what we actually use
  style: "normal",
  variable: "--font-jakarta",
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
  themeColor: "#f5f1ea", // --color-cream
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
    <html lang="en" className={`${jakarta.variable} h-full antialiased`}>
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
