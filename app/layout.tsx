import {ClerkProvider} from "@clerk/nextjs";
import { SpeedInsights } from "@vercel/speed-insights/next";
import CelebrationLayer from "@/components/Celebration";
import type { Metadata } from "next";
import { headers } from "next/headers";
import localFont from "next/font/local";
import "./globals.css";

// Self-hosted rather than next/font/google: a build that has to reach Google
// Fonts is a build that can fail offline. See assets/fonts/README.md.
// One variable file replaces the 400–800 static cuts this used to request.
const jakarta = localFont({
  src: "../assets/fonts/plus-jakarta-sans-latin-wght-normal.woff2",
  weight: "200 800", // the file's own wght range; 400–800 is what we actually use
  style: "normal",
  variable: "--font-jakarta",
});

const SITE_DESCRIPTION =
  "Plan your plot, lay out rooms and explore your home in 3D, right in the browser. Free to start; sign in to save your designs.";

// Neutral suite-wide defaults. Pages refine title/description; the OG image
// comes from app/opengraph-image.tsx. Note: nested fields (openGraph, robots,
// alternates) are replaced, not merged, by any segment that sets them.
export const metadata: Metadata = {
  metadataBase: new URL("https://archit.chaudharyankit.in"),
  title: {
    default: "ArchIt — Plan your home in 3D",
    template: "%s · ArchIt",
  },
  description: SITE_DESCRIPTION,
  applicationName: "ArchIt",
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The nonce is minted per request in proxy.ts. Reading it here also opts every
  // page into dynamic rendering, which a per-request nonce requires. Clerk needs
  // it so its injected scripts satisfy the nonce-based CSP (no 'unsafe-inline').
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="en" className={`${jakarta.variable} h-full antialiased`}>
      <body className="h-full">
        <ClerkProvider nonce={nonce}>
          {children}
          <CelebrationLayer />
        </ClerkProvider>
        {/* Outside ClerkProvider: it needs no auth context, and it reports Web
            Vitals for signed-out landing traffic too. Its script and beacon are
            same-origin under /_vercel, so the CSP needs no new allowance. */}
        <SpeedInsights />
      </body>
    </html>
  );
}