"use client"; // Error boundaries must be Client Components

import Link from "next/link";
import { useEffect } from "react";
import { LogoMark } from "@/components/icons";

const FOCUS =
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent";

// Boundary for the signed-in app (Find, the Designer, the dashboard). It sits
// inside app/(app)/layout.tsx, so a crash in one tool keeps ClerkProvider and
// the session mounted, and `retry` re-renders just this segment. The root
// app/error.tsx still covers everything outside the group.
export default function AppError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    // No external error-reporting service is wired up yet — console only.
    console.error(error);
  }, [error]);

  const digest =
    error instanceof Error && "digest" in error && typeof error.digest === "string"
      ? error.digest
      : null;

  return (
    <div className="flex min-h-full flex-col bg-paper text-ink">
      {/* Brand bar only, not <Navbar/>: the header itself may be what threw. */}
      <header className="border-b border-line">
        <div className="flex h-16 items-center px-4 sm:px-6">
          <Link
            href="/"
            aria-label="ArchIt home"
            className={`flex items-center gap-2 rounded-[5px] text-[21px] font-extrabold tracking-[-0.04em] ${FOCUS}`}
          >
            <LogoMark width={22} height={22} className="text-accent" aria-hidden="true" />
            <span>
              ArchIt<span className="text-accent">.</span>
            </span>
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center px-[clamp(20px,5.5vw,84px)] py-16">
        <div className="mx-auto w-full max-w-xl">
          <p className="flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-soft">
            <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
            Unexpected error
          </p>
          <h1 className="mt-5 font-display text-[clamp(36px,6vw,52px)] font-normal leading-[1.08] tracking-[-0.035em]">
            This tool stopped working.
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-[1.8] text-ink-soft">
            Something went wrong while loading this part of ArchIt. Try again,
            or go back to your dashboard.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => retry()}
              className={`inline-flex min-h-11 items-center gap-6 rounded-[5px] bg-accent px-5 py-3 text-[13px] font-semibold text-paper transition-colors hover:bg-accent-deep ${FOCUS}`}
            >
              Try again <span aria-hidden="true">↻</span>
            </button>
            <Link
              href="/dashboard"
              className={`inline-flex min-h-11 items-center rounded-[5px] border border-line-strong px-5 py-3 text-[13px] font-semibold transition-colors hover:border-ink ${FOCUS}`}
            >
              Go to dashboard
            </Link>
            <Link
              href="/"
              className={`ml-2 inline-flex min-h-6 items-center rounded-[3px] text-[13px] font-semibold underline underline-offset-4 transition-colors hover:text-accent ${FOCUS}`}
            >
              Back to home
            </Link>
          </div>
          {digest && (
            <p className="mt-10 border-t border-line pt-4 text-[13px] text-ink-soft">
              Reference <code className="font-mono tabular-nums">{digest}</code>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
