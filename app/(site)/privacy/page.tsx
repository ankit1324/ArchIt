import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import {
  BUSINESS,
  filled,
  hasSupportEmail,
  legalEntityName,
} from "@/lib/business";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How ArchIt collects, uses, and protects your data.",
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

// Every business detail comes from lib/business.ts. Until a value is filled
// in there, the line that needs it is omitted or reworded neutrally, so the
// page never shows a raw "[PLACEHOLDER]".
const registeredName = filled(BUSINESS.legalName);
const address = filled(BUSINESS.address);
const phone = filled(BUSINESS.supportPhone);
const grievanceOfficer = filled(BUSINESS.grievanceOfficer);

function SupportEmail() {
  return (
    <a
      href={`mailto:${BUSINESS.supportEmail}`}
      className={`font-semibold ${LINK}`}
    >
      {BUSINESS.supportEmail}
    </a>
  );
}

function ContactPage() {
  return (
    <a href="/contact" className={LINK}>
      Contact page
    </a>
  );
}

export default function PrivacyPage() {
  return (
    <div className="flex min-h-full flex-col bg-paper text-ink">
      <Navbar />
      <main id="main-content" className="mx-auto w-full max-w-[1400px] px-[clamp(20px,5.5vw,84px)] pb-20 md:pb-28">
        <header className="border-b border-line pt-12 pb-10 md:pt-20 md:pb-14">
          <p className={EYEBROW}>
            <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" /> Legal
          </p>
        <h1 className="mt-5 max-w-[16ch] font-display text-[clamp(40px,5.6vw,72px)] leading-[1.05] font-normal tracking-[-0.035em] text-ink">
          Privacy Policy
        </h1>
        <p className="mt-6 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-soft tabular-nums">
          Last updated: {BUSINESS.lastUpdated}
        </p>
        </header>

        <div className="grid gap-10 pt-10 md:pt-14 lg:grid-cols-[200px_minmax(0,68ch)] lg:gap-[clamp(48px,7vw,112px)]">
          <LegalNav current="/privacy" />
        <article className="max-w-[68ch] space-y-8 text-[15px] leading-[1.8] text-ink-soft md:text-[16px] [&>p:first-child]:text-[17px] [&>p:first-child]:leading-[1.7] [&>p:first-child]:text-ink [&>section]:border-t [&>section]:border-line [&>section]:pt-8">
          <p>
            This Privacy Policy explains how{" "}
            <strong className="font-semibold text-ink">{legalEntityName}</strong>{" "}
            (&ldquo;ArchIt&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or
            &ldquo;our&rdquo;), operating the website and application at this
            domain, collects, uses, discloses, and safeguards information
            when you use our real-estate discovery map, house-design/builder
            tools, and related services (collectively, the
            &ldquo;Services&rdquo;). This Policy is published in accordance
            with the Information Technology Act, 2000 and the Information
            Technology (Reasonable Security Practices and Procedures and
            Sensitive Personal Data or Information) Rules, 2011.
          </p>

          <section>
            <h2 className="font-display text-[24px] leading-tight font-normal tracking-[-0.015em] text-ink md:text-[27px]">
              1. Information We Collect
            </h2>
            <ul className="mt-4 list-disc space-y-2.5 pl-5 marker:text-accent">
              <li>
                <strong className="font-semibold text-ink">Account data</strong> — name,
                email address, and profile details you provide when you sign
                up or sign in, processed for us by our authentication
                provider, Clerk.
              </li>
              <li>
                <strong className="font-semibold text-ink">Listing &amp; design data</strong>{" "}
                — property listings, photos, location pins, house designs,
                and other content you create or upload within the Services.
              </li>
              <li>
                <strong className="font-semibold text-ink">Contact information</strong> —
                phone numbers or email addresses you add to a listing so that
                interested buyers/renters can reach you after unlocking
                contact details.
              </li>
              <li>
                <strong className="font-semibold text-ink">Payment data</strong> —
                transaction identifiers, order IDs, UPI transaction
                references (UTR), and payment status relating to purchases
                you make. We do not collect or store your card, UPI PIN, or
                bank account details; the payment itself happens inside your
                UPI app.
              </li>
              <li>
                <strong className="font-semibold text-ink">Usage &amp; device data</strong>{" "}
                — IP address, browser type, device identifiers, pages
                viewed, and map interactions, collected automatically to
                operate and improve the Services.
              </li>
              <li>
                <strong className="font-semibold text-ink">Cookies &amp; similar
                technologies</strong> — used for session management,
                authentication, and basic analytics.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-[24px] leading-tight font-normal tracking-[-0.015em] text-ink md:text-[27px]">
              2. How We Use Your Information
            </h2>
            <p className="mt-3">We use the information we collect to:</p>
            <ul className="mt-4 list-disc space-y-2.5 pl-5 marker:text-accent">
              <li>Provide, operate, and maintain the Services;</li>
              <li>
                Process UPI payments for contact unlocks, featured-listing
                boosts, builder-suite access, and premium templates;
              </li>
              <li>
                Display your listings and designs to other users of the
                platform;
              </li>
              <li>
                Authenticate you and secure your account via Clerk;
              </li>
              <li>Respond to support requests and grievances;</li>
              <li>
                Detect, prevent, and address fraud, abuse, and security
                incidents; and
              </li>
              <li>
                Comply with applicable laws, regulations, and lawful
                government requests.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-[24px] leading-tight font-normal tracking-[-0.015em] text-ink md:text-[27px]">
              3. Sharing &amp; Disclosure
            </h2>
            <p className="mt-3">
              We do not sell your personal information. We share information
              only with:
            </p>
            <ul className="mt-4 list-disc space-y-2.5 pl-5 marker:text-accent">
              <li>
                <strong className="font-semibold text-ink">Service providers</strong> —
                Clerk (authentication), our self-hosted UPI payment gateway
                (payment processing), Supabase (database and file storage),
                and hosting/CDN
                providers, each bound by their own privacy and security
                obligations;
              </li>
              <li>
                <strong className="font-semibold text-ink">Other users</strong> — listing
                details you mark public, and your contact details with users
                who pay to unlock them;
              </li>
              <li>
                <strong className="font-semibold text-ink">Legal authorities</strong> —
                where required to comply with a legal obligation, court
                order, or valid government request.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-[24px] leading-tight font-normal tracking-[-0.015em] text-ink md:text-[27px]">
              4. Data Retention
            </h2>
            <p className="mt-3">
              We retain personal data for as long as your account is active
              or as needed to provide the Services, comply with our legal
              obligations (including tax and accounting requirements),
              resolve disputes, and enforce our agreements. You may request
              deletion of your account and associated data as described in
              Section 8, subject to records we are legally required to
              retain.
            </p>
          </section>

          <section>
            <h2 className="font-display text-[24px] leading-tight font-normal tracking-[-0.015em] text-ink md:text-[27px]">5. Data Security</h2>
            <p className="mt-3">
              We implement reasonable technical and organizational measures
              — including encryption in transit, access controls, and
              secure third-party processors — to protect your information.
              However, no method of transmission or storage is completely
              secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="font-display text-[24px] leading-tight font-normal tracking-[-0.015em] text-ink md:text-[27px]">
              6. Children&rsquo;s Privacy
            </h2>
            <p className="mt-3">
              The Services are not directed to individuals under the age of
              18. We do not knowingly collect personal information from
              children. If you believe a child has provided us with
              personal information, please contact us using the details
              below so we can take appropriate action.
            </p>
          </section>

          <section>
            <h2 className="font-display text-[24px] leading-tight font-normal tracking-[-0.015em] text-ink md:text-[27px]">
              7. Your Rights &amp; Choices
            </h2>
            <p className="mt-3">
              Subject to applicable law, you may request access to,
              correction of, or deletion of your personal data, and may
              withdraw consent for optional processing (such as marketing
              communications) at any time. To exercise these rights, contact
              us{" "}
              {hasSupportEmail ? (
                <>
                  at <SupportEmail />
                </>
              ) : (
                <>
                  through our <ContactPage />
                </>
              )}
              .
            </p>
          </section>

          <section>
            <h2 className="font-display text-[24px] leading-tight font-normal tracking-[-0.015em] text-ink md:text-[27px]">
              8. Grievance Officer
            </h2>
            <p className="mt-3">
              In accordance with the Information Technology Act, 2000 and
              rules made thereunder, the contact details of the Grievance
              Officer are provided below:
            </p>
            <p className="mt-3">
              <strong className="font-semibold text-ink">
                {grievanceOfficer ?? "Grievance Officer"}
              </strong>
              {registeredName && (
                <>
                  <br />
                  {registeredName}
                </>
              )}
              {address && (
                <>
                  <br />
                  {address}
                </>
              )}
              <br />
              {hasSupportEmail ? (
                <>
                  Email: <SupportEmail />
                </>
              ) : (
                <>
                  Contact: through our <ContactPage />
                </>
              )}
              {phone && (
                <>
                  <br />
                  Phone: {phone}
                </>
              )}
            </p>
          </section>

          <section>
            <h2 className="font-display text-[24px] leading-tight font-normal tracking-[-0.015em] text-ink md:text-[27px]">
              9. Changes to This Policy
            </h2>
            <p className="mt-3">
              We may update this Privacy Policy from time to time. We will
              post the revised policy on this page with an updated
              &ldquo;Last updated&rdquo; date. Continued use of the Services
              after changes take effect constitutes acceptance of the
              revised policy.
            </p>
          </section>

          <section>
            <h2 className="font-display text-[24px] leading-tight font-normal tracking-[-0.015em] text-ink md:text-[27px]">10. Contact Us</h2>
            <p className="mt-3">
              For questions about this Privacy Policy,{" "}
              {hasSupportEmail ? (
                <>
                  contact us at <SupportEmail /> or see our <ContactPage />
                </>
              ) : (
                <>
                  contact us through our <ContactPage />
                </>
              )}
              .
            </p>
          </section>
        </article>
        </div>
      </main>
      <Footer />
    </div>
  );
}
