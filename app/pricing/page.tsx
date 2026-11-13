import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { FEES, type FeePurpose } from "@/lib/fees";
import { PAYWALL_ENABLED } from "@/lib/paywall";

export const metadata: Metadata = {
  title: "Pricing",
  description: PAYWALL_ENABLED
    ? "Browsing and listing on ArchIt are free. Pay once, by UPI, only for what you unlock."
    : "Everything on ArchIt is free right now: the 3D builder, premium templates and owner contacts.",
};

const PLANS: Array<{
  purpose: FeePurpose;
  name: string;
  unit: string;
  body: string;
  /** copy while the paywall is off, where `body` talks about selling it */
  freeBody?: string;
}> = [
  {
    purpose: "contact_owner",
    name: "Contact unlock",
    unit: "per listing",
    body: "Reveal one listing owner's phone and email. Stays unlocked on your account.",
    freeBody: "See any listing owner's phone and email.",
  },
  {
    purpose: "featured_property",
    name: "Featured listing",
    unit: "per listing",
    body: "Boost and highlight one of your listings on the map so it stands out to buyers and renters.",
  },
  {
    purpose: "builder_unlock",
    name: "3D Builder",
    unit: "one-time",
    body: "Lifetime access to the full house-design and 3D builder suite for your account.",
    freeBody: "The full house-design and 3D builder suite.",
  },
  {
    purpose: "template_unlock",
    name: "Premium template",
    unit: "per template",
    body: "Unlock one premium floor-plan layout for your account. Indian house layouts are free; premium templates are sold separately from the 3D Builder.",
    freeBody: "Every premium floor-plan layout, ready to use in the 3D Builder.",
  },
];

const FREE = [
  "Browsing the 3D property map and every listing's details",
  "Listing your own property",
  "ArchIt Lite",
];

// The landing's starter-card tints, cycled so neighbouring cards differ.
const TINTS = ["bg-[#f0f0e7]", "bg-[#eee5d9]", "bg-[#e7ece4]", "bg-paper-soft"];
const EYEBROW = "text-[11px] font-bold uppercase tracking-[0.14em] text-ink-soft";
const LINK =
  "inline-flex min-h-6 items-center rounded-[2px] text-accent underline underline-offset-4 hover:text-accent-deep focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent";

