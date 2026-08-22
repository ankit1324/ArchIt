import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { FEES } from "@/lib/fees";

export const metadata: Metadata = {
  title: "Terms & Conditions — ArchIt",
  description: "The terms that govern your use of ArchIt.",
};

export default function TermsPage() {
  return (
    <div className="h-full overflow-y-auto bg-cream text-plum">
      <Navbar />
      <main className="mx-auto max-w-3xl px-6 py-14">
        <h1 className="text-3xl font-extrabold tracking-wide text-plum">
          Terms &amp; Conditions
        </h1>
        <p className="mt-2 text-sm text-plum-soft">
          Last updated: [LAST UPDATED DATE]
        </p>

        <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-plum-soft">
          <p>
            These Terms &amp; Conditions (&ldquo;Terms&rdquo;) form a legally
            binding agreement between you and{" "}
            <strong className="text-plum">[LEGAL ENTITY NAME]</strong>{" "}
            (&ldquo;ArchIt&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;), a
            company/entity registered in India with its registered office at{" "}
            <strong className="text-plum">[REGISTERED ADDRESS]</strong>{" "}
            (GSTIN: <strong className="text-plum">[GST NUMBER]</strong>),
            governing your access to and use of ArchIt&rsquo;s 3D map,
            property listing, and house-design/builder services
            (collectively, the &ldquo;Services&rdquo;). By creating an
            account or using the Services, you agree to these Terms.
          </p>

          <section>
            <h2 className="text-lg font-bold text-plum">1. Eligibility</h2>
            <p className="mt-3">
              You must be at least 18 years old and capable of entering into
              a binding contract under the Indian Contract Act, 1872 to use
              the Services. By using the Services, you represent that you
              meet these requirements.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-plum">
              2. Accounts &amp; Authentication
            </h2>
            <p className="mt-3">
              Account creation and sign-in are handled by our authentication
              partner, Clerk. You are responsible for maintaining the
              confidentiality of your login credentials and for all activity
              under your account. Notify us immediately at{" "}
              [SUPPORT EMAIL] if you suspect unauthorized use.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-plum">
              3. User-Generated Content
            </h2>
            <p className="mt-3">
              You are solely responsible for the accuracy, legality, and
              appropriateness of property listings, photos, descriptions,
              contact details, and house designs you submit (&ldquo;User
              Content&rdquo;). By submitting User Content, you grant ArchIt a
              non-exclusive, worldwide, royalty-free license to host,
              display, and distribute it on the platform for the purpose of
              operating the Services. You must not post content that is
              false, fraudulent, infringing, unlawful, or that you do not
              have the right to share. We may remove User Content that
              violates these Terms without prior notice.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-plum">
              4. Paid Features &amp; Payments
            </h2>
            <p className="mt-3">
              ArchIt offers the following one-time, paid features, processed
              securely through our payment gateway partner, Razorpay:
            </p>
            {/* [PAYWALL DISABLED — free for now] This notice is temporary; the
                paid-feature list below resumes in full if payments are
                re-enabled. */}
            <p className="mt-3">
              Payments are temporarily disabled — all features listed below are
              currently provided free of charge.
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                <strong className="text-plum">Contact Unlock</strong> — ₹
                {FEES.contact_owner / 100} to reveal a listing owner&rsquo;s
                contact details.
              </li>
              <li>
                <strong className="text-plum">Featured Listing</strong> — ₹
                {FEES.featured_property / 100} to boost and highlight a
                single listing on the map for a limited period.
              </li>
              <li>
                <strong className="text-plum">Builder Unlock</strong> — ₹
                {FEES.builder_unlock / 100} one-time, per-account access to
                the full house-design/builder suite.
              </li>
            </ul>
            <p className="mt-3">
              All prices are quoted in Indian Rupees (INR) and are inclusive
              of applicable taxes unless stated otherwise. Payments are
              processed by Razorpay in accordance with their own terms; we
              never store your card, UPI, or bank details. See our{" "}
              <a href="/refunds" className="underline hover:text-plum">
                Refund &amp; Cancellation Policy
              </a>{" "}
              for eligibility for refunds.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-plum">
              5. Acceptable Use
            </h2>
            <p className="mt-3">You agree not to:</p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                Post listings for properties you do not own, represent, or
                have authority to list;
              </li>
              <li>
                Scrape, reverse-engineer, or resell data from the Services;
              </li>
              <li>
                Attempt to bypass paywalls, payment flows, or access
                controls;
              </li>
              <li>
                Upload malicious code or interfere with the operation of the
                Services; or
              </li>
              <li>
                Use the Services for any unlawful purpose or in violation of
                any applicable law.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-plum">
              6. Intellectual Property
            </h2>
            <p className="mt-3">
              The ArchIt name, logo, software, map rendering, and design
              tools are the property of{" "}
              <strong className="text-plum">[LEGAL ENTITY NAME]</strong> and
              are protected by applicable intellectual property laws. Except
              for your own User Content, nothing in these Terms grants you
              any right to use our trademarks, branding, or proprietary
              technology.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-plum">
              7. Third-Party Services
            </h2>
            <p className="mt-3">
              The Services rely on third-party providers, including Clerk
              (authentication), Razorpay (payments), Supabase (data
              storage), and map/tile providers. We are not responsible for
              outages, errors, or issues arising from these third-party
              services, though we will make reasonable efforts to address
              their impact on the Services.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-plum">
              8. Disclaimers &amp; Limitation of Liability
            </h2>
            <p className="mt-3">
              ArchIt is a discovery and design platform only — we do not
              verify, endorse, or guarantee the accuracy of any listing,
              price, ownership claim, or house design submitted by users.
              Any transaction, negotiation, or agreement between a buyer and
              a listing owner is strictly between those parties. To the
              maximum extent permitted by law, ArchIt and its affiliates
              shall not be liable for any indirect, incidental, or
              consequential damages arising from your use of the Services.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-plum">
              9. Suspension &amp; Termination
            </h2>
            <p className="mt-3">
              We may suspend or terminate your account if you violate these
              Terms, engage in fraudulent activity, or misuse the Services.
              You may stop using the Services and request account deletion
              at any time by contacting [SUPPORT EMAIL].
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-plum">
              10. Governing Law &amp; Jurisdiction
            </h2>
            <p className="mt-3">
              These Terms are governed by the laws of India. Any disputes
              arising out of or relating to these Terms or the Services
              shall be subject to the exclusive jurisdiction of the courts
              at <strong className="text-plum">[JURISDICTION CITY]</strong>,
              India.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-plum">
              11. Changes to These Terms
            </h2>
            <p className="mt-3">
              We may revise these Terms from time to time. Material changes
              will be reflected by an updated &ldquo;Last updated&rdquo;
              date on this page. Continued use of the Services after
              changes take effect constitutes acceptance of the revised
              Terms.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-plum">12. Contact Us</h2>
            <p className="mt-3">
              Questions about these Terms can be directed to{" "}
              <strong className="text-plum">[SUPPORT EMAIL]</strong> or via
              our{" "}
              <a href="/contact" className="underline hover:text-plum">
                Contact page
              </a>
              .
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
