import type { Metadata } from "next";

// The showcase pages are client components, so their metadata lives here.
export const metadata: Metadata = {
  title: "Showcase",
  description: "Homes designed by the ArchIt community, in 3D.",
  // Public (proxy.ts leaves /showcase open), so let crawlers index it.
  robots: { index: true, follow: true },
};

export default function ShowcaseLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
