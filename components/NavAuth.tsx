"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useClerkPresent } from "./ClerkPresence";

// Split into its own chunk so pages outside the app group never download Clerk.
const ClerkNavAuth = dynamic(() => import("./ClerkNavAuth"));

/**
 * Inside the app: Clerk's modal buttons / UserButton. On public pages: plain
 * links to the hosted sign-in screens, which cost no JS and work on first
 * click (a modal button is dead until Clerk's ~160KB bundle has loaded).
 */
export default function NavAuth() {
  if (useClerkPresent()) return <ClerkNavAuth />;
  return (
    <>
      <Link
        href="/sign-in"
        prefetch={false}
        className="rounded-full px-4 py-2 text-[13px] font-bold text-plum transition-colors hover:text-plum-soft"
      >
        Sign In
      </Link>
      <Link
        href="/sign-up"
        prefetch={false}
        className="rounded-full bg-white px-5 py-2 text-[13px] font-bold text-plum shadow-sm transition-shadow hover:shadow-md"
      >
        Sign Up
      </Link>
    </>
  );
}
