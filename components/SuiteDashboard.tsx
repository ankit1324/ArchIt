import Link from "next/link";
import { Fraunces } from "next/font/google";
import Navbar from "@/components/Navbar";
import { ApartmentsIcon, HouseIcon, SearchIcon } from "@/components/icons";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
});

const PRODUCTS = [
  {
    name: "ArchIt Lite",
    tagline: "A taste of the atelier",
    body: "Explore a crafted 3D showcase home in your browser. No account, no cost — just walk in.",
    badge: "Free",
    badgeClass: "bg-lime text-plum",
    cta: "Try it free",
    href: "https://archit-lit.chaudharyankit.in/",
    external: true,
    Icon: HouseIcon,
    lift: "lg:translate-y-8",
  },
  {
    name: "ArchIt Find",
    tagline: "Every home, on a living map",
    body: "Fly over a 3D satellite city, browse real listings, list your own property and reach owners directly.",
    badge: "₹100 listing · ₹20 contact",
    badgeClass: "bg-magenta text-white",
    cta: "Open the map",
    href: "/find",
    external: false,
    Icon: SearchIcon,
    lift: "",
    featured: true,
  },
  {
    name: "ArchIt 3D Builder",
    tagline: "Your home, room by room",
    body: "Design a complete house in 3D — floors, facades, windows, furniture — then save and refine every idea.",
    badge: "Paid",
    badgeClass: "bg-plum text-cream",
    cta: "Start designing",
    href: "/designer",
    external: false,
    Icon: ApartmentsIcon,
    lift: "lg:translate-y-8",
  },
];

/** signed-in home: the product dashboard, cream/plum app skin */
export default function SuiteDashboard() {
  return (
    <div
      className={`${fraunces.variable} relative flex h-full flex-col overflow-y-auto overflow-x-hidden bg-cream`}
    >
      {/* atmosphere: soft blobs + grain */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -top-48 h-[560px] w-[560px] rounded-full opacity-60 blur-3xl"
        style={{
          background:
            "radial-gradient(circle at 35% 35%, #e9d5e4 0%, #f3e8ef 45%, transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-56 -left-40 h-[620px] w-[620px] rounded-full opacity-50 blur-3xl"
        style={{
          background:
            "radial-gradient(circle at 60% 40%, #e6ecc3 0%, #f0f2dd 45%, transparent 70%)",
        }}
      />

      <Navbar />

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col px-6 pb-16">
        <section className="pb-14 pt-14 text-center lg:pt-20">
          <p className="mb-5 text-[12px] font-bold uppercase tracking-[0.28em] text-plum-soft">
            The ArchIt suite
          </p>
          <h1
            className="mx-auto max-w-3xl text-[42px] leading-[1.06] text-plum sm:text-[58px]"
            style={{ fontFamily: "var(--font-fraunces)" }}
          >
            Dream it. <em className="text-magenta">Find</em> it.{" "}
            <em className="text-plum">Build</em> it.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-[15px] font-medium leading-relaxed text-plum-soft">
            You&apos;re signed in — pick up where you left off.
          </p>
        </section>

        <section className="grid gap-5 lg:grid-cols-3">
          {PRODUCTS.map((p) => (
            <article
              key={p.name}
              className={`group relative flex flex-col gap-4 rounded-[28px] p-7 transition-transform duration-300 hover:-translate-y-2 ${p.lift} ${
                p.featured
                  ? "bg-plum text-cream shadow-2xl"
                  : "glass text-plum shadow-lg"
              }`}
            >
              <div className="flex items-start justify-between">
                <span
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                    p.featured ? "bg-white/15" : "bg-plum/8"
                  }`}
                >
                  <p.Icon width={24} height={24} />
                </span>
                <span
                  className={`rounded-full px-3 py-1.5 text-[10.5px] font-bold ${p.badgeClass}`}
                >
                  {p.badge}
                </span>
              </div>

              <div>
                <h2
                  className="text-[26px] leading-tight"
                  style={{ fontFamily: "var(--font-fraunces)" }}
                >
                  {p.name}
                </h2>
                <p
                  className={`mt-0.5 text-[12.5px] font-semibold italic ${
                    p.featured ? "text-cream/70" : "text-plum-soft"
                  }`}
                  style={{ fontFamily: "var(--font-fraunces)" }}
                >
                  {p.tagline}
                </p>
              </div>

              <p
                className={`flex-1 text-[13.5px] font-medium leading-relaxed ${
                  p.featured ? "text-cream/85" : "text-plum-soft"
                }`}
              >
                {p.body}
              </p>

              {p.external ? (
                <a
                  href={p.href}
                  target="_blank"
                  rel="noreferrer"
                  className={`rounded-full py-3 text-center text-[13.5px] font-bold transition-opacity hover:opacity-90 ${
                    p.featured ? "bg-cream text-plum" : "bg-plum text-cream"
                  }`}
                >
                  {p.cta} ↗
                </a>
              ) : (
                <Link
                  href={p.href}
                  className={`rounded-full py-3 text-center text-[13.5px] font-bold transition-opacity hover:opacity-90 ${
                    p.featured ? "bg-cream text-plum" : "bg-plum text-cream"
                  }`}
                >
                  {p.cta} →
                </Link>
              )}
            </article>
          ))}
        </section>

        <footer className="mt-16 flex flex-wrap items-center justify-center gap-x-8 gap-y-2 text-[11px] font-bold uppercase tracking-[0.2em] text-plum-soft/60">
          <span>Secured by Clerk</span>
          <span aria-hidden>·</span>
          <span>Data on Supabase</span>
          <span aria-hidden>·</span>
          <span>Payments by Razorpay</span>
        </footer>
      </main>
    </div>
  );
}
