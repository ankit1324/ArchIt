"use client"; // Error boundaries must be Client Components

import Link from "next/link";
import { useEffect } from "react";

export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // No external error-reporting service is wired up yet — console only.
    console.error(error);
  }, [error]);

  return (
    // <main> + <h1>: this replaces the whole page, so it carries the page's
    // landmark and top heading. overflow-y-auto because body is overflow:hidden.
    <main className="flex h-full min-h-screen items-center justify-center overflow-y-auto bg-cream px-6 py-10">
      <div className="glass w-full max-w-sm rounded-3xl p-8 text-center">
        <div
          className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-coral/15 text-2xl"
          aria-hidden="true"
        >
          ⚠️
        </div>
        <h1 className="text-lg font-extrabold text-plum">
          Something went wrong
        </h1>
        <p className="mt-2 text-[13.5px] font-medium text-plum-soft">
          We hit an unexpected snag loading this page. Try again, or head
          back home.
        </p>
        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => unstable_retry()}
            className="min-h-11 rounded-full bg-plum py-2.5 text-[13px] font-bold text-cream transition-opacity hover:opacity-90 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-plum"
          >
            Try again
          </button>
          <Link
            href="/"
            className="flex min-h-11 items-center justify-center rounded-full bg-white/55 py-2.5 text-[13px] font-bold text-plum transition-colors hover:bg-white/85 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-plum"
          >
            Back to home
          </Link>
          <Link
            href="/find"
            className="flex min-h-11 items-center justify-center rounded-full py-2.5 text-[13px] font-bold text-plum-soft underline-offset-4 transition-colors hover:text-plum hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-plum"
          >
            Explore the map
          </Link>
        </div>
      </div>
    </main>
  );
}