export default function PricingPage() {
  // Paywall off: same page, every unlock shown as free. Featuring is hidden in
  // the app while it's off, so it's left out here too. Prices come back with
  // PAYWALL_ENABLED.
  const plans = PAYWALL_ENABLED ? PLANS : PLANS.filter((p) => p.purpose !== "featured_property");
  return (
    <div className="flex min-h-full flex-col bg-paper text-ink">
      <Navbar />
      <main id="main-content" className="mx-auto w-full max-w-[1400px] px-[clamp(20px,5.5vw,84px)] pb-20 md:pb-28">
        <header className="grid items-end gap-6 border-b border-line pt-12 pb-10 md:grid-cols-[1fr_minmax(0,46ch)] md:gap-16 md:pt-20 md:pb-14">
          <div>
            <p className={`flex items-center gap-2 ${EYEBROW}`}>
              <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
              {PAYWALL_ENABLED ? "One-time UPI payments" : "Free right now"}
            </p>
            <h1 className="mt-5 font-display text-[clamp(44px,6vw,80px)] leading-[1.02] font-normal tracking-[-0.035em] text-ink">
              Pricing
            </h1>
          </div>
          {PAYWALL_ENABLED ? (
            <p className="text-[16px] leading-[1.75] text-ink-soft">
              No subscriptions. Everything below is a one-time UPI payment in Indian Rupees,
              and each unlock is delivered the moment your payment is confirmed.
            </p>
          ) : (
            <p className="text-[16px] leading-[1.75] text-ink-soft">
              <strong className="font-semibold text-ink">Everything on ArchIt is free right now.</strong>{" "}
              The 3D builder, premium templates and owner contacts are unlocked for every
              signed-in account. No payment needed.
            </p>
          )}
        </header>

        <div
          className={`mt-10 grid gap-4 md:mt-14 md:grid-cols-2 lg:gap-5 ${
            plans.length === 4 ? "xl:grid-cols-4" : "lg:grid-cols-3"
          }`}
        >
          {plans.map((p, i) => (
            <section
              key={p.purpose}
              aria-labelledby={`plan-${p.purpose}`}
              className={`flex flex-col rounded-[5px] border border-line px-6 pt-7 pb-6 md:min-h-[320px] ${TINTS[i % TINTS.length]}`}
            >
              <p className={`flex justify-between gap-4 ${EYEBROW}`}>
                <span className="tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                <span>{PAYWALL_ENABLED ? p.unit : "Included"}</span>
              </p>
              <h2
                id={`plan-${p.purpose}`}
                className="mt-6 font-display text-[28px] leading-[1.15] font-normal tracking-[-0.02em] text-ink"
              >
                {p.name}
              </h2>
              <p className="mt-5 flex items-baseline gap-2">
                {PAYWALL_ENABLED ? (
                  <>
                    <span className="font-display text-[52px] leading-none font-normal tracking-[-0.03em] text-ink tabular-nums">
                      ₹{(FEES[p.purpose] / 100).toLocaleString("en-IN")}
                    </span>{" "}
                    <span className="text-[14px] font-semibold text-ink-soft">{p.unit}</span>
                  </>
                ) : (
                  <>
                    <span className="font-display text-[52px] leading-none font-normal tracking-[-0.03em] text-accent">
                      Free
                    </span>{" "}
                    <span className="text-[14px] font-semibold text-ink-soft">for now</span>
                  </>
                )}
              </p>
              <p className="mt-6 border-t border-ink/15 pt-5 text-[14px] leading-[1.75] text-ink-soft md:mt-auto md:min-h-[70px]">
                {(!PAYWALL_ENABLED && p.freeBody) || p.body}
              </p>
            </section>
          ))}
        </div>

        <section
          aria-labelledby="always-free"
          className="mt-14 grid gap-6 border-t border-line pt-10 md:mt-20 md:grid-cols-[1fr_minmax(0,46ch)] md:gap-16 md:pt-14"
        >
          <h2
            id="always-free"
            className="font-display text-[clamp(30px,3.3vw,45px)] leading-[1.15] font-normal tracking-[-0.03em] text-ink"
          >
            Always free
          </h2>
          <ul className="text-[15px] leading-relaxed text-ink">
            {FREE.map((f) => (
              <li key={f} className="flex gap-4 border-b border-line py-4 first:pt-1">
                <span aria-hidden="true" className="text-accent">+</span>
                {f}
              </li>
            ))}
          </ul>
        </section>

        <section
          aria-labelledby="pricing-next-step"
          className="mt-14 rounded-[5px] bg-forest px-6 py-8 text-paper md:mt-20 md:px-10 md:py-10"
        >
          <div className="grid items-end gap-8 md:grid-cols-[minmax(0,1fr)_minmax(280px,0.6fr)] md:gap-14">
            <div className="max-w-2xl">
              <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-paper/70">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-clay" />
                Next step
              </p>
              <h2
                id="pricing-next-step"
                className="mt-4 font-display text-[clamp(32px,4vw,50px)] font-normal leading-[1.08] tracking-[-0.035em]"
              >
                Turn an idea into a place.
              </h2>
              <p className="mt-4 max-w-[54ch] text-[15px] leading-[1.75] text-paper/75">
                {PAYWALL_ENABLED
                  ? "Choose the tool you need, then unlock paid features only when you decide to use them."
                  : "Everything is open right now. Start a design from scratch or explore properties on the living map."}
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row md:flex-col">
              <Link
                href="/designer"
                className="inline-flex min-h-11 items-center justify-between gap-6 rounded-[5px] bg-highlight px-5 py-3 text-[13px] font-semibold text-ink transition-colors hover:bg-paper focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-paper"
              >
                Start designing <span aria-hidden="true">→</span>
              </Link>
              <Link
                href="/find"
                className="inline-flex min-h-11 items-center justify-between gap-6 rounded-[5px] border border-paper/45 px-5 py-3 text-[13px] font-semibold text-paper transition-colors hover:border-paper focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-paper"
              >
                Explore properties <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </section>

        {PAYWALL_ENABLED && (
          <p className="mt-10 text-[14px] leading-[1.75] text-ink-soft md:ml-auto md:max-w-[46ch]">
            Charged twice, or paid and nothing unlocked? See the{" "}
            <a href="/refunds" className={LINK}>refund policy</a> or{" "}
            <a href="/contact" className={LINK}>contact us</a>.
          </p>
        )}
      </main>
      <Footer />
    </div>
  );
}
