import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/Footer";
import Navbar from "@/components/Navbar";

// Root not-found: unmatched URLs and every notFound() (e.g. a removed
// /property/:id). Next adds <meta name="robots" content="noindex"> itself.
export const metadata: Metadata = {
  title: "Page not found",
};

const FOCUS =
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** A small plan with one room left undrawn: the page that isn't there. */
function MissingRoom() {
  return (
    <svg viewBox="0 0 320 220" className="block w-full" aria-hidden="true">
      <defs>
        <pattern id="nf-grid" width="16" height="16" patternUnits="userSpaceOnUse">
          <path d="M16 0H0V16" fill="none" className="stroke-line" strokeWidth=".6" />
        </pattern>
      </defs>
      <rect width="320" height="220" fill="url(#nf-grid)" />
      <g fill="none" className="stroke-ink" strokeLinecap="square">
        <path d="M40 40H190V180H40Z" strokeWidth="5" />
        <path d="M40 112H120M150 112H190M120 40V82" strokeWidth="3.5" />
      </g>
      <path d="M190 40H280V180H190" fill="none" className="stroke-accent" strokeWidth="1.6" strokeDasharray="6 6" />
      <text x="235" y="116" textAnchor="middle" className="fill-accent" fontSize="22" fontFamily="Georgia, serif">
        404
      </text>
      <g className="fill-ink-soft" fontSize="8" letterSpacing="1.4" textAnchor="middle" fontFamily="sans-serif">
        <text x="80" y="80">REST</text>
        <text x="115" y="152">LIVE</text>
        <text x="235" y="136">MISSING</text>
      </g>
    </svg>
  );
}

export default function NotFound() {
  return (
    <div className="flex min-h-full flex-col bg-paper text-ink">
      <Navbar />
      <main className="mx-auto grid w-full max-w-[1400px] flex-1 items-center gap-12 px-[clamp(20px,5.5vw,84px)] py-14 md:grid-cols-[1fr_1fr] md:py-20">
        <div>
          <p className="flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-soft">
            <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
            Error 404 · Page not found
          </p>
          <h1 className="mt-5 font-display text-[clamp(38px,5.5vw,64px)] font-normal leading-[1.08] tracking-[-0.04em]">
            This room isn&apos;t <em className="text-accent">on the plan.</em>
          </h1>
          <p className="mt-6 max-w-md text-[15px] leading-[1.8] text-ink-soft">
            The page you were looking for has moved, was taken down, or never
            existed. Listings that are sold or removed disappear from the map too.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/"
              className={`inline-flex min-h-11 items-center gap-6 rounded-[5px] bg-accent px-5 py-3 text-[13px] font-semibold text-paper transition-colors hover:bg-accent-deep ${FOCUS}`}
            >
              Back to home <span aria-hidden="true">↗</span>
            </Link>
            <Link
              href="/find"
              className={`inline-flex min-h-11 items-center rounded-[5px] border border-line-strong px-5 py-3 text-[13px] font-semibold transition-colors hover:border-ink ${FOCUS}`}
            >
              Explore the map
            </Link>
          </div>
        </div>
        <figure className="m-0 border border-line bg-paper-soft p-4 md:-rotate-1">
          <MissingRoom />
          <figcaption className="mt-3 flex justify-between gap-4 border-t border-line pt-3 text-[13px] text-ink-soft">
            <span className="font-display text-[15px] text-ink">Room to grow.</span>
            <span>Fig. 404</span>
          </figcaption>
        </figure>
      </main>
      <Footer />
    </div>
  );
}
