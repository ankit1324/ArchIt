"use client"; // Error boundaries must be Client Components

import Link from "next/link";
import { useEffect } from "react";

const FOCUS = "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent";

// Renders inside the admin layout's <main> (error.tsx does not wrap its own
// segment's layout), so it brings an h1 but no landmark or brand bar. Next
// 16.4 passes `retry`; `error` is whatever was thrown, not always an Error.
export default function AdminError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const digest =
    error instanceof globalThis.Error && "digest" in error && typeof error.digest === "string"
      ? error.digest
      : null;

  return (
    <div className="max-w-xl py-6">
      <p className="flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-soft">
        <span className="size-1.5 flex-none rounded-full bg-accent" aria-hidden="true" />
        Admin error
      </p>
      <h1 className="mt-3 font-display text-[clamp(28px,4vw,40px)] font-normal leading-[1.1] tracking-[-0.03em]">
        This page didn’t load.
      </h1>
      <p className="mt-4 text-[15px] leading-[1.8] text-ink-soft">
        A query or a Clerk call failed. Try again; if it keeps failing, check the server logs.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className={`inline-flex min-h-11 items-center gap-6 rounded-[5px] bg-accent px-5 py-3 text-[13px] font-semibold text-paper transition-colors hover:bg-accent-deep ${FOCUS}`}
        >
          Try again <span aria-hidden="true">↻</span>
        </button>
        <Link
          href="/admin"
          className={`inline-flex min-h-11 items-center rounded-[5px] border border-line-strong px-5 py-3 text-[13px] font-semibold transition-colors hover:border-ink ${FOCUS}`}
        >
          Back to overview
        </Link>
      </div>
      {digest && (
        <p className="mt-8 border-t border-line pt-4 text-[14px] text-ink-soft">
          Reference <code className="font-mono tabular-nums">{digest}</code>
        </p>
      )}
    </div>
  );
}
