"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/inbox", label: "Inbox" },
  { href: "/admin/listings", label: "Listings" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/log", label: "Audit log" },
];

export default function AdminNav() {
  const path = usePathname();
  return (
    <nav aria-label="Admin sections" className="mt-4 flex flex-wrap gap-2">
      {TABS.map((t) => {
        // whole-segment match, so /admin/log doesn't also light up for /admin/logins
        const active =
          t.href === "/admin" ? path === "/admin" : path === t.href || path.startsWith(`${t.href}/`);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-4 py-1.5 text-[13px] font-bold transition-colors ${
              active ? "bg-plum text-cream" : "bg-white/70 text-plum hover:bg-white"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
