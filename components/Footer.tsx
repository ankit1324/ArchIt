const LINKS: Array<{ label: string; href: string }> = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Refunds", href: "/refunds" },
  { label: "Contact", href: "/contact" },
];

export default function Footer() {
  return (
    <footer className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 px-6 py-8 text-[12.5px] font-semibold text-plum-soft">
      {LINKS.map((l) => (
        <a
          key={l.label}
          href={l.href}
          className="transition-colors hover:text-plum"
        >
          {l.label}
        </a>
      ))}
      <span className="text-plum-soft/60">
        © {new Date().getFullYear()} ArchIt
      </span>
    </footer>
  );
}
