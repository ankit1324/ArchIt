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

export default function ContactPage() {
  const emailLink = supportEmail ? (
    <a href={`mailto:${supportEmail}`} className="underline hover:text-plum">
      {supportEmail}
    </a>
  ) : null;

  return (
    <div className="h-full overflow-y-auto bg-cream text-plum">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
        <h1 className="text-3xl font-extrabold tracking-wide text-plum">Contact us</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-plum-soft">
          Send us a message below and we&apos;ll reply by email {BUSINESS.responseTime}.
        </p>

        <div className="mt-8">
          <ContactForm />
        </div>

        {hasDetails && (
          <div className="mt-8 rounded-2xl border border-plum/10 bg-white/60 p-6 text-[15px] leading-relaxed text-plum-soft">
            {emailLink && (
              <p>
                <strong className="text-plum">Email:</strong> {emailLink}
              </p>
            )}
            {supportPhone && (
              <p className="mt-2 first:mt-0">
                <strong className="text-plum">Phone:</strong> {supportPhone}
              </p>
            )}
            {postal && (
              <p className="mt-2 first:mt-0">
                <strong className="text-plum">Address:</strong> {postal}
              </p>
            )}
          </div>
        )}

        <div className="mt-10 space-y-6 text-[15px] leading-relaxed text-plum-soft">
          {TOPICS.map((t) => (
            <section key={t.title}>
              <h2 className="text-lg font-bold text-plum">{t.title}</h2>
              <p className="mt-2">{t.body}</p>
            </section>
          ))}

          <section>
            <h2 className="text-lg font-bold text-plum">Grievance Officer</h2>
            <p className="mt-2">
              Under the Information Technology Act, 2000 you can also write to our Grievance
              Officer
              {grievanceOfficer && (
                <>
                  , <strong className="text-plum">{grievanceOfficer}</strong>,
                </>
              )}{" "}
              {emailLink ? <>at {emailLink}</> : <>using the form above (choose &ldquo;Something else&rdquo;)</>}.
              Complaints are acknowledged within 24 hours and resolved within 15 days.
            </p>
          </section>

          <p>
            See also: <a href="/pricing" className="underline hover:text-plum">Pricing</a>
            {" · "}
            <a href="/refunds" className="underline hover:text-plum">Refund policy</a>
            {" · "}
            <a href="/terms" className="underline hover:text-plum">Terms</a>
            {" · "}
            <a href="/privacy" className="underline hover:text-plum">Privacy</a>
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
