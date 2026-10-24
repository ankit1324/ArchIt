import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { FEES } from "@/lib/fees";
import { PAYWALL_ENABLED } from "@/lib/paywall";
import { BUSINESS, hasSupportEmail, legalEntityName } from "@/lib/business";

export const metadata: Metadata = {
  title: "Refund & Cancellation Policy",
  description: "When ArchIt payments can be cancelled or refunded.",
};

// Business details come from lib/business.ts; until the support email is
// filled in there, refund requests are pointed at the /contact page instead of
// printing a raw "[PLACEHOLDER]".
export default function RefundsPage() {
  return (
    <div className="h-full overflow-y-auto bg-cream text-plum">
      <Navbar />
      <main className="mx-auto max-w-3xl px-6 py-14">
        <h1 className="text-3xl font-extrabold tracking-wide text-plum">
          Refund &amp; Cancellation Policy
        </h1>
        <p className="mt-2 text-sm text-plum-soft">
          Last updated: {BUSINESS.lastUpdated}
        </p>

        <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-plum-soft">
          <p>
            This policy explains when a payment made to{" "}
            <strong className="text-plum">{legalEntityName}</strong>{" "}
            (&ldquo;ArchIt&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;) for a
            paid feature can be cancelled or refunded. It forms part of our{" "}
            <a href="/terms" className="underline hover:text-plum">
              Terms &amp; Conditions
            </a>
            .
          </p>

          <section>
            <h2 className="text-lg font-bold text-plum">1. What you are buying</h2>
            <p className="mt-3">
              Every paid feature on ArchIt is a one-time digital unlock that is
              delivered instantly, the moment your UPI payment is confirmed:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                <strong className="text-plum">Contact Unlock</strong> — ₹
                {FEES.contact_owner / 100}, reveals one listing owner&rsquo;s
                contact details to your account.
              </li>
              <li>
                <strong className="text-plum">Featured Listing</strong> — ₹
                {FEES.featured_property / 100}, highlights one of your listings
                on the map.
              </li>
              <li>
                <strong className="text-plum">Builder Unlock</strong> — ₹
                {FEES.builder_unlock / 100}, lifetime access to the 3D builder
                for your account.
              </li>
              <li>
                <strong className="text-plum">Template Unlock</strong> — ₹
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
            <h2 className="text-lg font-bold text-plum">2. Cancellation</h2>
            <p className="mt-3">
              You can cancel at any point before paying by closing the payment
              window. A payment session that is not completed within its time
              limit expires on its own and nothing is charged. Because each
              unlock is delivered immediately on payment, a completed purchase
              cannot be cancelled afterwards.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-plum">3. Refunds</h2>
            <p className="mt-3">
              As digital goods delivered instantly, paid features are
              non-refundable once unlocked, except in the following cases,
              where we will refund the full amount to the UPI account you paid
              from:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
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
            <h2 className="text-lg font-bold text-plum">4. How to request a refund</h2>
            <p className="mt-3">
              {hasSupportEmail ? (
                <>
                  Email{" "}
                  <a
                    href={`mailto:${BUSINESS.supportEmail}`}
                    className="font-semibold text-plum underline hover:text-plum"
                  >
                    {BUSINESS.supportEmail}
                  </a>
                </>
              ) : (
                <>
                  Contact us through our{" "}
                  <a href="/contact" className="underline hover:text-plum">
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
            <h2 className="text-lg font-bold text-plum">5. Failed or pending payments</h2>
            <p className="mt-3">
              If money left your account but ArchIt shows the payment as
              failed or still pending, do not pay again. Confirmation can take
              a few minutes; if the unlock has not appeared after that, contact
              us with the details above and we will either complete the unlock
              or refund you.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-plum">6. Changes to this policy</h2>
            <p className="mt-3">
              We may update this policy from time to time. The version in force
              at the time of your payment applies to that payment.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
