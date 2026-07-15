import { auth } from "@clerk/nextjs/server";
import SuiteDashboard from "@/components/SuiteDashboard";
import MarketingLanding from "@/components/MarketingLanding";

export default async function Home() {
  // signed out: cinematic demo-reel landing; signed in: suite dashboard
  const { userId } = await auth();
  return userId ? <SuiteDashboard /> : <MarketingLanding />;
}
