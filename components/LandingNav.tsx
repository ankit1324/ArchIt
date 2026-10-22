"use client";

import { useState } from "react";
import TrackedLink from "./TrackedLink";
import styles from "./MarketingLanding.module.css";

/** The landing page's only stateful piece: the mobile menu toggle. */
export default function LandingNav() {
  const [menuOpen, setMenuOpen] = useState(false);
  const close = () => setMenuOpen(false);
  return <>
    <button className={styles.menuToggle} aria-expanded={menuOpen} aria-controls="landing-nav" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? "Close" : "Menu"} <span aria-hidden="true">{menuOpen ? "−" : "+"}</span></button>
    <nav id="landing-nav" aria-label="Main navigation" className={`${styles.nav} ${menuOpen ? styles.navOpen : ""}`} onKeyDown={(e) => { if (e.key === "Escape") close(); }}>
      <a href="#layouts" onClick={close}>Starter layouts</a>
      <a href="#how-it-works" onClick={close}>How it works</a>
      <TrackedLink href="/find" cta="nav_find" className={styles.textButton}>Find a property ↗</TrackedLink>
      <TrackedLink href="/sign-in" cta="nav_sign_in" className={styles.signIn}>Sign in <span aria-hidden="true">↗</span></TrackedLink>
    </nav>
  </>;
}
