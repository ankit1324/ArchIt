import Link from "next/link";

const LINKS: Array<{ label: string; href: string }> = [
  { label: "Pricing", href: "/pricing" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Refunds", href: "/refunds" },
  { label: "Contact", href: "/contact" },
];

/** Site footer, matching the landing page's (components/MarketingLanding.tsx). */
export default function Footer() {
  return (
    <footer className="mt-auto border-t border-line bg-paper text-ink">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-[clamp(20px,5.5vw,84px)] py-8 md:flex-row md:items-center md:justify-between md:gap-8">
        <p className="text-[13px] font-bold">
          ArchIt<span className="text-accent">.</span>
          <span className="ml-3 font-normal text-ink-soft">
            A place for your next idea.
          </span>
        </p>
        <nav aria-label="Footer navigation">
          {/* min-h-6: each link keeps a >=24px-tall hit area (WCAG 2.5.8) */}
          <ul className="flex flex-wrap items-center gap-x-6 gap-y-1 text-[12.5px] font-medium">
            {LINKS.map((l) => (
              <li key={l.label}>
                <Link
                  href={l.href}
                  prefetch={false}
                  className="inline-flex min-h-6 items-center rounded-[3px] underline-offset-4 transition-colors hover:text-accent hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  {l.label}
                </Link>
              </li>
            ))}
            <li className="text-ink-soft tabular-nums">
              © {new Date().getFullYear()} ArchIt
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
