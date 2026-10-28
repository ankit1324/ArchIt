"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useClerkPresent } from "./ClerkPresence";

// Split into its own chunk so pages outside the app group never download Clerk.
const ClerkNavAuth = dynamic(() => import("./ClerkNavAuth"));

// Same classes as ClerkNavAuth. Duplicated rather than shared: importing them
// from ClerkNavAuth would pull that chunk (and Clerk) into every public page.
const SIGN_UP =
  "hidden min-h-6 items-center rounded-[3px] text-[12.5px] font-semibold text-ink transition-colors hover:text-accent focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent sm:inline-flex";
const SIGN_IN =
  "inline-flex min-h-10 items-center gap-3 rounded-[5px] border border-line-strong px-4 text-[12.5px] font-semibold text-ink transition-colors hover:border-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent";

/**
 * Inside the app: Clerk's modal buttons / UserButton. On public pages: plain
 * links to the hosted sign-in screens, which cost no JS and work on first
 * click (a modal button is dead until Clerk's ~160KB bundle has loaded).
 */
export default function NavAuth() {
  if (useClerkPresent()) return <ClerkNavAuth />;
  return (
    <>
      {/* Hidden on phones to keep the bar to logo + sign in + menu; the
          sign-in screen links to sign-up. */}
      <Link href="/sign-up" prefetch={false} className={SIGN_UP}>
        Sign up
      </Link>
      <Link href="/sign-in" prefetch={false} className={SIGN_IN}>
        Sign in <span aria-hidden="true">↗</span>
      </Link>
    </>
  );
}
