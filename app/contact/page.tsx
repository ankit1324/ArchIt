import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { BUSINESS, hasSupportEmail } from "@/lib/business";

export const metadata: Metadata = {
  title: "Contact",
  description: "Reach ArchIt support for payments, listings and account help.",
};

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
    body: "Write from the email on your account. For data access or deletion requests we may ask you to confirm it is you.",
  },
];

export default function ContactPage() {
  const email = hasSupportEmail ? (
    <a href={`mailto:${BUSINESS.supportEmail}`} className="underline hover:text-plum">
      {BUSINESS.supportEmail}
    </a>
  ) : (
    BUSINESS.supportEmail
  );

  return (
    <div className="h-full overflow-y-auto bg-cream text-plum">
      <Navbar />
      <main className="mx-auto max-w-3xl px-6 py-14">
        <h1 className="text-3xl font-extrabold tracking-wide text-plum">Contact us</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-plum-soft">
          Email is the fastest way to reach us. We reply {BUSINESS.responseTime}.
        </p>

        <div className="mt-8 rounded-2xl border border-plum/10 bg-white/60 p-6 text-[15px] leading-relaxed text-plum-soft">
          <p>
            <strong className="text-plum">Email:</strong> {email}
          </p>
          <p className="mt-2">
            <strong className="text-plum">Phone:</strong> {BUSINESS.supportPhone}
          </p>
          <p className="mt-2">
            <strong className="text-plum">Address:</strong> {BUSINESS.legalName},{" "}
            {BUSINESS.address}
          </p>
        </div>

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
              Under the Information Technology Act, 2000 you can also write to our
              Grievance Officer, <strong className="text-plum">{BUSINESS.grievanceOfficer}</strong>,
              at {email}. Complaints are acknowledged within 24 hours and resolved within
              15 days.
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
