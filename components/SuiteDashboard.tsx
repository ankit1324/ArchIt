import Link from "next/link";
import type { CSSProperties } from "react";
import Navbar from "@/components/Navbar";
import MobileTabBar from "@/components/MobileTabBar";
import { ApartmentsIcon, HouseIcon, SearchIcon } from "@/components/icons";
import { feeLabel } from "@/lib/fees";
import { PAYWALL_ENABLED } from "@/lib/paywall";
import type { MeSummary } from "@/lib/me";
import MyStuff from "@/app/(app)/dashboard/MyStuff";
import styles from "@/app/(app)/dashboard/dashboard.module.css";

const FOCUS =
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent";
// the landing's horizontal rhythm (MarketingLanding.module.css .section)
const GUTTER = "mx-auto w-full max-w-[1400px] px-[clamp(20px,5.5vw,84px)]";
const EYEBROW = "text-[11px] font-bold uppercase leading-[1.8] tracking-[0.14em]";

const PRODUCTS = [
  {
    name: "ArchIt Lite",
    tagline: "A taste of the atelier",
    body: "Explore a crafted 3D showcase home in your browser. No account, no cost — just walk in.",
    badge: "Free",
    badgeClass: "bg-highlight text-ink",
    // the landing's starter-card tints, in the same order
    tint: "bg-[#f0f0e7]",
    cta: "Try it free",
    href: "https://archit-lit.chaudharyankit.in/",
    external: true,
    Icon: HouseIcon,
  },
  {
    name: "ArchIt Find",
    tagline: "Every home, on a living map",
    body: "Fly over a 3D satellite city, browse real listings, list your own property and reach owners directly.",
    badge: PAYWALL_ENABLED ? `Free listing · ${feeLabel("contact_owner")} contact` : "Free",
    badgeClass: "border border-line-strong bg-paper text-ink",
    tint: "bg-[#eee5d9]",
    cta: "Open the map",
    href: "/find",
    external: false,
    Icon: SearchIcon,
    // the view's one primary CTA (Design Language)
    featured: true,
  },
  {
    name: "ArchIt 3D Builder",
    tagline: "Your home, room by room",
    body: "Design a complete house in 3D — floors, facades, windows, furniture — then save and refine every idea.",
    badge: PAYWALL_ENABLED ? `${feeLabel("builder_unlock")} one-time` : "Free",
    badgeClass: PAYWALL_ENABLED ? "bg-forest text-paper" : "bg-highlight text-ink",
    tint: "bg-[#e7ece4]",
    cta: "Start designing",
    href: "/designer",
    external: false,
    Icon: ApartmentsIcon,
  },
];

const CTA_BASE = `inline-flex min-h-11 w-full items-center justify-between gap-6 rounded-[5px] px-5 py-3 text-[13px] font-semibold transition-colors ${FOCUS}`;
const CTA_PRIMARY = `${CTA_BASE} border border-accent bg-accent text-paper hover:border-accent-deep hover:bg-accent-deep`;
const CTA_SECONDARY = `${CTA_BASE} border border-line-strong text-ink hover:border-ink`;

