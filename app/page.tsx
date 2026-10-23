import MarketingLanding from "@/components/MarketingLanding";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ArchIt — Plan your home, explore your ideas",
  description:
    "Start with your plot, explore starter layouts, and design room by room. Develop your home ideas in 2D and 3D with ArchIt’s browser-based builder.",
  // Canonical lives here, not in the root layout: alternates is inherited by
  // every route that doesn't set its own, so a root '/' would mark /privacy
  // and /terms as duplicates of the landing page.
  alternates: { canonical: "/" },
};

// Prerendered at build time. Signed-in visitors never see it: proxy.ts
// rewrites "/" to the dashboard (app/(app)/dashboard) when a session exists.
export default function Home() {
  return <MarketingLanding />;
}
