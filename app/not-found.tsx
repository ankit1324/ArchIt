import type { Metadata } from "next";
import Link from "next/link";
import { LogoMark } from "@/components/icons";

// Root not-found: unmatched URLs and every notFound() (e.g. a removed
// /property/:id). Next adds <meta name="robots" content="noindex"> itself.
export const metadata: Metadata = {
  title: "Page not found",
};

export default function NotFound() {
  return (
    // h-full + overflow-y-auto: body is overflow:hidden (globals.css), so the
    // page must scroll itself on short / landscape phones.
    <main className="flex h-full min-h-screen flex-col items-center justify-center overflow-y-auto bg-cream px-6 py-10 text-plum">
      <Link
        href="/"
        className="mb-8 flex min-h-11 items-center gap-2 rounded-lg px-2 text-plum focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-plum"
      >
        <LogoMark width={28} height={28} aria-hidden="true" />
        <span className="text-lg font-extrabold tracking-wide">ArchIt</span>
      </Link>
      <div className="glass w-full max-w-md rounded-3xl p-8 text-center">
        <p className="text-5xl font-extrabold tracking-tight text-coral" aria-hidden="true">
          404
        </p>
        <h1 className="mt-3 text-xl font-extrabold text-plum">This room isn&apos;t on the plan</h1>
        <p className="mt-2 text-[14px] font-medium leading-relaxed text-plum-soft">
          The page you were looking for has moved, was taken down, or never
          existed. Listings that are sold or removed disappear from the map too.
        </p>
        <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
          <Link
            href="/"
            className="flex min-h-11 flex-1 items-center justify-center rounded-full bg-plum px-4 text-[13.5px] font-bold text-cream transition-opacity hover:opacity-90 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-plum"
          >
            Back to home
          </Link>
          <Link
            href="/find"
            className="flex min-h-11 flex-1 items-center justify-center rounded-full border border-plum/20 bg-white/60 px-4 text-[13.5px] font-bold text-plum transition-colors hover:bg-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-plum"
          >
            Explore the map
          </Link>
        </div>
      </div>
    </main>
  );
}
