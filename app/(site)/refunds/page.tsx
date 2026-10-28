import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { FEES } from "@/lib/fees";
import { PAYWALL_ENABLED } from "@/lib/paywall";
import { BUSINESS, hasSupportEmail, legalEntityName } from "@/lib/business";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy",
  description: "When ArchIt payments can be cancelled or refunded.",
};

// Shared shape of the three legal pages: a sticky index of the policies beside
// a ~68ch reading column. Restyle only; the policy wording below is unchanged.
const EYEBROW =
  "flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-soft";
const LINK =
  "rounded-[2px] text-accent underline underline-offset-4 hover:text-accent-deep focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent";
const LEGAL_DOCS: Array<{ href: string; label: string }> = [
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/terms", label: "Terms & Conditions" },
  { href: "/refunds", label: "Refunds & Cancellation" },
  { href: "/contact", label: "Contact" },
];

function LegalNav({ current }: { current: string }) {
  return (
    <nav aria-label="Legal documents" className="hidden self-start lg:sticky lg:top-8 lg:block">
      <p className={EYEBROW}>Policies</p>
      <ul className="mt-4 border-t border-line text-[14px]">
        {LEGAL_DOCS.map((d) => (
          <li key={d.href} className="border-b border-line">
            <Link
              href={d.href}
              prefetch={false}
              aria-current={d.href === current ? "page" : undefined}
              className="group flex min-h-11 items-center justify-between gap-3 py-2 text-ink-soft transition-colors hover:text-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent aria-[current=page]:font-semibold aria-[current=page]:text-ink"
            >
              {d.label}
              <span aria-hidden="true" className="text-accent opacity-0 transition-opacity group-hover:opacity-100 group-aria-[current=page]:opacity-100">
                &rarr;
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// Business details come from lib/business.ts; until the support email is
// filled in there, refund requests are pointed at the /contact page instead of
// printing a raw "[PLACEHOLDER]".
export default function RefundsPage() {
  return (
    <div className="flex min-h-full flex-col bg-paper text-ink">
      <Navbar />
      <main id="main-content" className="mx-auto w-full max-w-[1400px] px-[clamp(20px,5.5vw,84px)] pb-20 md:pb-28">
        <header className="border-b border-line pt-12 pb-10 md:pt-20 md:pb-14">
          <p className={EYEBROW}>
            <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" /> Legal
          </p>
        <h1 className="mt-5 max-w-[16ch] font-display text-[clamp(40px,5.6vw,72px)] leading-[1.05] font-normal tracking-[-0.035em] text-ink">
          Refund &amp; Cancellation Policy
        </h1>
        <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-soft tabular-nums">
          Last updated: {BUSINESS.lastUpdated}
        </p>
        </header>

        <div className="grid gap-10 pt-10 md:pt-14 lg:grid-cols-[200px_minmax(0,68ch)] lg:gap-[clamp(48px,7vw,112px)]">
          <LegalNav current="/refunds" />
        <article className="max-w-[68ch] space-y-8 text-[15px] leading-[1.8] text-ink-soft md:text-[16px] [&>p:first-child]:text-[17px] [&>p:first-child]:leading-[1.7] [&>p:first-child]:text-ink [&>section]:border-t [&>section]:border-line [&>section]:pt-8">
          <p>
            This policy explains when a payment made to{" "}
            <strong className="font-semibold text-ink">{legalEntityName}</strong>{" "}
            (&ldquo;ArchIt&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) for a
            paid feature can be cancelled or refunded. It forms part of our{" "}
            <a href="/terms" className={LINK}>
              Terms &amp; Conditions
            </a>
            .
          </p>

          <section>
            <h2 className="font-display text-[24px] leading-tight font-normal tracking-[-0.015em] text-ink md:text-[27px]">1. What you are buying</h2>
            <p className="mt-3">
              Every paid feature on ArchIt is a one-time digital unlock that is
              delivered instantly, the moment your UPI payment is confirmed:
            </p>
            <ul className="mt-4 list-disc space-y-2.5 pl-5 marker:text-accent">
              <li>
                <strong className="font-semibold text-ink">Contact Unlock</strong> — ₹
                {FEES.contact_owner / 100}, reveals one listing owner&rsquo;s
                contact details to your account.
              </li>
              <li>
                <strong className="font-semibold text-ink">Featured Listing</strong> — ₹
                {FEES.featured_property / 100}, highlights one of your listings
                on the map.
              </li>
              <li>
                <strong className="font-semibold text-ink">Builder Unlock</strong> — ₹
                {FEES.builder_unlock / 100}, lifetime access to the 3D builder
                for your account.
              </li>
              <li>
                <strong className="font-semibold text-ink">Template Unlock</strong> — ₹
                {FEES.template_unlock / 100}, lifetime access to one premium
                floor-plan template for your account.
              </li>
            </ul>
            {!PAYWALL_ENABLED && (
              <p className="mt-3">
                These features are currently free for every signed-in user,
                and no payment is taken while that is the case.
              </p>
            )}
          </section>

          <section>
            <h2 className="font-display text-[24px] leading-tight font-normal tracking-[-0.015em] text-ink md:text-[27px]">2. Cancellation</h2>
            <p className="mt-3">
              You can cancel at any point before paying by closing the payment
              window. A payment session that is not completed within its time
              limit expires on its own and nothing is charged. Because each
              unlock is delivered immediately on payment, a completed purchase
              cannot be cancelled afterwards.
            </p>
          </section>

          <section>
            <h2 className="font-display text-[24px] leading-tight font-normal tracking-[-0.015em] text-ink md:text-[27px]">3. Refunds</h2>
            <p className="mt-3">
              As digital goods delivered instantly, paid features are
              non-refundable once unlocked, except in the following cases,
              where we will refund the full amount to the UPI account you paid
              from:
            </p>
            <ul className="mt-4 list-disc space-y-2.5 pl-5 marker:text-accent">
              <li>
                Your payment succeeded but the feature was not unlocked on
                your account within 24 hours.
              </li>
              <li>
                You were charged more than once for the same unlock (for
                example, the same contact or the same template).
              </li>
              <li>
                You paid to unlock a contact and the listing turned out to have
                no owner contact on file, or the listing was removed by us for
                violating our Terms.
              </li>
            </ul>
            <p className="mt-3">
              Refunds are not available because you changed your mind, because
              an owner did not respond to you, or because you no longer wish to
              use the builder or a template after unlocking it.
            </p>
          </section>

          <section>
            <h2 className="font-display text-[24px] leading-tight font-normal tracking-[-0.015em] text-ink md:text-[27px]">4. How to request a refund</h2>
            <p className="mt-3">
              {hasSupportEmail ? (
                <>
                  Email{" "}
                  <a
                    href={`mailto:${BUSINESS.supportEmail}`}
                    className={`font-semibold ${LINK}`}
                  >
                    {BUSINESS.supportEmail}
                  </a>
                </>
              ) : (
                <>
                  Contact us through our{" "}
                  <a href="/contact" className={LINK}>
                    Contact page
                  </a>
                </>
              )}{" "}
              within 7 days of the payment with the email address on your ArchIt
              account, the approximate time of payment, the amount, and your
              UPI transaction reference (UTR) if you have it. We will respond
              within 5 working days. Approved refunds are returned to the
              original UPI account and typically appear within 5–7 working
              days, depending on your bank.
            </p>
          </section>

          <section>
            <h2 className="font-display text-[24px] leading-tight font-normal tracking-[-0.015em] text-ink md:text-[27px]">5. Failed or pending payments</h2>
            <p className="mt-3">
              If money left your account but ArchIt shows the payment as
              failed or still pending, do not pay again. Confirmation can take
              a few minutes; if the unlock has not appeared after that, contact
              us with the details above and we will either complete the unlock
              or refund you.
            </p>
          </section>

          <section>
            <h2 className="font-display text-[24px] leading-tight font-normal tracking-[-0.015em] text-ink md:text-[27px]">6. Changes to this policy</h2>
            <p className="mt-3">
              We may update this policy from time to time. The version in force
              at the time of your payment applies to that payment.
            </p>
          </section>
        </article>
        </div>
      </main>
      <Footer />
    </div>
  );
}
