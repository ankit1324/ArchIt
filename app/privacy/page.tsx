import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Privacy Policy — ArchIt",
  description: "How ArchIt collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <div className="h-full overflow-y-auto bg-cream text-plum">
      <Navbar />
      <main className="mx-auto max-w-3xl px-6 py-14">
        <h1 className="text-3xl font-extrabold tracking-wide text-plum">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-plum-soft">
          Last updated: [LAST UPDATED DATE]
        </p>

        <div className="mt-8 space-y-8 text-[15px] leading-relaxed text-plum-soft">
          <p>
            This Privacy Policy explains how{" "}
            <strong className="text-plum">[LEGAL ENTITY NAME]</strong>{" "}
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
            <h2 className="text-lg font-bold text-plum">
              1. Information We Collect
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                <strong className="text-plum">Account data</strong> — name,
                email address, and profile details you provide when you sign
                up or sign in, processed for us by our authentication
                provider, Clerk.
              </li>
              <li>
                <strong className="text-plum">Listing &amp; design data</strong>{" "}
                — property listings, photos, location pins, house designs,
                and other content you create or upload within the Services.
              </li>
              <li>
                <strong className="text-plum">Contact information</strong> —
                phone numbers or email addresses you add to a listing so that
                interested buyers/renters can reach you after unlocking
                contact details.
              </li>
              <li>
                <strong className="text-plum">Payment data</strong> —
                transaction identifiers, order IDs, and payment status
                relating to purchases you make. We do not collect or store
                your card, UPI, or bank account details; these are handled
                directly by our payment processor, Razorpay.
              </li>
              <li>
                <strong className="text-plum">Usage &amp; device data</strong>{" "}
                — IP address, browser type, device identifiers, pages
                viewed, and map interactions, collected automatically to
                operate and improve the Services.
              </li>
              <li>
                <strong className="text-plum">Cookies &amp; similar
                technologies</strong> — used for session management,
                authentication, and basic analytics.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-plum">
              2. How We Use Your Information
            </h2>
            <p className="mt-3">We use the information we collect to:</p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Provide, operate, and maintain the Services;</li>
              <li>
                Process payments for contact unlocks, featured-listing
                boosts, and builder-suite access via Razorpay;
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
            <h2 className="text-lg font-bold text-plum">
              3. Sharing &amp; Disclosure
            </h2>
            <p className="mt-3">
              We do not sell your personal information. We share information
              only with:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>
                <strong className="text-plum">Service providers</strong> —
                Clerk (authentication), Razorpay (payment processing),
                Supabase (database and file storage), and hosting/CDN
                providers, each bound by their own privacy and security
                obligations;
              </li>
              <li>
                <strong className="text-plum">Other users</strong> — listing
                details you mark public, and your contact details with users
                who pay to unlock them;
              </li>
              <li>
                <strong className="text-plum">Legal authorities</strong> —
                where required to comply with a legal obligation, court
                order, or valid government request.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-plum">
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
            <h2 className="text-lg font-bold text-plum">5. Data Security</h2>
            <p className="mt-3">
              We implement reasonable technical and organizational measures
              — including encryption in transit, access controls, and
              secure third-party processors — to protect your information.
              However, no method of transmission or storage is completely
              secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-plum">
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
            <h2 className="text-lg font-bold text-plum">
              7. Your Rights &amp; Choices
            </h2>
            <p className="mt-3">
              Subject to applicable law, you may request access to,
              correction of, or deletion of your personal data, and may
              withdraw consent for optional processing (such as marketing
              communications) at any time. To exercise these rights, contact
              us at <strong className="text-plum">[SUPPORT EMAIL]</strong>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-plum">
              8. Grievance Officer
            </h2>
            <p className="mt-3">
              In accordance with the Information Technology Act, 2000 and
              rules made thereunder, the contact details of the Grievance
              Officer are provided below:
            </p>
            <p className="mt-3">
              <strong className="text-plum">
                [GRIEVANCE OFFICER NAME]
              </strong>
              <br />
              [LEGAL ENTITY NAME]
              <br />
              [REGISTERED ADDRESS]
              <br />
              Email: [SUPPORT EMAIL]
              <br />
              Phone: [SUPPORT PHONE]
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-plum">
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
            <h2 className="text-lg font-bold text-plum">10. Contact Us</h2>
            <p className="mt-3">
              For questions about this Privacy Policy, contact us at{" "}
              <strong className="text-plum">[SUPPORT EMAIL]</strong> or see
              our <a href="/contact" className="underline hover:text-plum">
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
