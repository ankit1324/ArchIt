"use client";

import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

// Keep in step with the link classes in NavAuth.tsx.
const SIGN_UP =
  "hidden min-h-6 items-center rounded-[3px] text-[12.5px] font-semibold text-ink transition-colors hover:text-accent focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent sm:inline-flex";
const SIGN_IN =
  "inline-flex min-h-10 items-center gap-3 rounded-[5px] border border-line-strong px-4 text-[12.5px] font-semibold text-ink transition-colors hover:border-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** Navbar auth slot inside the app, where ClerkProvider is mounted. */
export default function ClerkNavAuth() {
  return (
    <>
      <Show when="signed-out">
        <SignUpButton mode="modal">
          <button type="button" className={SIGN_UP}>
            Sign up
          </button>
        </SignUpButton>
        <SignInButton mode="modal">
          <button type="button" className={SIGN_IN}>
            Sign in <span aria-hidden="true">↗</span>
          </button>
        </SignInButton>
      </Show>
      <Show when="signed-in">
        {/* min box keeps the avatar a 32px target inside the 64px app bar */}
        <span className="flex min-h-8 min-w-8 items-center justify-center">
          <UserButton />
        </span>
      </Show>
    </>
  );
}
