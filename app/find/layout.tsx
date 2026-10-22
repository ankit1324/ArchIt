import type { Metadata } from "next";

// FindClient is a client component; the route metadata lives here.
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
      {/* the style document and its TileJSON gate every tile; fetch them in
          parallel with the map chunk instead of after it (same URL, mode and
          credentials as maplibre's own requests, so the preloads are reused) */}
      <link rel="preload" href="https://tiles.openfreemap.org/styles/positron" as="fetch" crossOrigin="anonymous" />
      <link rel="preload" href="https://tiles.openfreemap.org/planet" as="fetch" crossOrigin="anonymous" />
      {children}
    </>
  );
}
