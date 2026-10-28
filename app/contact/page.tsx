import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { BUSINESS, hasSupportEmail } from "@/lib/business";
import ContactForm from "./ContactForm";

export const metadata: Metadata = {
  title: "Contact",
  description: "Reach ArchIt support for payments, listings and account help.",
};

/**
 * lib/business.ts still ships "[SUPPORT EMAIL]"-style placeholders until the
 * real details are filled in; never show those to visitors. (Local copy of
 * lib/contact's isPlaceholder so this static page reads as self-contained.)
 */
const isPlaceholder = (v: string) => /^\[.*\]$/.test(v.trim());
const shown = (v: string): string | null => (isPlaceholder(v) ? null : v);

const supportEmail = hasSupportEmail && !isPlaceholder(BUSINESS.supportEmail) ? BUSINESS.supportEmail : null;
const supportPhone = shown(BUSINESS.supportPhone);
const legalName = shown(BUSINESS.legalName);
const address = shown(BUSINESS.address);
const grievanceOfficer = shown(BUSINESS.grievanceOfficer);
const postal = [legalName, address].filter(Boolean).join(", ");
const hasDetails = !!(supportEmail || supportPhone || postal);

const TOPICS: Array<{ title: string; body: string }> = [
  {
    title: "Payments & refunds",
    body: "Include the UPI transaction reference (UTR) or the payment ID from your receipt, the amount, and what you were unlocking. Refunds follow our refund policy.",
  },
  {
    title: "A listing looks wrong",
    body: "Send the listing address or link and what is inaccurate, misleading or fraudulent. We review every report and remove listings that break our terms.",
  },
  {
    title: "Your account or data",
    body: "Use the email on your account. For data access or deletion requests we may ask you to confirm it is you.",
  },
];

const EYEBROW = "text-[11px] font-bold uppercase tracking-[0.14em] text-ink-soft";
const LINK =
  "rounded-[2px] text-accent underline underline-offset-4 hover:text-accent-deep focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent";

export default function ContactPage() {
  const emailLink = supportEmail ? (
    <a href={`mailto:${supportEmail}`} className={LINK}>
      {supportEmail}
    </a>
  ) : null;

  return (
    <div className="flex min-h-full flex-col bg-paper text-ink">
      <Navbar />
      <main id="main-content" className="mx-auto w-full max-w-[1400px] px-[clamp(20px,5.5vw,84px)] pb-20 md:pb-28">
        {/* Two columns on wide screens: intro and help topics on the left, the
            form held beside them on the right. On phones the form follows the
            intro directly, before the longer reading. */}
        <div className="grid gap-x-[clamp(48px,7vw,112px)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <header className="border-b border-line pt-12 pb-10 md:pt-20 md:pb-12 lg:border-b-0">
            <p className={`flex items-center gap-2 ${EYEBROW}`}>
              <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" /> Support
            </p>
            <h1 className="mt-5 font-display text-[clamp(44px,6vw,80px)] leading-[1.02] font-normal tracking-[-0.035em] text-ink">
              Contact us
            </h1>
            <p className="mt-6 max-w-[46ch] text-[16px] leading-[1.75] text-ink-soft">
              Send us a message below and we&apos;ll reply by email {BUSINESS.responseTime}.
            </p>

            {hasDetails && (
              <dl className="mt-8 max-w-[46ch] border-t border-line text-[15px] leading-relaxed">
                {emailLink && (
                  <div className="grid grid-cols-[88px_1fr] gap-4 border-b border-line py-3">
                    <dt className={`pt-1 ${EYEBROW}`}>Email</dt>
                    <dd className="break-words">{emailLink}</dd>
                  </div>
                )}
                {supportPhone && (
                  <div className="grid grid-cols-[88px_1fr] gap-4 border-b border-line py-3">
                    <dt className={`pt-1 ${EYEBROW}`}>Phone</dt>
                    <dd className="tabular-nums">{supportPhone}</dd>
                  </div>
                )}
                {postal && (
                  <div className="grid grid-cols-[88px_1fr] gap-4 border-b border-line py-3">
                    <dt className={`pt-1 ${EYEBROW}`}>Address</dt>
                    <dd>{postal}</dd>
                  </div>
                )}
              </dl>
            )}
          </header>

          <div className="pt-10 lg:row-span-2 lg:pt-20">
            <div className="lg:sticky lg:top-8">
              <ContactForm />
            </div>
          </div>

          <div className="mt-14 text-[15px] leading-[1.8] text-ink-soft lg:mt-4">
            <p className={EYEBROW}>Before you write</p>
            <ol className="mt-4 border-t border-line">
              {TOPICS.map((t, i) => (
                <li key={t.title} className="flex gap-5 border-b border-line py-6">
                  <span aria-hidden="true" className="pt-1.5 text-[11px] text-accent tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <section>
                    <h2 className="font-display text-[22px] leading-tight font-normal tracking-[-0.015em] text-ink">
                      {t.title}
                    </h2>
                    <p className="mt-2">{t.body}</p>
                  </section>
                </li>
              ))}
            </ol>

            <section className="mt-8 rounded-[5px] border border-line bg-paper-soft p-6">
              <h2 className="font-display text-[22px] leading-tight font-normal tracking-[-0.015em] text-ink">
                Grievance Officer
              </h2>
              <p className="mt-2">
                Under the Information Technology Act, 2000 you can also write to our Grievance
                Officer
                {grievanceOfficer && (
                  <>
                    , <strong className="font-semibold text-ink">{grievanceOfficer}</strong>,
                  </>
                )}{" "}
                {emailLink ? <>at {emailLink}</> : <>using the contact form on this page (choose &ldquo;Something else&rdquo;)</>}.
                Complaints are acknowledged within 24 hours and resolved within 15 days.
              </p>
            </section>

            <p className="mt-8 text-[14px]">
              See also: <a href="/pricing" className={`inline-flex min-h-6 items-center ${LINK}`}>Pricing</a>
              {" · "}
              <a href="/refunds" className={`inline-flex min-h-6 items-center ${LINK}`}>Refund policy</a>
              {" · "}
              <a href="/terms" className={`inline-flex min-h-6 items-center ${LINK}`}>Terms</a>
              {" · "}
              <a href="/privacy" className={`inline-flex min-h-6 items-center ${LINK}`}>Privacy</a>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
