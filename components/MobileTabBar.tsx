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
 * A hairline instead of a shadow, like the landing's bands; the current tab
 * gets an accent rule along its top edge.
 */
export default function MobileTabBar({ active }: { active: string }) {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="mx-auto flex max-w-md justify-around px-2">
        {TABS.map(({ label, href, Icon }) => {
          const current = href === active;
          const cls = `relative flex min-h-14 min-w-16 flex-col items-center justify-center gap-1 rounded-[5px] px-3 pb-2 pt-2.5 text-[11px] font-bold tracking-[0.04em] transition-colors focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-accent ${
            current
              ? "text-accent before:absolute before:inset-x-3 before:top-0 before:h-0.5 before:bg-accent"
              : "text-ink-soft hover:text-ink"
          }`;
          const body = (
            <>
              <Icon width={22} height={22} aria-hidden="true" />
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
