import SuiteDashboard from "@/components/SuiteDashboard";
import type { Metadata } from "next";

// Signed-in home. proxy.ts rewrites "/" here for signed-in visitors, so the
// URL stays "/" while the public landing page remains a static prerender.
export const metadata: Metadata = {
  title: "Your ArchIt suite",
  robots: { index: false, follow: false },
};

export default function DashboardPage() {
  return <SuiteDashboard />;
}
