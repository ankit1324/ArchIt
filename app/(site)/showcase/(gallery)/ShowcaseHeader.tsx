import Link from "next/link";

// Shared by page.tsx and loading.tsx so the header never moves when the
// gallery streams in. The designer link is always rendered at the same size;
// only its weight changes: primary over a gallery, outlined when the empty
// state below carries the page's one primary CTA (or while loading/erroring).

export const FOCUS =
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent";
export const EYEBROW = "text-[11px] font-bold uppercase tracking-[0.14em] text-ink-soft";
export const PRIMARY = `inline-flex min-h-11 items-center justify-center gap-6 rounded-[5px] border border-accent bg-accent px-5 py-3 text-[13px] font-semibold text-paper transition-colors hover:border-accent-deep hover:bg-accent-deep ${FOCUS}`;
export const SECONDARY = `inline-flex min-h-11 items-center justify-center gap-6 rounded-[5px] border border-line-strong px-5 py-3 text-[13px] font-semibold text-ink transition-colors hover:border-ink ${FOCUS}`;

export default function ShowcaseHeader({ primary }: { primary: boolean }) {
  return (
    <header className="flex flex-col gap-6 border-b border-line pb-10 md:flex-row md:items-end md:justify-between md:gap-12">
      <div>
        <p className={`flex items-center gap-2 ${EYEBROW}`}>
          <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-accent" />
          The ArchIt showcase
        </p>
        <h1 className="mt-4 font-display text-[40px] font-normal leading-[1.08] tracking-[-0.035em] sm:text-[56px]">
          Homes designed in 3D.
        </h1>
      </div>
      <div className="md:max-w-[400px]">
        <p className="text-[15px] leading-[1.8] text-ink-soft">
          Homes designed by the ArchIt community. Open one to walk around it in 3D.
        </p>
        <Link href="/designer" prefetch={false} className={`mt-5 ${primary ? PRIMARY : SECONDARY}`}>
          Design your own <span aria-hidden>↗</span>
        </Link>
      </div>
    </header>
  );
}
