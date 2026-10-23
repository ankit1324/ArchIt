"use client";

import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

/** Navbar auth slot inside the app, where ClerkProvider is mounted. */
export default function ClerkNavAuth() {
  return (
    <>
      <Show when="signed-out">
        <SignInButton mode="modal">
          <button className="rounded-full px-4 py-2 text-[13px] font-bold text-plum transition-colors hover:text-plum-soft">
            Sign In
          </button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button className="rounded-full bg-white px-5 py-2 text-[13px] font-bold text-plum shadow-sm transition-shadow hover:shadow-md">
            Sign Up
          </button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>
    </>
  );
}
