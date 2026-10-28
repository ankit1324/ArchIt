"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useRef, useState } from "react";

import { LogoMark } from "./icons";
import NavAuth from "./NavAuth";

const LINKS: Array<{ label: string; href: string }> = [
  { label: "Home", href: "/" },
  { label: "Find", href: "/find" },
  { label: "Designer", href: "/designer" },
  { label: "Showcase", href: "/showcase" },
  { label: "ArchIt Lite", href: "https://archit-lit.chaudharyankit.in/" },
];

const FOCUS =
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent";

function isCurrent(pathname: string, href: string) {
  if (!href.startsWith("/")) return false;
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Suite header. `site` mirrors the landing page header (components/
 * MarketingLanding.tsx) for marketing, legal and public pages; `app` is the
 * compact 64px bar above the /find map and the dashboard, where vertical
 * space belongs to the content.
 */
export default function Navbar({ variant = "site" }: { variant?: "site" | "app" }) {
  const app = variant === "app";
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const close = () => setOpen(false);

  // Close the menu when the route changes (a link inside it was followed, or
  // back/forward). Adjusting state during render, not in an effect, avoids a
  // frame with the stale menu painted over the new page.
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setOpen(false);
  }

  const link = (l: (typeof LINKS)[number], cls: string) => {
    const current = isCurrent(pathname, l.href);
    // ArchIt Lite is a separate deployment: plain anchor, no prefetch
    return l.href.startsWith("/") ? (
      <Link
        key={l.label}
        href={l.href}
        aria-current={current ? "page" : undefined}
        onClick={close}
        className={cls}
      >
        {l.label}
      </Link>
    ) : (
      <a key={l.label} href={l.href} onClick={close} className={cls}>
        {l.label}
        <span aria-hidden="true" className="ml-1.5">
          ↗
        </span>
      </a>
    );
  };

  return (
    <header
      className="relative z-30 shrink-0 border-b border-line bg-paper text-ink"
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          close();
          toggleRef.current?.focus();
        }
      }}
    >
      <div
        className={
          app
            ? "flex h-16 items-center justify-between gap-6 px-4 sm:px-6"
            : "mx-auto flex min-h-[72px] max-w-[1400px] items-center justify-between gap-8 px-[clamp(20px,5.5vw,84px)] md:min-h-24"
        }
      >
        <Link
          href="/"
          aria-label="ArchIt home"
          className={`flex shrink-0 items-center gap-2 rounded-[5px] font-extrabold ${FOCUS} ${
            app ? "text-[21px] tracking-[-0.04em]" : "text-[24px] tracking-[-0.055em] md:text-[28px]"
          }`}
        >
          <LogoMark
            width={app ? 22 : 27}
            height={app ? 22 : 27}
            className="text-accent"
            aria-hidden="true"
          />
          <span>
            ArchIt<span className="text-accent">.</span>
          </span>
        </Link>

        <nav
          aria-label="Main navigation"
          className={`hidden items-center md:flex ${app ? "gap-7" : "gap-[30px]"}`}
        >
          {LINKS.map((l) =>
            link(
              l,
              // min-h-6: WCAG 2.5.8 target size for standalone text links
              `inline-flex min-h-6 items-center rounded-[3px] text-[12.5px] font-semibold transition-colors hover:text-accent aria-[current=page]:underline aria-[current=page]:decoration-accent aria-[current=page]:decoration-[1.5px] aria-[current=page]:underline-offset-[7px] ${FOCUS}`,
            ),
          )}
        </nav>

        <div className="flex items-center gap-3 sm:gap-5">
          <NavAuth />
          <button
            ref={toggleRef}
            type="button"
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => setOpen((o) => !o)}
            className={`inline-flex min-h-10 items-center gap-3 rounded-[5px] border border-line-strong px-3 text-[12px] font-semibold transition-colors hover:border-ink md:hidden ${FOCUS}`}
          >
            {open ? "Close" : "Menu"}
            <span aria-hidden="true" className="w-2 text-center">
              {open ? "−" : "+"}
            </span>
          </button>
        </div>
      </div>

      {/* Mobile menu: drops over the page instead of pushing it down, so the
          /find map underneath does not resize while it is open. */}
      <nav
        id={menuId}
        aria-label="Main navigation"
        hidden={!open}
        className="absolute inset-x-0 top-full border-b border-line bg-paper px-[clamp(20px,5.5vw,84px)] pb-4 md:hidden"
      >
        {LINKS.map((l) =>
          link(
            l,
            `flex min-h-12 items-center justify-between border-t border-line text-[15px] font-semibold first:border-t-0 hover:text-accent aria-[current=page]:text-accent ${FOCUS}`,
          ),
        )}
      </nav>
    </header>
  );
}
