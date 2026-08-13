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
    <div className="flex h-full min-h-screen items-center justify-center bg-cream px-6">
      <div className="glass w-full max-w-sm rounded-3xl p-8 text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-coral/15 text-2xl">
          ⚠️
        </div>
        <h2 className="text-lg font-extrabold text-plum">
          Something went wrong
        </h2>
        <p className="mt-2 text-[13.5px] font-medium text-plum-soft">
          We hit an unexpected snag loading this page. Try again, or head
          back home.
        </p>
        <div className="mt-6 flex flex-col gap-2.5">
          <button
            onClick={() => unstable_retry()}
            className="rounded-full bg-plum py-2.5 text-[13px] font-bold text-cream transition-opacity hover:opacity-90"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-full bg-white/55 py-2.5 text-[13px] font-bold text-plum transition-colors hover:bg-white/85"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
