"use client";

import Link from "next/link";
import { track } from "@/lib/analytics";

/**
 * Plain link that records a landing_cta_click funnel step. Sign-in/up targets
 * are real navigations, not Clerk modal buttons, so the first click works
 * before any auth JS has loaded.
 */
export default function TrackedLink({
  href,
  cta,
  className,
  children,
}: {
  href: string;
  cta: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={className}
      onClick={() => track("landing_cta_click", { cta, target: href.split("?")[0] })}
    >
      {children}
    </Link>
  );
}
