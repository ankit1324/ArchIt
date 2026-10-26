const LINKS: Array<{ label: string; href: string }> = [
  { label: "Pricing", href: "/pricing" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Refunds", href: "/refunds" },
  { label: "Contact", href: "/contact" },
];

export default function Footer() {
  return (
    // py-6 + per-link py-1.5 keeps the footer's height while giving each link a
    // >=24px-tall hit area (WCAG 2.5.8); they sit close together when wrapped.
    <footer className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 px-6 py-6 text-[12.5px] font-semibold text-plum-soft">
      {LINKS.map((l) => (
        <a
          key={l.label}
          href={l.href}
          className="py-1.5 transition-colors hover:text-plum"
        >
          {l.label}
        </a>
      ))}
      <span className="text-plum-soft">
        © {new Date().getFullYear()} ArchIt
      </span>
    </footer>
  );
}
