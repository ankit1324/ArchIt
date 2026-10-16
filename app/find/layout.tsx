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
  return children;
}
