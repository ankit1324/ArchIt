import type { Metadata } from "next";

// The showcase pages are client components, so their metadata lives here.
export const metadata: Metadata = {
  title: "Showcase",
  description: "Homes designed by the ArchIt community, in 3D.",
  // Gated behind sign-in (proxy.ts): nothing for crawlers to index.
  robots: { index: false, follow: false },
};

export default function ShowcaseLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
