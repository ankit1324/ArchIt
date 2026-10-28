"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/inbox", label: "Inbox" },
  { href: "/admin/listings", label: "Listings" },
  { href: "/admin/designs", label: "Designs" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/log", label: "Audit log" },
];

export default function AdminNav() {
  const path = usePathname();
  return (
    // scrolls sideways on narrow screens instead of wrapping into a second row
    <nav aria-label="Admin sections" className="no-scrollbar -mb-px mt-2 flex gap-6 overflow-x-auto">
      {TABS.map((t) => {
        // whole-segment match, so /admin/log doesn't also light up for /admin/logins
        const active =
          t.href === "/admin" ? path === "/admin" : path === t.href || path.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-11 flex-none items-center border-b-2 text-[13px] font-semibold transition-colors focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-accent ${
              active ? "border-accent text-ink" : "border-transparent text-ink-soft hover:border-line-strong hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
