import type { Metadata } from "next";

// page.tsx is a client component, so its metadata lives here.
export const metadata: Metadata = {
  title: "Find a property",
  description:
    "Find homes on a living 3D map of Chandigarh — buy, rent, explore neighborhoods in three dimensions.",
  // Gated behind sign-in (proxy.ts): nothing for crawlers to index.
  robots: { index: false, follow: false },
};

export default function FindLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {/* React hoists <link> into <head>: warm the TLS handshakes for the
          vector style/tiles and the satellite imagery while the map chunk
          is still downloading */}
      <link rel="preconnect" href="https://tiles.openfreemap.org" crossOrigin="" />
      <link rel="preconnect" href="https://server.arcgisonline.com" crossOrigin="" />
      {children}
    </>
  );
}
