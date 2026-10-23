import Link from "next/link";
import { ApartmentsIcon, HouseIcon, LogoMark, SearchIcon } from "./icons";

const TABS = [
  { label: "Home", href: "/", Icon: LogoMark },
  { label: "Find", href: "/find", Icon: SearchIcon },
  { label: "Builder", href: "/designer", Icon: ApartmentsIcon },
  // separate deployment — plain anchor, no prefetch
  { label: "Lite", href: "https://archit-lit.chaudharyankit.in/", Icon: HouseIcon },
];

/**
 * Bottom tab bar for phones, where Navbar hides its links (below `md`).
 * Pads by the home-indicator inset (needs viewport-fit=cover, app/layout).
 */
export default function MobileTabBar({ active }: { active: string }) {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-white/70 bg-cream/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_#3d183014] backdrop-blur md:hidden"
    >
      <ul className="mx-auto flex max-w-md justify-around px-2">
        {TABS.map(({ label, href, Icon }) => {
          const current = href === active;
          const cls = `flex min-w-16 flex-col items-center gap-1 px-3 pb-2 pt-2.5 text-[11px] font-bold ${
            current ? "text-plum" : "text-plum-soft"
          }`;
          const body = (
            <>
              <Icon width={22} height={22} aria-hidden />
              {label}
            </>
          );
          return (
            <li key={label}>
              {href.startsWith("/") ? (
                <Link href={href} className={cls} aria-current={current ? "page" : undefined}>
                  {body}
                </Link>
              ) : (
                <a href={href} className={cls}>
                  {body}
                </a>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
