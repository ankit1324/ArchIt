import { auth } from "@clerk/nextjs/server";
import SuiteDashboard from "@/components/SuiteDashboard";
import { getMySummary } from "@/lib/me";
import type { Metadata } from "next";

// Signed-in home. proxy.ts rewrites "/" here for signed-in visitors, so the
// URL stays "/" while the public landing page remains a static prerender.
export const metadata: Metadata = {
  title: "Your ArchIt suite",
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  // proxy.ts already requires a session here; the userId only ever comes from
  // Clerk, so getMySummary can't be pointed at someone else's rows.
  const { userId } = await auth();
  // getMySummary never throws: a DB failure shows an inline error state and
  // leaves the product cards working.
  const me = userId ? await getMySummary(userId) : null;
  return <SuiteDashboard me={me} />;
}
