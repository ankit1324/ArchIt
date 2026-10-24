import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { isAdmin } from "@/lib/admin";
import AdminNav from "./AdminNav";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · ArchIt" },
  robots: { index: false, follow: false },
};

// The gate lives here so a non-admin gets the site's plain 404, not this shell
// around it. Pages and /api/admin routes still check for themselves.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!(await isAdmin(userId))) notFound();
  return (
    <div className="h-full overflow-y-auto bg-cream text-plum">
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex items-baseline justify-between gap-4">
          <Link href="/admin" className="text-3xl font-extrabold tracking-wide">
            Admin
          </Link>
          <Link href="/find" className="text-[14px] font-semibold underline">
            Back to the map
          </Link>
        </div>
        <AdminNav />
        {children}
      </main>
    </div>
  );
}
