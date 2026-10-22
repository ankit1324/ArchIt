import Link from "next/link";

import { LogoMark } from "./icons";
import NavAuth from "./NavAuth";

const LINKS: Array<{ label: string; href: string }> = [
  { label: "Home", href: "/" },
  { label: "Find", href: "/find" },
  { label: "Designer", href: "/designer" },
  { label: "ArchIt Lite", href: "https://archit-lit.chaudharyankit.in/" },
];

export default function Navbar() {
  return (
    <header className="relative z-20 flex h-16 shrink-0 items-center justify-between bg-cream px-6">
      <Link href="/" className="flex items-center gap-2 text-plum">
        <LogoMark width={30} height={30} />
        <span className="text-xl font-extrabold tracking-wide">ArchIt</span>
      </Link>

      <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-10 md:flex">
        {LINKS.map((l, i) => {
          const cls = `text-[13.5px] font-semibold transition-colors hover:text-plum ${
            i === 0 ? "text-plum" : "text-plum-soft"
          }`;
          // ArchIt Lite is a separate deployment — plain anchor, no prefetch
          return l.href.startsWith("/") ? (
            <Link key={l.label} href={l.href} className={cls}>
              {l.label}
            </Link>
          ) : (
            <a key={l.label} href={l.href} className={cls}>
              {l.label}
            </a>
          );
        })}
      </nav>

      <div className="flex items-center gap-3">
        <NavAuth />
      </div>
    </header>
  );
}
