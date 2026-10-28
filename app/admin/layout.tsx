import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { LogoMark } from "@/components/icons";
import { isAdmin } from "@/lib/admin";
import AdminNav from "./AdminNav";
import { focus, link } from "./ui";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · ArchIt" },
  robots: { index: false, follow: false },
};

// The gate lives here so a non-admin gets the site's plain 404, not this shell
// around it. Pages and /api/admin routes still check for themselves.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!(await isAdmin(userId))) notFound();
  // The document scrolls (no inner h-full scroller): each page supplies its
  // own h1 via PageHeader, so the brand here is a link, not a heading.
  return (
    <div className="min-h-full bg-paper text-ink">
      <header className="border-b border-line">
        <div className="mx-auto flex min-h-16 max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 pt-3 sm:px-6">
          <Link
            href="/admin"
            aria-label="ArchIt admin, overview"
            className={`flex items-center gap-2 rounded-[5px] text-[22px] font-extrabold tracking-[-0.055em] ${focus}`}
          >
            <LogoMark width={23} height={23} className="text-accent" aria-hidden="true" />
            <span>
              ArchIt<span className="text-accent">.</span>
            </span>
            <span className="ml-1 rounded-full border border-line-strong px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-soft">
              Admin
            </span>
          </Link>
          <Link href="/find" className={`${link} text-[13px] font-semibold`}>
            Back to the map <span aria-hidden="true" className="ml-1">↗</span>
          </Link>
        </div>
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <AdminNav />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">{children}</main>
    </div>
  );
}
