import Link from "next/link";
import { EYEBROW, PRIMARY } from "./ShowcaseHeader";

// What visitors see until the first design is published (production has none
// yet), so it doubles as the showcase's pitch: an empty plot drawn in the
// landing's planner style, the three steps to fill it, and the route into the
// designer. Signed-out visitors go through sign-in on the way (proxy.ts).

const STEPS = [
  { title: "Set up your plot.", body: "Enter its width and depth, and choose your floors." },
  { title: "Arrange your rooms.", body: "Start from a template or add rooms yourself, then explore it in 2D and 3D." },
  { title: "Publish it here.", body: "Save the design, then choose Publish on it in your saved designs." },
];

/** An empty, dashed-out plot: the space a first published design would take. */
function EmptyPlot() {
  return (
    <svg viewBox="0 0 600 420" role="img" aria-label="Illustration of an empty plot marked “your home here”." className="block w-full">
      <defs>
        <pattern id="showcase-grid" width="22" height="22" patternUnits="userSpaceOnUse">
          <path d="M22 0H0V22" fill="none" className="stroke-line" strokeWidth=".6" />
        </pattern>
      </defs>
      <rect width="600" height="420" fill="url(#showcase-grid)" />
      {/* dimension lines */}
      <g fill="none" className="stroke-line-strong" strokeWidth="1">
        <path d="M90 50H510M90 44V56M510 44V56M540 80V350M534 80H546M534 350H546" />
      </g>
      <g className="fill-ink-soft" fontSize="10" letterSpacing="3" textAnchor="middle">
        <text x="300" y="38">WIDTH</text>
        <text x="562" y="215" transform="rotate(90 562 215)">DEPTH</text>
      </g>
      {/* the plot, still empty */}
      <rect x="90" y="80" width="420" height="270" className="fill-paper stroke-ink" strokeWidth="2" strokeDasharray="10 7" />
      {/* where a home could go */}
      <path d="M170 130H430V300H300V230H170Z" fill="none" className="stroke-accent" strokeWidth="1.5" strokeDasharray="4 5" />
      <path d="M300 158V174M292 166H308" className="stroke-accent" strokeWidth="1.5" />
      <text x="300" y="206" textAnchor="middle" fontSize="11" letterSpacing="3" className="fill-accent">YOUR HOME HERE</text>
      {/* garden and north arrow */}
      <g className="fill-highlight stroke-highlight-deep">
        <circle cx="122" cy="318" r="15" />
        <circle cx="148" cy="326" r="10" />
        <circle cx="476" cy="112" r="13" />
      </g>
      <path d="M560 395V372L556 381M560 372L564 381" fill="none" className="stroke-ink" />
      <text x="560" y="410" fontSize="9" textAnchor="middle" className="fill-ink">N</text>
    </svg>
  );
}

export default function EmptyShowcase() {
  return (
    <section aria-labelledby="empty-title" className="grid items-center gap-10 pt-12 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pt-16">
      <figure className="m-0 border border-line bg-paper-soft p-4 sm:p-[18px] lg:-rotate-1">
        <div className="flex justify-between gap-4 border-b border-line pb-3 text-[11px] tracking-[0.08em] text-ink-soft">
          <span>THE SHOWCASE</span>
          <span>FIG. 00</span>
        </div>
        <EmptyPlot />
        <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-line pt-3 text-[11px] text-ink-soft">
          <span className="font-display text-[16px] text-ink">Room for the first design.</span>
          <span>Illustrative · Not to scale</span>
        </figcaption>
      </figure>

      <div>
        <p className={EYEBROW}>Nothing published yet</p>
        <h2 id="empty-title" className="mt-4 font-display text-[32px] font-normal leading-[1.15] tracking-[-0.03em] sm:text-[42px]">
          The first home here could be yours.
        </h2>
        <p className="mt-4 max-w-[440px] text-[15px] leading-[1.8] text-ink-soft">
          Design a home and publish it to be the first one here. Anyone can open a published
          design and walk around it in 3D.
        </p>
        <ol className="mt-8 border-t border-line">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-6 border-b border-line py-4">
              <span className="pt-0.5 text-[11px] tabular-nums text-accent" aria-hidden>
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 className="text-[15px] font-semibold">{step.title}</h3>
                <p className="mt-1 text-[14px] leading-[1.7] text-ink-soft">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link href="/designer" prefetch={false} className={PRIMARY}>
            Open the designer <span aria-hidden>↗</span>
          </Link>
          <span className="text-[14px] text-ink-soft">You need an account to create and save designs.</span>
        </div>
      </div>
    </section>
  );
}
