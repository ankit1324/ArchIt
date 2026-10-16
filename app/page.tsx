import { auth } from "@clerk/nextjs/server";
import SuiteDashboard from "@/components/SuiteDashboard";
import MarketingLanding from "@/components/MarketingLanding";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ArchIt — Plan your home, explore your ideas",
  description:
    "Start with your plot, explore starter layouts, and design room by room. Develop your home ideas in 2D and 3D with ArchIt’s browser-based builder.",
};

export default async function Home() {
  // Signed out: home-planning introduction; signed in: suite dashboard.
  const { userId } = await auth();
  return userId ? <SuiteDashboard /> : <MarketingLanding />;
}
