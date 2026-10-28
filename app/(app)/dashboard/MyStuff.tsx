import Link from "next/link";
import type { MeSummary, MyListing } from "@/lib/me";
import {
  designsSummary,
  listingMapHref,
  listingPriceLabel,
  listingPublicHref,
  listingStatusView,
  listingsSummary,
  listingTitle,
  type ListingTone,
} from "./listing-status";

// Server-renderable, presentational only: lib/me.ts fetches, page.tsx passes
// the summary down through SuiteDashboard. No hooks, so it needs no client JS.

// Chip fills are tokens with AA text on them: ink on highlight is 9.4:1, and
// accent-deep stays above 4.5:1 on the warm card tint.
const TONE_CLASS: Record<ListingTone, string> = {
  live: "bg-highlight text-ink",
  review: "border border-line-strong bg-paper text-ink",
  rejected: "bg-[#eee5d9] text-accent-deep",
};

const DOT_CLASS: Record<ListingTone, string> = {
  live: "bg-forest",
  review: "bg-line-strong",
  rejected: "bg-accent",
};

const FOCUS =
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent";
const EYEBROW =
  "text-[11px] font-bold uppercase leading-[1.8] tracking-[0.14em] text-ink-soft";
// Secondary on purpose: the dashboard's one primary CTA is the Find tile.
const ACTION = `inline-flex min-h-11 items-center justify-center gap-4 rounded-[5px] border border-line-strong px-5 py-3 text-[13px] font-semibold text-ink transition-colors hover:border-ink ${FOCUS}`;
// min-h-6: WCAG 2.5.8 target size for standalone text links
const TEXT_LINK = `inline-flex min-h-6 items-center gap-1.5 rounded-[3px] text-[13px] font-semibold text-accent underline underline-offset-4 hover:text-accent-deep ${FOCUS}`;
const CARD_TITLE = "font-display text-[24px] font-normal leading-tight tracking-[-0.02em]";

function StatusBadge({ tone, label }: { tone: ListingTone; label: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold ${TONE_CLASS[tone]}`}
    >
      <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${DOT_CLASS[tone]}`} />
      {label}
    </span>
  );
}

function ListingRow({ l }: { l: MyListing }) {
  const view = listingStatusView(l.status, l.reviewNote);
  const where = [l.buildingName ? l.address : null, l.city].filter(Boolean).join(", ");
  return (
    <li className="flex flex-col gap-2.5 py-5 first:pt-0 last:pb-0 sm:grid sm:grid-cols-[1fr_auto] sm:gap-x-8">
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-3 sm:justify-start">
          <p className="min-w-0 truncate text-[16px] font-semibold text-ink">{listingTitle(l)}</p>
          <StatusBadge tone={view.tone} label={view.label} />
        </div>
        {where && <p className="mt-0.5 truncate text-[14px] text-ink-soft">{where}</p>}
        <p className="mt-2 text-[14px] leading-[1.7] text-ink-soft">{view.help}</p>
        {view.note && (
          <p className="mt-3 border-l-2 border-accent bg-[#eee5d9] px-3.5 py-2.5 text-[14px] leading-[1.7] text-ink">
            <span className="font-bold">Reviewer&apos;s note: </span>
            {view.note}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
          <Link href={listingMapHref(l.id)} className={TEXT_LINK}>
            {view.tone === "rejected" ? "Open on the map to edit" : "Open on the map"}
            <span aria-hidden="true">→</span>
          </Link>
          {view.isPublic && (
            <Link href={listingPublicHref(l.id)} className={TEXT_LINK}>
              Public page
              <span aria-hidden="true">↗</span>
            </Link>
          )}
        </div>
      </div>
      <p className="order-first text-[15px] font-semibold tabular-nums text-ink sm:order-none sm:text-right">
        {listingPriceLabel(l.price, l.type)}
      </p>
    </li>
  );
}

function LoadError() {
  return (
    <p className="rounded-[5px] border border-accent/40 bg-paper px-4 py-3 text-[14px] font-medium text-accent">
      We couldn&apos;t load this right now. Refresh to try again.
    </p>
  );
}

function EmptyState({ children, href, cta }: { children: React.ReactNode; href: string; cta: string }) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-[5px] border border-dashed border-line-strong p-5">
      <p className="text-[14px] leading-[1.75] text-ink-soft">{children}</p>
      <Link href={href} className={ACTION}>
        {cta}
      </Link>
    </div>
  );
}

/** "My listings" + "My designs": what the user has made and where it stands. */
export default function MyStuff({ me }: { me: MeSummary }) {
  const { listings, listingsTotal, designsTotal, listingsError, designsError } = me;
  const hasListings = listings.length > 0;
  return (
    <section
      aria-labelledby="my-stuff-heading"
      className="mx-auto w-full max-w-[1400px] px-[clamp(20px,5.5vw,84px)] pb-12 lg:pb-[72px]"
    >
      <div className="border-t border-line pt-12 lg:pt-[72px]">
        <p className={EYEBROW}>02 / Saved to your account</p>
        <h2
          id="my-stuff-heading"
          className="mt-3 font-display text-[32px] font-normal leading-[1.15] tracking-[-0.03em] text-ink sm:text-[40px]"
        >
          Your activity
        </h2>

        <div className="mt-8 grid gap-[18px] lg:grid-cols-3">
          <article className="flex min-w-0 flex-col gap-5 rounded-[5px] border border-line bg-paper-soft p-6 sm:p-7 lg:col-span-2">
            <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line-strong/50 pb-4">
              <h3 className={CARD_TITLE}>My listings</h3>
              {hasListings && (
                <p className="text-[14px] font-semibold tabular-nums text-ink-soft">
                  {listingsSummary(listings.map((l) => l.status))}
                </p>
              )}
            </header>

            {hasListings ? (
              <>
                <ul className="divide-y divide-line">
                  {listings.map((l) => (
                    <ListingRow key={l.id} l={l} />
                  ))}
                </ul>
                {listingsTotal > listings.length && (
                  <p className="text-[14px] tabular-nums text-ink-soft">
                    Showing your {listings.length} most recent of {listingsTotal} listings.
                  </p>
                )}
                {listingsError && <LoadError />}
                <Link href="/find" className={`${ACTION} self-start`}>
                  List another property
                </Link>
              </>
            ) : listingsError ? (
              <LoadError />
            ) : (
              <EmptyState href="/find" cta="List your first property — free">
                You haven&apos;t listed anything yet. Drop a pin on the 3D map, add photos and a
                price — we review each listing before it goes live, and you&apos;ll see its status
                right here.
              </EmptyState>
            )}
          </article>

          <article className="flex min-w-0 flex-col gap-5 rounded-[5px] border border-line bg-[#e7ece4] p-6 sm:p-7">
            <header className="border-b border-line-strong/50 pb-4">
              <h3 className={CARD_TITLE}>My designs</h3>
            </header>
            {designsTotal > 0 ? (
              <>
                <p className="font-display text-[56px] font-normal leading-none tracking-[-0.04em] tabular-nums text-ink">
                  {designsTotal}
                </p>
                <p className="text-[14px] text-ink-soft">
                  {designsSummary(designsTotal)} in the 3D Builder.
                </p>
                <Link href="/designer" className={`${ACTION} mt-auto self-start`}>
                  Open the Builder
                  <span aria-hidden="true">→</span>
                </Link>
              </>
            ) : designsError ? (
              <LoadError />
            ) : (
              <EmptyState href="/designer" cta="Start a design">
                No designs yet. Sketch a house floor by floor and save every idea.
              </EmptyState>
            )}
          </article>
        </div>
      </div>
    </section>
  );
}
