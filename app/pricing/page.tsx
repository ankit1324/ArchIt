import type { Metadata } from "next";
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

export default function PricingPage() {
  // Paywall off: same page, every unlock shown as free. Featuring is hidden in
  // the app while it's off, so it's left out here too. Prices come back with
  // PAYWALL_ENABLED.
  const plans = PAYWALL_ENABLED ? PLANS : PLANS.filter((p) => p.purpose !== "featured_property");
  return (
    <div className="h-full overflow-y-auto bg-cream text-plum">
      <Navbar />
      <main className="mx-auto max-w-4xl px-6 py-14">
        <h1 className="text-3xl font-extrabold tracking-wide text-plum">Pricing</h1>
        {PAYWALL_ENABLED ? (
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-plum-soft">
            No subscriptions. Everything below is a one-time UPI payment in Indian Rupees,
            and each unlock is delivered the moment your payment is confirmed.
          </p>
        ) : (
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-plum-soft">
            <strong className="text-plum">Everything on ArchIt is free right now.</strong>{" "}
            The 3D builder, premium templates and owner contacts are unlocked for every
            signed-in account. No payment needed.
          </p>
        )}

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {plans.map((p) => (
            <section
              key={p.purpose}
              className="rounded-2xl border border-plum/10 bg-white/60 p-6"
            >
              <h2 className="text-lg font-bold text-plum">{p.name}</h2>
              <p className="mt-2">
                {PAYWALL_ENABLED ? (
                  <>
                    <span className="text-3xl font-extrabold text-plum">
                      ₹{(FEES[p.purpose] / 100).toLocaleString("en-IN")}
                    </span>{" "}
                    <span className="text-sm font-semibold text-plum-soft">{p.unit}</span>
                  </>
                ) : (
                  <>
                    <span className="text-3xl font-extrabold text-plum">Free</span>{" "}
                    <span className="text-sm font-semibold text-plum-soft">for now</span>
                  </>
                )}
              </p>
              <p className="mt-3 text-[15px] leading-relaxed text-plum-soft">{(!PAYWALL_ENABLED && p.freeBody) || p.body}</p>
            </section>
          ))}
        </div>

        <section className="mt-10">
          <h2 className="text-lg font-bold text-plum">Always free</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-[15px] leading-relaxed text-plum-soft">
            {FREE.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </section>

        {PAYWALL_ENABLED && (
          <p className="mt-10 text-[15px] leading-relaxed text-plum-soft">
            Charged twice, or paid and nothing unlocked? See the{" "}
            <a href="/refunds" className="underline hover:text-plum">refund policy</a> or{" "}
            <a href="/contact" className="underline hover:text-plum">contact us</a>.
          </p>
        )}
      </main>
      <Footer />
    </div>
  );
}