/** Counts for the hero, read from the same summary MyStuff renders. */
function HeroStats({ me }: { me: MeSummary }) {
  const stats = [
    { label: "Listings", value: me.listingsError ? null : me.listingsTotal },
    { label: "Saved designs", value: me.designsError ? null : me.designsTotal },
  ];
  return (
    <dl className="grid grid-cols-2 border-t border-paper/20 sm:min-w-[320px] lg:border-l lg:border-t-0">
      {stats.map((s, i) => (
        <div
          key={s.label}
          className={`flex flex-col gap-2 py-5 lg:px-8 lg:py-1 ${i ? "border-l border-paper/20 pl-5 lg:pl-8" : ""}`}
        >
          <dt className={`${EYEBROW} text-paper/75`}>{s.label}</dt>
          <dd className="font-display text-[44px] font-normal leading-none tracking-[-0.03em] tabular-nums">
            {s.value ?? (
              <>
                <span aria-hidden="true">—</span>
                <span className="sr-only">Couldn&apos;t load</span>
              </>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Signed-in home: the product dashboard, in the landing's planner skin. `me`
 * (the user's own listings + designs, lib/me.ts) adds the hero counts and the
 * "Your activity" section; without it the product tiles render on their own.
 */
export default function SuiteDashboard({ me }: { me?: MeSummary | null } = {}) {
  return (
    <div className="flex min-h-full flex-col bg-paper pt-[env(safe-area-inset-top)] text-ink">
      <Navbar variant="app" />

      <main className="flex flex-1 flex-col pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-0">
        {/* forest band: the signed-in counterpart of the landing's finale */}
        <section aria-labelledby="dashboard-title" className={`bg-forest text-paper ${styles.grid}`}>
          <div
            className={`${GUTTER} flex flex-col gap-10 py-14 lg:flex-row lg:items-end lg:justify-between lg:py-20`}
          >
            <div className="max-w-2xl">
              <p className={`${EYEBROW} flex items-center gap-2.5 text-paper/75`}>
                <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-clay" />
                The ArchIt suite
              </p>
              <h1
                id="dashboard-title"
                className="mt-5 font-display text-[44px] font-normal leading-[1.06] tracking-[-0.045em] sm:text-[64px]"
              >
                Dream it. <em className="text-clay">Find</em> it.{" "}
                <em>Build</em> it.
              </h1>
              <p className="mt-5 max-w-md text-[15px] leading-[1.8] text-paper/75">
                You&apos;re signed in — pick up where you left off.
              </p>
            </div>
            {me && <HeroStats me={me} />}
          </div>
        </section>

        <section aria-labelledby="suite-heading" className={`${GUTTER} py-12 lg:py-[72px]`}>
          <p className={`${EYEBROW} text-ink-soft`}>01 / The suite</p>
          <h2
            id="suite-heading"
            className="mt-3 font-display text-[32px] font-normal leading-[1.15] tracking-[-0.03em] sm:text-[40px]"
          >
            Pick a tool.
          </h2>

          <div className="mt-8 grid gap-[18px] lg:grid-cols-3">
            {PRODUCTS.map((p, i) => (
              <article
                key={p.name}
                style={{ "--i": i } as CSSProperties}
                className={`${styles.reveal} flex flex-col rounded-[5px] border border-line px-6 pb-6 pt-7 ${p.tint}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <span
                    aria-hidden="true"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[5px] border border-line-strong text-ink"
                  >
                    <p.Icon width={22} height={22} />
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-1 text-right text-[12px] font-bold tabular-nums ${p.badgeClass}`}
                  >
                    {p.badge}
                  </span>
                </div>

                <p className={`${EYEBROW} mt-7 text-ink-soft`}>
                  0{i + 1} / {p.tagline}
                </p>
                <h3 className="mt-2 font-display text-[29px] font-normal leading-[1.2] tracking-[-0.025em]">
                  {p.name}
                </h3>
                <p className="mt-3 flex-1 text-[14px] leading-[1.75] text-ink-soft">{p.body}</p>

                <div className="mt-6 border-t border-line-strong/50 pt-5">
                  {p.external ? (
                    <a
                      href={p.href}
                      target="_blank"
                      rel="noreferrer"
                      className={p.featured ? CTA_PRIMARY : CTA_SECONDARY}
                    >
                      {p.cta}
                      <span aria-hidden="true">↗</span>
                    </a>
                  ) : (
                    <Link href={p.href} className={p.featured ? CTA_PRIMARY : CTA_SECONDARY}>
                      {p.cta}
                      <span aria-hidden="true">→</span>
                    </Link>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        {me && <MyStuff me={me} />}

        {/* the landing's feature strip, used as a quiet trust line */}
        <footer className="mt-auto border-t border-line">
          <ul
            className={`${GUTTER} flex flex-wrap gap-x-5 gap-y-2 py-6 text-[12px] text-ink-soft md:justify-between`}
          >
            <li className="font-bold text-ink">Secured by Clerk</li>
            <li>
              <span aria-hidden="true" className="mr-5 text-line-strong">
                +
              </span>
              Data on Supabase
            </li>
            <li>
              <span aria-hidden="true" className="mr-5 text-line-strong">
                +
              </span>
              UPI payments via YouPI
            </li>
          </ul>
        </footer>
      </main>

      <MobileTabBar active="/" />
    </div>
  );
}
