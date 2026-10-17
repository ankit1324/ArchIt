import type { Metadata } from "next";

// page.tsx is a client component, so its metadata lives here.
export const metadata: Metadata = {
  title: "Home designer",
  description:
    "Design your home room by room in 2D and 3D with ArchIt's browser-based builder.",
  // Gated behind sign-in (proxy.ts): nothing for crawlers to index.
  robots: { index: false, follow: false },
};

export default function DesignerLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
