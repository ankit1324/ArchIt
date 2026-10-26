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

const TONE_CLASS: Record<ListingTone, string> = {
  live: "bg-lime text-plum",
  review: "bg-lavender/25 text-plum",
  rejected: "bg-coral/15 text-plum",
};

const DOT_CLASS: Record<ListingTone, string> = {
  live: "bg-plum",
  review: "bg-lavender",
  rejected: "bg-coral",
};

const PRIMARY_CTA =
  "inline-flex items-center justify-center rounded-full bg-plum px-5 py-2.5 text-[13px] font-bold text-cream transition-opacity hover:opacity-90";
const SECONDARY_LINK =
  "text-[12.5px] font-bold text-magenta-deep underline-offset-4 hover:underline";

function StatusBadge({ tone, label }: { tone: ListingTone; label: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-bold ${TONE_CLASS[tone]}`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${DOT_CLASS[tone]}`} />
      {label}
    </span>
  );
}

function ListingRow({ l }: { l: MyListing }) {
  const view = listingStatusView(l.status, l.reviewNote);
  const where = [l.buildingName ? l.address : null, l.city].filter(Boolean).join(", ");
  return (
    <li className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold text-plum">{listingTitle(l)}</p>
          {where && <p className="truncate text-[12.5px] font-medium text-plum-soft">{where}</p>}
        </div>
        <StatusBadge tone={view.tone} label={view.label} />
      </div>
      <p className="text-[14px] font-bold text-plum">{listingPriceLabel(l.price, l.type)}</p>
      <p className="text-[12.5px] font-medium leading-relaxed text-plum-soft">{view.help}</p>
      {view.note && (
        <p className="rounded-2xl border border-coral/30 bg-coral/5 px-3.5 py-2.5 text-[12.5px] font-medium leading-relaxed text-plum">
          <span className="font-bold">Reviewer&apos;s note: </span>
          {view.note}
        </p>
      )}
      <div className="flex flex-wrap gap-x-5 gap-y-1">
        <Link href={listingMapHref(l.id)} className={SECONDARY_LINK}>
          {view.tone === "rejected" ? "Open on the map to edit →" : "Open on the map →"}
        </Link>
        {view.isPublic && (
          <Link href={listingPublicHref(l.id)} className={SECONDARY_LINK}>
            Public page ↗
          </Link>
        )}
      </div>
    </li>
  );
}

function LoadError() {
  return (
    <p className="rounded-2xl bg-coral/10 px-4 py-3 text-[13px] font-medium text-plum">
      We couldn&apos;t load this right now. Refresh to try again.
    </p>
  );
}

/** "My listings" + "My designs": what the user has made and where it stands. */
export default function MyStuff({ me }: { me: MeSummary }) {
  const { listings, listingsTotal, designsTotal, listingsError, designsError } = me;
  const hasListings = listings.length > 0;
  return (
    <section aria-labelledby="my-stuff-heading" className="mt-16 lg:mt-24">
      <h2
        id="my-stuff-heading"
        className="mb-5 text-[28px] leading-tight text-plum"
        style={{ fontFamily: "var(--font-fraunces)" }}
      >
        Your activity
      </h2>

      <div className="grid gap-5 lg:grid-cols-3">
        <article className="glass flex min-w-0 flex-col gap-4 rounded-[28px] p-6 shadow-lg sm:p-7 lg:col-span-2">
          <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h3 className="text-[18px] font-bold text-plum">My listings</h3>
            {hasListings && (
              <p className="text-[12.5px] font-semibold text-plum-soft">
                {listingsSummary(listings.map((l) => l.status))}
              </p>
            )}
          </header>

          {hasListings ? (
            <>
              <ul className="divide-y divide-plum/10">
                {listings.map((l) => (
                  <ListingRow key={l.id} l={l} />
                ))}
              </ul>
              {listingsTotal > listings.length && (
                <p className="text-[12px] font-medium text-plum-soft">
                  Showing your {listings.length} most recent of {listingsTotal} listings.
                </p>
              )}
              {listingsError && <LoadError />}
              <Link href="/find" className={`${PRIMARY_CTA} self-start`}>
                List another property
              </Link>
            </>
          ) : listingsError ? (
            <LoadError />
          ) : (
            <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-plum/20 p-5">
              <p className="text-[13.5px] font-medium leading-relaxed text-plum-soft">
                You haven&apos;t listed anything yet. Drop a pin on the 3D map, add photos and a
                price — we review each listing before it goes live, and you&apos;ll see its status
                right here.
              </p>
              <Link href="/find" className={PRIMARY_CTA}>
                List your first property — free
              </Link>
            </div>
          )}
        </article>

        <article className="glass flex min-w-0 flex-col gap-4 rounded-[28px] p-6 shadow-lg sm:p-7">
          <h3 className="text-[18px] font-bold text-plum">My designs</h3>
          {designsTotal > 0 ? (
            <>
              <p
                className="text-[34px] leading-none text-plum"
                style={{ fontFamily: "var(--font-fraunces)" }}
              >
                {designsTotal}
              </p>
              <p className="text-[13px] font-medium text-plum-soft">
                {designsSummary(designsTotal)} in the 3D Builder.
              </p>
              <Link href="/designer" className={`${PRIMARY_CTA} self-start`}>
                Open the Builder →
              </Link>
            </>
          ) : designsError ? (
            <LoadError />
          ) : (
            <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-plum/20 p-5">
              <p className="text-[13.5px] font-medium leading-relaxed text-plum-soft">
                No designs yet. Sketch a house floor by floor and save every idea.
              </p>
              <Link href="/designer" className={PRIMARY_CTA}>
                Start a design
              </Link>
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
