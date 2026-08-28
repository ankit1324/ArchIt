"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import localFont from "next/font/local";
import Image from "next/image";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { feeLabel } from "@/lib/fees";

// Self-hosted rather than next/font/google: a build that has to reach Google
// Fonts is a build that can fail offline. See assets/fonts/README.md.
// Fraunces and Manrope collapse to one variable file each; Plex Mono has no
// variable release, so it still needs one file per weight we use.
const fraunces = localFont({
  src: [
    { path: "../assets/fonts/fraunces-latin-wght-normal.woff2", weight: "100 900", style: "normal" },
    { path: "../assets/fonts/fraunces-latin-wght-italic.woff2", weight: "100 900", style: "italic" },
  ],
  variable: "--f-disp",
  // next/font/google inferred a serif metric fallback for Fraunces; next/font/local
  // defaults to Arial, which would reflow the 148px display headings during swap.
  adjustFontFallback: "Times New Roman",
});
const manrope = localFont({
  src: "../assets/fonts/manrope-latin-wght-normal.woff2",
  weight: "200 800", // the file's own wght range; 400–800 is what we actually use
  style: "normal",
  variable: "--f-body",
});
const plexMono = localFont({
  src: [
    { path: "../assets/fonts/ibm-plex-mono-latin-400-normal.woff2", weight: "400", style: "normal" },
    { path: "../assets/fonts/ibm-plex-mono-latin-500-normal.woff2", weight: "500", style: "normal" },
    { path: "../assets/fonts/ibm-plex-mono-latin-600-normal.woff2", weight: "600", style: "normal" },
  ],
  variable: "--f-mono",
});

const TICKER = [
  "WIREFRAME → HOME",
  "FREE 3D SHOWCASE",
  "SATELLITE MAP OF REAL LISTINGS",
  "ROOM-BY-ROOM BUILDER",
  "CHANDIGARH & BEYOND",
  "NO CAD DEGREE REQUIRED",
];

const css = `
.mx{height:100%;overflow-y:auto;overflow-x:hidden;scroll-behavior:smooth;
  /* ------- dark: blueprint cinema ------- */
  --bg:#070b16;--bg-rgb:7,11,22;--bg2:#0a1122;--panel:#0d1526;
  --fg:#eef1ea;--sub:#c3cde0;--body-c:#b9c4d9;--muted:#8b99b5;--faint:#5b6884;
  --accent:#7fd8ff;--accent-deep:#3ba7e8;--accent-fg:#071120;
  --glow-rgb:101,190,255;--glow:rgba(101,190,255,.32);
  --frame-rgb:148,196,255;--line:rgba(148,196,255,.14);--line2:rgba(148,196,255,.26);
  --btn-bg:#eef1ea;--btn-fg:#070b16;
  --hdr-rgb:7,11,22;--tick-bg:rgba(10,17,34,.5);
  --bar-bg:linear-gradient(#131d33,#0d1526);--url-bg:rgba(7,11,22,.6);
  --shadow-a:.65;--h1-sh:rgba(0,0,0,.55);--noise-o:.05;
  --atmo-a:rgba(59,120,220,.14);--atmo-b:rgba(59,167,232,.08);
  --isl-bg:#eef1ea;--isl-fg:#1d1d1b;--isl-kick:#8b8b84;--isl-grid:rgba(29,29,27,.05);
  --pad:min(6.5vw,92px);
  background:var(--bg);color:var(--fg);
  font-family:var(--f-body),sans-serif;-webkit-font-smoothing:antialiased;
  transition:background-color .5s ease,color .5s ease}
/* ------- light: atelier cream / plum / magenta (suite dashboard palette) ------- */
.mx[data-theme="light"]{
  --bg:#f5f1ea;--bg-rgb:245,241,234;--bg2:#efe9df;--panel:#ffffff;
  --fg:#3d1830;--sub:#6b4560;--body-c:#6b4560;--muted:#8a7383;--faint:#ab98a4;
  --accent:#e857c2;--accent-deep:#c437a0;--accent-fg:#ffffff;
  --glow-rgb:232,87,194;--glow:rgba(232,87,194,.22);
  --frame-rgb:61,24,48;--line:rgba(61,24,48,.12);--line2:rgba(61,24,48,.22);
  --btn-bg:#3d1830;--btn-fg:#f5f1ea;
  --hdr-rgb:245,241,234;--tick-bg:rgba(239,233,223,.65);
  --bar-bg:linear-gradient(#faf6ef,#efe9df);--url-bg:rgba(255,255,255,.75);
  --shadow-a:.22;--h1-sh:rgba(61,24,48,.14);--noise-o:.035;
  --atmo-a:rgba(177,140,240,.2);--atmo-b:rgba(232,87,194,.1);
  --isl-bg:#3d1830;--isl-fg:#f5f1ea;--isl-kick:#c7a9bd;--isl-grid:rgba(245,241,234,.07)}
.mx ::selection{background:var(--accent);color:var(--bg)}
.mx a{color:inherit}
.mx .mono{font-family:var(--f-mono),monospace}
.mx .disp{font-family:var(--f-disp),serif}

/* blueprint grid + vignette atmosphere */
.mx .atmo{position:fixed;inset:0;pointer-events:none;z-index:0;
  background:
    radial-gradient(1200px 700px at 70% -10%, var(--atmo-a), transparent 60%),
    radial-gradient(900px 600px at 10% 110%, var(--atmo-b), transparent 55%)}
.mx .atmo::before{content:"";position:absolute;inset:0;opacity:.5;
  background:
    linear-gradient(var(--line) 1px, transparent 1px),
    linear-gradient(90deg, var(--line) 1px, transparent 1px);
  background-size:72px 72px;
  mask-image:radial-gradient(ellipse 90% 70% at 50% 30%, black 0%, transparent 100%)}
.mx .atmo::after{content:"";position:absolute;inset:0;opacity:var(--noise-o);mix-blend-mode:overlay;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E")}

.mx>*{position:relative;z-index:1}

/* ---------- header ---------- */
.mx header{position:sticky;top:0;z-index:60;display:flex;align-items:center;justify-content:space-between;
  height:84px;padding:0 var(--pad);
  background:linear-gradient(to bottom, rgba(var(--hdr-rgb),.9), rgba(var(--hdr-rgb),.55) 70%, transparent);
  backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.mx .logo{display:inline-flex;align-items:center;gap:11px;font-weight:800;font-size:23px;letter-spacing:-.02em;text-decoration:none}
.mx .logo svg{width:32px;height:32px;color:var(--accent);transition:transform .5s cubic-bezier(.2,.8,.2,1)}
.mx .logo:hover svg{transform:rotate(-8deg) scale(1.1)}
.mx .logo i{font-style:normal;color:var(--accent)}
.mx .hdr-right{display:flex;align-items:center;gap:24px}
.mx .quiet{font-weight:600;font-size:14px;color:var(--muted);text-decoration:none;background:none;border:none;
  cursor:pointer;font-family:inherit;transition:color .25s}
.mx .quiet:hover{color:var(--fg)}
.mx .theme-btn{display:grid;place-items:center;width:38px;height:38px;border-radius:50%;cursor:pointer;
  background:transparent;border:1.5px solid var(--line2);color:var(--fg);
  transition:transform .3s cubic-bezier(.2,.8,.2,1), box-shadow .3s, border-color .3s}
.mx .theme-btn:hover{transform:rotate(20deg) scale(1.08);border-color:var(--accent);box-shadow:0 0 24px var(--glow)}
.mx .theme-btn svg{width:17px;height:17px}
.mx .cta{display:inline-flex;align-items:center;justify-content:center;gap:9px;
  background:var(--btn-bg);color:var(--btn-fg);font-weight:700;font-size:14.5px;padding:13px 24px;border-radius:999px;
  cursor:pointer;border:none;font-family:inherit;text-decoration:none;white-space:nowrap;
  transition:transform .3s cubic-bezier(.2,.8,.2,1), box-shadow .3s}
.mx .cta:hover{transform:scale(1.045);box-shadow:0 0 0 1px var(--line2), 0 12px 40px var(--glow)}
.mx .cta.ghost{background:transparent;color:var(--fg);box-shadow:inset 0 0 0 1.5px var(--line2)}
.mx .cta.ghost:hover{box-shadow:inset 0 0 0 1.5px var(--accent-deep), 0 10px 34px var(--glow)}
.mx .cta.glow{background:var(--accent);color:var(--accent-fg)}

/* mobile nav — rendered always, shown only ≤640px (see media query) */
.mx .burger{display:none}
.mx .m-menu{display:none}

/* ---------- hero (scroll scrub: full-bleed film -> framed plate) ---------- */
.mx .hero{height:250vh;margin-top:-84px}
.mx .hero-pin{position:sticky;top:0;height:100vh;overflow:hidden}
.mx .hero-media{position:absolute;inset:0;overflow:hidden;background:var(--bg2);
  transform:scale(calc(1 - .17*var(--p,0)));
  border-radius:calc(var(--p,0)*30px);
  box-shadow:0 0 0 1px rgba(var(--frame-rgb), calc(var(--p,0)*.35)), 0 30px 90px rgba(0,0,0, calc(var(--p,0)*var(--shadow-a))), 0 0 calc(var(--p,0)*90px) rgba(var(--glow-rgb), calc(var(--p,0)*.22))}
.mx .hero-media video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
/* poster still over the film until it can loop smoothly — kills first-frame jank */
.mx .hero-media .hero-still{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;
  opacity:1;transition:opacity .55s ease}
.mx .hero-media .hero-still.hidden{opacity:0;pointer-events:none}
.mx .hero-media .scrim{position:absolute;inset:0;
  background:
    radial-gradient(ellipse 120% 90% at 50% 45%, transparent 40%, rgba(var(--bg-rgb), calc(.72 - var(--p,0)*.4)) 100%),
    linear-gradient(to top, rgba(var(--bg-rgb), calc(.85 - var(--p,0)*.5)) 0%, transparent 45%)}
/* blueprint corner ticks that draw in as the plate forms */
.mx .tick{position:absolute;width:26px;height:26px;opacity:var(--p,0);z-index:3}
.mx .tick::before,.mx .tick::after{content:"";position:absolute;background:var(--accent)}
.mx .tick::before{width:100%;height:1.5px}.mx .tick::after{width:1.5px;height:100%}
.mx .tick.tl{top:16px;left:16px}.mx .tick.tr{top:16px;right:16px;transform:scaleX(-1)}
.mx .tick.bl{bottom:16px;left:16px;transform:scaleY(-1)}.mx .tick.br{bottom:16px;right:16px;transform:scale(-1)}
.mx .plate-meta{position:absolute;z-index:3;font-size:11px;letter-spacing:.14em;color:var(--accent);
  opacity:calc(var(--p,0)*1.4 - .35);text-transform:uppercase}
.mx .plate-meta.a{top:22px;left:56px}
.mx .plate-meta.b{bottom:22px;right:56px}
.mx .plate-meta.c{bottom:22px;left:56px;color:var(--muted)}

.mx .hero-copy{position:absolute;inset:0;z-index:4;display:flex;flex-direction:column;align-items:center;justify-content:center;
  text-align:center;padding:0 var(--pad);
  opacity:calc(1 - var(--p,0)*2.1);
  transform:translateY(calc(var(--p,0)*-90px));
  pointer-events:none}
.mx .hero-copy>*{pointer-events:auto}
.mx .hero-kicker{font-size:12px;letter-spacing:.3em;color:var(--accent);text-transform:uppercase;
  display:flex;align-items:center;gap:14px;animation:mx-rise .9s cubic-bezier(.2,.8,.2,1) both .1s}
.mx .hero-kicker::before,.mx .hero-kicker::after{content:"";width:44px;height:1px;background:var(--accent-deep)}
.mx h1{font-family:var(--f-disp),serif;font-weight:500;font-size:clamp(56px,9.6vw,148px);line-height:1.02;
  letter-spacing:-.03em;margin:26px 0 0;text-shadow:0 8px 60px var(--h1-sh)}
.mx h1 .l{display:block;animation:mx-rise 1s cubic-bezier(.2,.8,.2,1) both}
.mx h1 .l:nth-child(1){animation-delay:.22s}
.mx h1 .l:nth-child(2){animation-delay:.38s}
.mx h1 .l:nth-child(3){animation-delay:.54s}
.mx h1 em{font-style:italic;color:var(--accent)}
@keyframes mx-rise{from{opacity:0;transform:translateY(42px)}to{opacity:1;transform:translateY(0)}}
.mx .hero-sub{margin-top:26px;max-width:52ch;font-size:16.5px;line-height:1.7;color:var(--sub);font-weight:500;
  animation:mx-rise 1s cubic-bezier(.2,.8,.2,1) both .72s}
.mx .hero-ctas{display:flex;gap:14px;margin-top:36px;flex-wrap:wrap;justify-content:center;
  animation:mx-rise 1s cubic-bezier(.2,.8,.2,1) both .86s}
/* light theme: the suite film carries its own titles — drop the overlay text, keep CTAs low */
.mx[data-theme="light"] .hero-copy{justify-content:flex-end;padding-bottom:110px}
.mx[data-theme="light"] .hero-copy h1,
.mx[data-theme="light"] .hero-copy .hero-sub,
.mx[data-theme="light"] .hero-copy .hero-kicker{display:none}
.mx[data-theme="light"] .hero-ctas{margin-top:0}
.mx[data-theme="light"] .hero-media .scrim{background:
  linear-gradient(to top, rgba(var(--bg-rgb), calc(.8 - var(--p,0)*.55)) 0%, transparent 32%)}
.mx .scroll-cue{position:absolute;bottom:26px;left:50%;transform:translateX(-50%);z-index:4;
  display:flex;flex-direction:column;align-items:center;gap:10px;font-size:10.5px;letter-spacing:.28em;color:var(--muted);
  text-transform:uppercase;opacity:calc(1 - var(--p,0)*4)}
.mx .scroll-cue .wheel{width:1.5px;height:44px;background:linear-gradient(var(--accent), transparent);position:relative;overflow:hidden}
.mx .scroll-cue .wheel::after{content:"";position:absolute;top:-40%;left:0;width:100%;height:40%;
  background:var(--fg);animation:mx-drop 1.8s ease-in-out infinite}
@keyframes mx-drop{to{top:120%}}

/* ---------- ticker ---------- */
.mx .ticker{border-top:1px solid var(--line);border-bottom:1px solid var(--line);
  overflow:hidden;white-space:nowrap;padding:16px 0;background:var(--tick-bg)}
.mx .ticker-track{display:inline-flex;align-items:center;gap:34px;animation:mx-mq 32s linear infinite;padding-right:34px}
@keyframes mx-mq{to{transform:translateX(-50%)}}
.mx .ticker span{font-family:var(--f-mono),monospace;font-size:12px;letter-spacing:.18em;color:var(--muted);
  display:inline-flex;align-items:center;gap:34px}
.mx .ticker span:nth-child(odd){color:var(--accent)}
.mx .ticker b{color:var(--faint);font-weight:400}

/* ---------- chapters ---------- */
.mx .chapters{padding-top:40px}
.mx .chap{height:185vh;position:relative}
.mx .chap-pin{position:sticky;top:0;height:100vh;display:grid;grid-template-columns:minmax(320px,46fr) 54fr;
  align-items:center;gap:min(5vw,70px);padding:0 var(--pad);overflow:hidden;
  --e:min(calc(var(--v,0)*1.25),1)}
.mx .chap.flip .chap-pin{grid-template-columns:54fr minmax(320px,46fr)}
.mx .chap.flip .chap-text{order:2}
.mx .chap-num{position:absolute;top:50%;font-family:var(--f-disp),serif;font-size:clamp(200px,34vw,460px);line-height:1;
  font-weight:400;color:transparent;-webkit-text-stroke:1px var(--line2);z-index:0;user-select:none;
  transform:translateY(calc(-50% + (1 - var(--e))*120px - var(--p,0)*60px));opacity:calc(var(--e)*.9)}
.mx .chap-num.left{left:calc(var(--pad)*.4)}
.mx .chap-num.right{right:calc(var(--pad)*.4)}
.mx .chap-text{position:relative;z-index:2;
  opacity:var(--e);transform:translateY(calc((1 - var(--e))*60px))}
.mx .chap-kicker{font-family:var(--f-mono),monospace;font-size:11.5px;letter-spacing:.26em;color:var(--accent);
  text-transform:uppercase;display:flex;align-items:center;gap:12px}
.mx .chap-kicker::before{content:"";width:34px;height:1px;background:var(--accent-deep)}
.mx .chap-text h2{font-family:var(--f-disp),serif;font-weight:500;font-size:clamp(34px,3.8vw,58px);line-height:1.08;
  letter-spacing:-.02em;margin:20px 0 18px}
.mx .chap-text h2 em{font-style:italic;color:var(--accent)}
.mx .chap-text p{font-size:16px;line-height:1.75;color:var(--body-c);font-weight:500;max-width:44ch}
.mx .chap-link{display:inline-flex;align-items:center;gap:10px;margin-top:26px;font-weight:700;font-size:14.5px;
  color:var(--fg);text-decoration:none;border-bottom:1.5px solid var(--accent-deep);padding-bottom:5px;
  transition:gap .3s, color .3s}
.mx .chap-link:hover{gap:16px;color:var(--accent)}

/* the framed screen */
.mx .chap-frame{position:relative;z-index:1;
  transform:perspective(1500px) rotateX(calc((1 - var(--e))*13deg)) translateY(calc((1 - var(--e))*110px - var(--p,0)*36px));
  opacity:calc(var(--e)*1.15)}
.mx .screen{border-radius:18px;overflow:hidden;background:var(--panel);
  box-shadow:0 0 0 1px var(--line2), 0 40px 110px rgba(0,0,0,var(--shadow-a)), 0 0 70px var(--glow)}
.mx .screen .bar{display:flex;align-items:center;gap:8px;height:42px;padding:0 16px;
  background:var(--bar-bg);border-bottom:1px solid var(--line)}
.mx .screen .dot{width:10px;height:10px;border-radius:50%}
.mx .screen .dot:nth-child(1){background:#ff5f57}.mx .screen .dot:nth-child(2){background:#febc2e}.mx .screen .dot:nth-child(3){background:#28c840}
.mx .screen .url{flex:1;max-width:340px;margin:0 auto;text-align:center;font-family:var(--f-mono),monospace;
  font-size:11.5px;color:var(--muted);background:var(--url-bg);border:1px solid var(--line);
  border-radius:8px;padding:5px 14px;letter-spacing:.04em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mx .screen video{display:block;width:100%;aspect-ratio:16/9;object-fit:cover}
/* cinema variant (no browser chrome, letterboxed HUD) */
.mx .screen.cine .bar{display:none}
.mx .screen.cine{position:relative}
.mx .screen.cine .hud{position:absolute;inset:0;pointer-events:none;z-index:2;
  font-family:var(--f-mono),monospace;font-size:10.5px;letter-spacing:.16em;color:#7fd8ff;text-transform:uppercase}
.mx .screen.cine .hud span{position:absolute}
.mx .screen.cine .hud .rec{top:14px;left:16px;display:flex;align-items:center;gap:7px}
.mx .screen.cine .hud .rec i{width:8px;height:8px;border-radius:50%;background:#ff5f57;animation:mx-blink 1.4s steps(1) infinite}
@keyframes mx-blink{50%{opacity:.15}}
.mx .screen.cine .hud .tc{top:14px;right:16px}
.mx .screen.cine .hud .fig{bottom:12px;left:16px;color:#8b99b5}
.mx .frame-caption{display:flex;justify-content:space-between;gap:16px;margin-top:14px;
  font-family:var(--f-mono),monospace;font-size:11px;letter-spacing:.14em;color:var(--faint);text-transform:uppercase}
.mx .frame-caption b{color:var(--muted);font-weight:500}

/* ---------- demo theater ---------- */
.mx .theater{padding:140px var(--pad) 30px}
.mx .sec-head{display:grid;grid-template-columns:230px 1fr;gap:40px;align-items:end;margin-bottom:64px}
.mx .kicker{font-family:var(--f-mono),monospace;font-size:11.5px;letter-spacing:.26em;color:var(--accent);text-transform:uppercase;padding-bottom:12px}
.mx .sec-head h2{font-family:var(--f-disp),serif;font-weight:500;font-size:clamp(38px,5vw,72px);line-height:1.05;letter-spacing:-.025em}
.mx .sec-head h2 em{font-style:italic;color:var(--accent)}
.mx .sec-head p{grid-column:2;margin-top:16px;color:var(--muted);font-size:15.5px;max-width:56ch;line-height:1.7}
.mx .reel-grid{display:grid;grid-template-columns:1fr 1fr;gap:30px}
.mx .reel{grid-column:span 1;border-radius:20px;overflow:hidden;background:var(--panel);
  box-shadow:0 0 0 1px var(--line);transition:box-shadow .4s, transform .4s}
.mx .reel:hover{box-shadow:0 0 0 1px var(--line2), 0 30px 80px rgba(0,0,0,calc(var(--shadow-a)*.8)), 0 0 60px var(--glow);transform:translateY(-4px)}
.mx .reel.wide{grid-column:1/-1}
.mx .reel video{display:block;width:100%;aspect-ratio:16/9;object-fit:cover;background:#000}
.mx .reel-info{display:flex;align-items:baseline;justify-content:space-between;gap:20px;padding:20px 24px 22px}
.mx .reel-info h3{font-family:var(--f-disp),serif;font-weight:500;font-size:22px;letter-spacing:-.01em}
.mx .reel-info h3 small{display:block;font-family:var(--f-body),sans-serif;font-size:13.5px;font-weight:500;color:var(--muted);margin-top:6px;letter-spacing:0;line-height:1.55}
.mx .reel-meta{font-family:var(--f-mono),monospace;font-size:10.5px;letter-spacing:.14em;color:var(--faint);
  text-transform:uppercase;white-space:nowrap;text-align:right;line-height:1.9}
.mx .reel-meta b{color:var(--accent);font-weight:500}

/* ---------- products island (flips against theme) ---------- */
.mx .island{margin:140px calc(var(--pad)*.5) 0;background:var(--isl-bg);color:var(--isl-fg);border-radius:44px;
  padding:100px calc(var(--pad)*.7) 90px;position:relative;overflow:hidden;
  transition:background-color .5s ease,color .5s ease}
.mx .island::before{content:"";position:absolute;inset:0;opacity:.55;pointer-events:none;
  background:
    linear-gradient(var(--isl-grid) 1px, transparent 1px),
    linear-gradient(90deg, var(--isl-grid) 1px, transparent 1px);
  background-size:64px 64px;
  mask-image:radial-gradient(ellipse 80% 60% at 50% 0%, black, transparent)}
.mx .island .kicker{color:var(--isl-kick)}
.mx .island .sec-head{margin-bottom:70px}
.mx .prod-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:26px;position:relative}
.mx .prod{background:#fff;color:#1d1d1b;border:1.5px solid rgba(29,29,27,.1);border-radius:26px;padding:30px 28px 28px;
  display:flex;flex-direction:column;transition:transform .4s cubic-bezier(.2,.8,.2,1), box-shadow .4s}
.mx .prod:hover{transform:translateY(-6px);box-shadow:0 26px 60px rgba(29,29,27,.2)}
.mx .prod-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:22px}
.mx .prod-top svg{width:40px;height:40px}
.mx .badge{border:1.5px solid #1d1d1b;border-radius:999px;padding:6px 13px;font-size:11px;font-weight:800;letter-spacing:.06em;white-space:nowrap}
.mx .prod h3{font-family:var(--f-disp),serif;font-weight:600;font-size:24px;letter-spacing:-.01em}
.mx .prod h3 small{display:block;font-family:var(--f-mono),monospace;font-size:10.5px;font-weight:500;color:#8b8b84;
  letter-spacing:.18em;text-transform:uppercase;margin-top:7px}
.mx .prod p{font-size:15px;line-height:1.68;color:#3a3a36;font-weight:500;margin:14px 0 22px;flex:1}
.mx .prod .cta{background:#1d1d1b;color:#eef1ea;align-self:flex-start;padding:13px 22px;font-size:14px}
.mx[data-theme="light"] .prod .cta{background:#3d1830;color:#f5f1ea}
.mx .prod .cta:hover{box-shadow:0 12px 34px rgba(29,29,27,.3)}
.mx .lock{font-family:var(--f-mono),monospace;font-size:10px;color:#8b8b84;margin-top:12px;letter-spacing:.14em;text-transform:uppercase}

/* ---------- finale ---------- */
.mx .finale{padding:170px var(--pad) 60px;text-align:center;position:relative;overflow:hidden}
.mx .finale::before{content:"";position:absolute;left:50%;top:60px;transform:translateX(-50%);
  width:min(900px,90vw);height:420px;border-radius:50%;filter:blur(90px);
  background:radial-gradient(ellipse, rgba(var(--glow-rgb),.17), transparent 70%);pointer-events:none}
.mx .finale h2{font-family:var(--f-disp),serif;font-weight:500;font-size:clamp(44px,7vw,110px);line-height:1.04;
  letter-spacing:-.03em;position:relative}
.mx .finale h2 em{font-style:italic;color:var(--accent)}
.mx .finale .row{display:flex;gap:16px;justify-content:center;flex-wrap:wrap;margin-top:44px;position:relative}
.mx .foot{display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap;margin-top:150px;
  padding-top:28px;border-top:1px solid var(--line);
  font-family:var(--f-mono),monospace;font-size:11px;letter-spacing:.1em;color:var(--faint)}
.mx .foot a{text-decoration:none}.mx .foot a:hover{color:var(--accent)}

/* ---------- reveal ---------- */
.mx [data-reveal]{opacity:0;transform:translateY(28px);transition:opacity .9s cubic-bezier(.2,.8,.2,1), transform .9s cubic-bezier(.2,.8,.2,1)}
.mx [data-reveal].in{opacity:1;transform:none}
.mx [data-reveal="2"]{transition-delay:.12s}
.mx [data-reveal="3"]{transition-delay:.24s}

/* ---------- responsive ---------- */
@media(max-width:1024px){
  .mx .chap{height:auto;padding:70px 0}
  .mx .chap-pin{position:static;height:auto;grid-template-columns:1fr;gap:40px;--e:1}
  .mx .chap.flip .chap-pin{grid-template-columns:1fr}
  .mx .chap.flip .chap-text{order:0}
  .mx .chap-frame{transform:none;opacity:1}
  .mx .chap-num{display:none}
  .mx .sec-head{grid-template-columns:1fr;gap:10px}
  .mx .sec-head p{grid-column:1}
  .mx .reel-grid{grid-template-columns:1fr}
  .mx .prod-grid{grid-template-columns:1fr}
}
@media(max-width:640px){
  .mx{--pad:20px}
  .mx header{height:70px}
  .mx .hdr-right{gap:12px}
  .mx .quiet{display:none}
  .mx .hdr-cta{display:none}
  .mx .plate-meta{display:none}
  .mx .island{margin:100px 10px 0;border-radius:30px;padding:70px 22px 60px}

  /* freeze the page scroll behind an open menu */
  .mx.mx-lock{overflow:hidden}

  /* ---- burger ---- */
  .mx .burger{display:grid;place-items:center;width:42px;height:42px;border-radius:12px;
    background:transparent;border:1.5px solid var(--line2);color:var(--fg);cursor:pointer;
    transition:border-color .25s, transform .3s}
  .mx .burger:active{transform:scale(.94)}
  .mx .burger b{position:relative;display:block;width:18px;height:1.7px;background:var(--fg);border-radius:2px;
    transition:background .2s}
  .mx .burger b::before,.mx .burger b::after{content:"";position:absolute;left:0;width:18px;height:1.7px;
    background:var(--fg);border-radius:2px;transition:transform .3s cubic-bezier(.2,.8,.2,1)}
  .mx .burger b::before{top:-6px}
  .mx .burger b::after{top:6px}
  .mx .burger.open b{background:transparent}
  .mx .burger.open b::before{transform:translateY(6px) rotate(45deg)}
  .mx .burger.open b::after{transform:translateY(-6px) rotate(-45deg)}

  /* ---- modal dropdown sheet ---- */
  .mx .m-menu:not([open]){display:none}
  .mx .m-menu{display:flex;flex-direction:column;gap:2px;position:fixed;
    top:64px;left:12px;right:12px;width:auto;max-width:none;margin:0;padding:12px;border-radius:22px;
    overflow:visible;
    background:var(--panel);border:1px solid var(--line2);
    box-shadow:0 26px 70px rgba(0,0,0,calc(var(--shadow-a)*1.1));
    transform:translateY(-14px) scale(.97);opacity:0;transform-origin:top center;
    transition:transform .34s cubic-bezier(.2,.8,.2,1), opacity .3s}
  .mx .m-menu.open{transform:none;opacity:1;pointer-events:auto}
  .mx .m-menu::backdrop{background:rgba(var(--bg-rgb),.55);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px)}
  .mx .m-menu .m-link{display:flex;align-items:center;justify-content:space-between;gap:12px;
    padding:15px 16px;border-radius:14px;font-family:inherit;font-weight:600;font-size:16px;
    color:var(--fg);text-decoration:none;background:none;border:none;width:100%;text-align:left;cursor:pointer;
    transition:background .2s}
  .mx .m-menu .m-link:active{background:rgba(var(--frame-rgb),.1)}
  .mx .m-menu .m-link span{font-family:var(--f-mono),monospace;font-size:11px;letter-spacing:.14em;
    color:var(--faint);text-transform:uppercase;font-weight:500}
  .mx .m-menu .m-cta{margin-top:8px;justify-content:center;background:var(--btn-bg);color:var(--btn-fg);
    border-radius:999px;font-weight:700;font-size:15px;padding:16px}

  /* ---- hero: drop the scroll-scrub — static film + readable copy ---- */
  .mx .hero{height:auto;margin-top:-70px}
  .mx .hero-pin{position:static;height:auto;min-height:100svh}
  .mx .hero-media{transform:none;border-radius:0;box-shadow:none}
  .mx .hero-media .scrim{background:
    linear-gradient(to top, rgba(var(--bg-rgb),.9) 4%, rgba(var(--bg-rgb),.35) 55%, rgba(var(--bg-rgb),.55) 100%)}
  .mx .hero-copy{opacity:1;transform:none;justify-content:flex-end;padding:90px 22px 56px}
  .mx .tick{display:none}
  .mx .scroll-cue{display:none}
  .mx h1{font-size:clamp(44px,13vw,64px)}
  .mx .hero-sub{font-size:15px;margin-top:20px}
  .mx .hero-ctas{margin-top:28px}
  .mx .hero-ctas .cta{flex:1 1 auto}

  /* light theme lets the suite film carry its own titles (as on desktop) —
     keep the overlay text hidden, just anchor the CTAs a touch higher for phones */
  .mx[data-theme="light"] .hero-copy{padding-bottom:48px}

  /* ---- section polish ---- */
  .mx .theater{padding:90px var(--pad) 20px}
  .mx .sec-head{margin-bottom:40px}
  .mx .reel-info{padding:18px 20px 20px}
  .mx .reel-info h3{font-size:19px}
  .mx .finale{padding:110px var(--pad) 50px}
  .mx .foot{gap:14px;margin-top:90px}
}

/* ---------- reduced motion ---------- */
@media(prefers-reduced-motion:reduce){
  .mx{scroll-behavior:auto}
  .mx *{animation:none!important}
  .mx [data-reveal]{opacity:1;transform:none;transition:none}
}
.mx.mx-static .hero{height:100vh}
.mx.mx-static .hero-media{transform:none;border-radius:0}
.mx.mx-static .hero-copy{opacity:1;transform:none}
.mx.mx-static .tick,.mx.mx-static .plate-meta{opacity:0}
.mx.mx-static .chap{height:auto;padding:70px 0}
.mx.mx-static .chap-pin{position:static;height:auto;--e:1}
.mx.mx-static .chap-frame{transform:none;opacity:1}
.mx.mx-static .chap-num{opacity:.9;transform:translateY(-50%)}
`;

function LogoMark() {
  return (
    <svg viewBox="0 0 48 48" fill="none" aria-hidden>
      <path d="M8 21.5 L24 8.5 L40 21.5 V40 H8 Z" stroke="currentColor" strokeWidth="4.2" strokeLinejoin="round" />
      <circle cx="24" cy="22.5" r="5" stroke="currentColor" strokeWidth="2.6" />
      <path d="M24 17.5 v10 M19 22.5 h10" stroke="currentColor" strokeWidth="1.8" />
      <path d="M19.5 40 v-7.5 a4.5 4.5 0 0 1 9 0 V40" stroke="currentColor" strokeWidth="3.4" />
    </svg>
  );
}

const SunIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.5v2.6M12 18.9v2.6M2.5 12h2.6M18.9 12h2.6M5 5l1.8 1.8M17.2 17.2 19 19M19 5l-1.8 1.8M6.8 17.2 5 19" />
  </svg>
);
const MoonIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11z" />
  </svg>
);

const LiteArt = () => (
  <svg viewBox="0 0 48 48" fill="none" aria-hidden>
    <path d="M8 21.5 L24 8.5 L40 21.5 V40 H8 Z" stroke="#1d1d1b" strokeWidth="3.4" strokeLinejoin="round" />
    <circle cx="24" cy="22.5" r="5" stroke="#1d1d1b" strokeWidth="2.2" />
    <path d="M24 17.5 v10 M19 22.5 h10" stroke="#1d1d1b" strokeWidth="1.6" />
    <path d="M19.5 40 v-7.5 a4.5 4.5 0 0 1 9 0 V40" stroke="#1d1d1b" strokeWidth="2.8" />
  </svg>
);
const FindArt = () => (
  <svg viewBox="0 0 48 48" fill="none" aria-hidden>
    <circle cx="21" cy="21" r="12" stroke="#1d1d1b" strokeWidth="3.4" />
    <path d="M30 30 L41 41" stroke="#1d1d1b" strokeWidth="3.4" strokeLinecap="round" />
    <path d="M15 21.5 L21 16.5 L27 21.5 V27 H15 Z" stroke="#1d1d1b" strokeWidth="2.4" strokeLinejoin="round" />
  </svg>
);
const BuildArt = () => (
  <svg viewBox="0 0 48 48" fill="none" aria-hidden>
    <rect x="8" y="26" width="14" height="14" stroke="#1d1d1b" strokeWidth="3" />
    <rect x="26" y="26" width="14" height="14" stroke="#1d1d1b" strokeWidth="3" />
    <rect x="17" y="8" width="14" height="14" stroke="#1d1d1b" strokeWidth="3" />
    <path d="M4 44 h40" stroke="#1d1d1b" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

/**
 * One film, two encodes. AV1 (10-bit) leads — it lands ~3.7x smaller than the
 * original 8-bit H.264 while measuring VMAF 95.9–96.8 against it, i.e. visually
 * equivalent rather than merely acceptable. The 10-bit encode is chosen for its
 * higher internal precision in the long scrim/sky gradients these films are full
 * of; AV1 10-bit costs nothing in size and decodes in software everywhere.
 * Plain H.264 stays LAST as the fallback for Safari on pre-M3 hardware and any
 * browser without an AV1 decoder — a browser picks the first `type` it can play,
 * so ordering is the whole mechanism and H.264 must never move up.
 *
 * The `codecs=` parameters are load-bearing: without them Safari matches the
 * bare `video/mp4` on the AV1 file, fails to decode, and never falls through.
 *
 * Both encodes are same-origin — the CSP allows `media-src 'self'` only, no CDN.
 * Audio is stripped from both: every one of these plays muted and looped.
 */
function Film({
  base,
  poster,
  className,
  preload = "none",
  autoPlay = false,
  onCanPlayThrough,
}: {
  base: string;
  poster: string;
  className?: string;
  preload?: "none" | "metadata" | "auto";
  autoPlay?: boolean;
  onCanPlayThrough?: () => void;
}) {
  return (
    <video
      data-auto
      muted
      loop
      playsInline
      autoPlay={autoPlay}
      preload={preload}
      poster={poster}
      className={className}
      onCanPlayThrough={onCanPlayThrough}
    >
      <source src={`${base}.av1.mp4`} type='video/mp4; codecs="av01.0.08M.10"' />
      <source src={`${base}.h264.mp4`} type='video/mp4; codecs="avc1.640032"' />
    </video>
  );
}

type Theme = "dark" | "light";

export default function MarketingLanding() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<Theme>("light");
  // hero video mounts only once the saved theme is known, so a returning
  // dark-theme visitor never downloads the light film first
  const [themeReady, setThemeReady] = useState(false);
  // hero holds a crisp poster still until the film is buffered enough to loop
  // smoothly — first-frame decode jank plays out behind the still, so the
  // reveal never looks like lag (most visible on the light-theme suite film).
  // Stored as *which* theme's film is buffered rather than a bare boolean, so
  // toggling the theme brings the still back by derivation — no reset effect.
  const [readyTheme, setReadyTheme] = useState<Theme | null>(null);
  const heroReady = readyTheme === theme;
  // mobile-only nav sheet (burger is display:none above 640px)
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    if (menuOpen && !menu.open) menu.showModal();
    if (!menuOpen && menu.open) menu.close();
  }, [menuOpen]);

  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 640px)");
    const closeOnDesktop = () => {
      if (!mobile.matches) setMenuOpen(false);
    };
    mobile.addEventListener("change", closeOnDesktop);
    return () => mobile.removeEventListener("change", closeOnDesktop);
  }, []);

  const closeMenu = () => setMenuOpen(false);

  // Hydration-safe read of the saved theme: localStorage is an external store
  // that does not exist during SSR, so the first paint has to be the default and
  // the stored value has to arrive after mount. react-hooks/set-state-in-effect
  // cannot distinguish that from a derivable value.
  useEffect(() => {
    const saved = localStorage.getItem("mx-theme");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved === "light" || saved === "dark") setTheme(saved);
    setThemeReady(true);
  }, []);

  // native hash scrolling gets canceled by video loads mid-flight; drive it ourselves
  const scrollToId = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const hash = e.currentTarget.getAttribute("href");
    const root = rootRef.current;
    const el = hash && root?.querySelector<HTMLElement>(hash);
    if (!el || !root) return;
    e.preventDefault();
    history.replaceState(null, "", hash);
    const start = root.scrollTop;
    const dist = el.getBoundingClientRect().top;
    const dur = Math.min(1400, 500 + Math.abs(dist) * 0.12);
    const t0 = performance.now();
    const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
    let animating = false;
    const step = (now: number) => {
      animating = true;
      const p = Math.min(1, (now - t0) / dur);
      root.scrollTo({ top: start + dist * ease(p), behavior: "instant" });
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    // rAF can be throttled to nothing (hidden/embedded views) — jump instantly then
    setTimeout(() => {
      if (!animating) root.scrollTo({ top: start + dist, behavior: "instant" });
    }, 150);
  };

  const toggleTheme = () =>
    setTheme((t) => {
      const next: Theme = t === "dark" ? "light" : "dark";
      localStorage.setItem("mx-theme", next);
      return next;
    });

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) root.classList.add("mx-static");

    // scroll-scrubbed sections: 0 → 1 progress as the section passes through
    const scrubs = Array.from(root.querySelectorAll<HTMLElement>("[data-scrub]"));
    // last written values — skips style writes for sections parked at 0/1
    const last = scrubs.map(() => ({ p: "", v: "" }));
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const vh = root.clientHeight;
        // read all rects before writing any styles — avoids forced reflows
        const rects = scrubs.map((sec) => sec.getBoundingClientRect());
        scrubs.forEach((sec, i) => {
          const r = rects[i];
          const total = r.height - vh;
          // pin progress: 0 when the section sticks, 1 when it releases
          const p = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
          // entry progress: 0 → 1 while the section scrolls into the viewport
          const v = Math.min(1, Math.max(0, (vh - r.top) / vh));
          const pv = p.toFixed(4);
          const vv = v.toFixed(4);
          if (last[i].p !== pv) {
            last[i].p = pv;
            sec.style.setProperty("--p", pv);
          }
          if (last[i].v !== vv) {
            last[i].v = vv;
            sec.style.setProperty("--v", vv);
          }
        });
      });
    };
    if (!reduced) {
      root.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    }

    // reveal-on-enter (one-shot — stop watching once revealed)
    const revealIO = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add("in");
          revealIO.unobserve(e.target);
        }),
      { root, threshold: 0.18 }
    );
    root.querySelectorAll("[data-reveal]").forEach((el) => revealIO.observe(el));

    return () => {
      root.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
      revealIO.disconnect();
    };
  }, []);

  // autoplay loops only while on screen — separate effect so a theme toggle
  // (which remounts the hero video) re-observes without rebuilding the rest
  useEffect(() => {
    const root = rootRef.current;
    if (!root || !themeReady) return;
    const vidIO = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          const v = e.target as HTMLVideoElement;
          if (e.isIntersecting) v.play().catch(() => {});
          else v.pause();
        }),
      { root, threshold: 0.2 }
    );
    root.querySelectorAll<HTMLVideoElement>("video[data-auto]").forEach((v) => vidIO.observe(v));
    return () => vidIO.disconnect();
  }, [theme, themeReady]);

  // dark: neon wireframe night film · light: cream suite assembly film
  // base name only — <Film> appends the per-codec extension
  const heroBase = theme === "light" ? "/demo/suite" : "/demo/wireframe";
  const heroPoster = `${heroBase}-poster.webp`;

  return (
    <div
      ref={rootRef}
      data-theme={theme}
      className={`mx ${menuOpen ? "mx-lock" : ""} ${fraunces.variable} ${manrope.variable} ${plexMono.variable}`}
    >
      <style>{css}</style>
      <div className="atmo" aria-hidden />

      <header>
        <Link className="logo" href="/">
          <LogoMark />
          <span>
            Arch<i>It</i>
          </span>
        </Link>
        <div className="hdr-right">
          <a className="quiet" href="https://archit-lit.chaudharyankit.in/" target="_blank" rel="noreferrer">
            ArchIt Lite
          </a>
          <a className="quiet" href="#find-demo" onClick={scrollToId}>
            Find
          </a>
          <a className="quiet" href="#demos" onClick={scrollToId}>
            Demos
          </a>
          <SignInButton mode="modal">
            <button className="quiet">Sign in</button>
          </SignInButton>
          <button
            className="theme-btn"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            title={theme === "dark" ? "Lights on" : "Lights off"}
          >
            {theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
          <SignUpButton mode="modal">
            <button className="cta hdr-cta">Get started</button>
          </SignUpButton>
          <button
            className={`burger ${menuOpen ? "open" : ""}`}
            onClick={() => (menuOpen ? closeMenu() : setMenuOpen(true))}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
          >
            <b />
          </button>
        </div>
      </header>

      {/* ============ MOBILE NAV SHEET (only ≤640px) ============ */}
      <dialog
        ref={menuRef}
        id="mobile-menu"
        className={`m-menu ${menuOpen ? "open" : ""}`}
        aria-label="Mobile navigation"
        onCancel={(e) => {
          e.preventDefault();
          closeMenu();
        }}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) closeMenu();
        }}
      >
        <a
          className="m-link"
          href="https://archit-lit.chaudharyankit.in/"
          target="_blank"
          rel="noreferrer"
          onClick={closeMenu}
        >
          ArchIt Lite <span>Free ↗</span>
        </a>
        <a
          className="m-link"
          href="#find-demo"
          onClick={(e) => {
            closeMenu();
            scrollToId(e);
          }}
        >
          Find <span>Map</span>
        </a>
        <a
          className="m-link"
          href="#demos"
          onClick={(e) => {
            closeMenu();
            scrollToId(e);
          }}
        >
          Demos <span>Reel</span>
        </a>
        <Link className="m-link" href="/designer" onClick={closeMenu}>
          3D Builder <span>Paid</span>
        </Link>
        <SignInButton mode="modal">
          <button className="m-link" onClick={closeMenu}>
            Sign in <span>Account</span>
          </button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button className="m-link m-cta" onClick={closeMenu}>
            Get started free
          </button>
        </SignUpButton>
      </dialog>

      {/* ============ HERO — film scrubs into a blueprint plate ============ */}
      <section className="hero" data-scrub>
        <div className="hero-pin">
          <div className="hero-media">
            {themeReady && (
              <>
                {/* the one film allowed to preload: it is above the fold and
                    autoplays immediately. `key` remounts on theme change so the
                    new <source> list is actually re-selected — swapping children
                    on a live element would otherwise need a manual .load(). */}
                <Film
                  key={heroBase}
                  base={heroBase}
                  poster={heroPoster}
                  preload="auto"
                  autoPlay
                  onCanPlayThrough={() => setReadyTheme(theme)}
                />
                {/* still stays until the film can loop without buffering.
                    fill: the CSS already reserves this box (absolute, inset 0,
                    object-fit cover), so next/image adds no layout shift.
                    eager + high priority, not lazy: this fills the viewport
                    above the fold and is the LCP candidate. `preload` would be
                    pointless here — the element only mounts once themeReady
                    flips on the client, long after the <head> is flushed. */}
                <Image
                  className={`hero-still ${heroReady ? "hidden" : ""}`}
                  src={heroPoster}
                  alt=""
                  aria-hidden
                  fill
                  sizes="100vw"
                  loading="eager"
                  fetchPriority="high"
                />
              </>
            )}
            <div className="scrim" />
            <span className="tick tl" />
            <span className="tick tr" />
            <span className="tick bl" />
            <span className="tick br" />
            <span className="plate-meta mono a">
              {theme === "light" ? "Fig. 02 — the suite, assembling" : "Fig. 01 — wireframe becomes home"}
            </span>
            <span className="plate-meta mono b">1920 × 1080 / 24 fps / 00:10</span>
            <span className="plate-meta mono c">
              {theme === "light" ? "ArchIt Studio — plate 02" : "ArchIt Studio — plate 03"}
            </span>
          </div>

          <div className="hero-copy">
            <div className="hero-kicker mono">ArchIt — the home suite</div>
            <h1>
              <span className="l">Dream it.</span>
              <span className="l">
                <em>Find</em> it.
              </span>
              <span className="l">Build it.</span>
            </h1>
            <p className="hero-sub">
              One place for the whole journey home — a free 3D showcase, a living satellite map of real
              listings, and a room-by-room home builder. No downloads, no CAD degree.
            </p>
            <div className="hero-ctas">
              <SignUpButton mode="modal">
                <button className="cta glow">Get started free</button>
              </SignUpButton>
              <a className="cta ghost" href="#demos" onClick={scrollToId}>
                Watch the demos ↓
              </a>
            </div>
          </div>

          <div className="scroll-cue mono">
            <span>Scroll to frame</span>
            <span className="wheel" />
          </div>
        </div>
      </section>

      {/* ============ TICKER ============ */}
      <div className="ticker" aria-hidden>
        <div className="ticker-track">
          {[...TICKER, ...TICKER].map((t, i) => (
            <span key={i}>
              {t}
              <b>+</b>
            </span>
          ))}
        </div>
      </div>

      {/* ============ CHAPTERS — pinned frames that tilt in on scroll ============ */}
      <div className="chapters">
        <section className="chap" data-scrub>
          <div className="chap-pin">
            <div className="chap-num disp right" aria-hidden>
              01
            </div>
            <div className="chap-text">
              <div className="chap-kicker">Chapter 01 / Imagine</div>
              <h2>
                Every home starts as a <em>line.</em>
              </h2>
              <p>
                A sketch, a wish, a wireframe glowing in the dark. ArchIt turns that first line into rooms,
                walls and light — before a single brick exists.
              </p>
              <a className="chap-link" href="#demos" onClick={scrollToId}>
                See it become real →
              </a>
            </div>
            <div className="chap-frame">
              <div className="screen cine">
                <div className="hud" aria-hidden>
                  <span className="rec">
                    <i /> rec
                  </span>
                  <span className="tc">tc 00:00:10:00</span>
                  <span className="fig">plate 03 — wireframe → home</span>
                </div>
                <Film base="/demo/wireframe" poster="/demo/wireframe-poster.webp" />
              </div>
              <div className="frame-caption">
                <b>Concept film</b>
                <span>blueprint / night</span>
              </div>
            </div>
          </div>
        </section>

        <section className="chap flip" id="find-demo" data-scrub>
          <div className="chap-pin">
            <div className="chap-num disp left" aria-hidden>
              02
            </div>
            <div className="chap-frame">
              <div className="screen">
                <div className="bar" aria-hidden>
                  <span className="dot" />
                  <span className="dot" />
                  <span className="dot" />
                  <span className="url">archit.suite/find — every home, on a living map</span>
                </div>
                <Film base="/demo/find" poster="/demo/find-poster.webp" />
              </div>
              <div className="frame-caption">
                <b>ArchIt Find session</b>
                <span>satellite city · real listings</span>
              </div>
            </div>
            <div className="chap-text">
              <div className="chap-kicker">Chapter 02 / Explore</div>
              <h2>
                Three tools. One <em>doorway.</em>
              </h2>
              <p>
                Wander a free 3D showcase, fly over a satellite city of real listings, and reach owners
                directly. The whole suite lives in your browser — sign in and the doors open.
              </p>
              <Link className="chap-link" href="/find">
                Open the map →
              </Link>
            </div>
          </div>
        </section>

        <section className="chap" data-scrub>
          <div className="chap-pin">
            <div className="chap-num disp right" aria-hidden>
              03
            </div>
            <div className="chap-text">
              <div className="chap-kicker">Chapter 03 / Build</div>
              <h2>
                Design room by room, <em>wall by wall.</em>
              </h2>
              <p>
                Floors, facades, windows, furniture — the 3D Builder is a full house-design studio with live
                cost tracking. Save every idea, refine it any time.
              </p>
              <Link className="chap-link" href="/designer">
                Start designing →
              </Link>
            </div>
            <div className="chap-frame">
              <div className="screen">
                <div className="bar" aria-hidden>
                  <span className="dot" />
                  <span className="dot" />
                  <span className="dot" />
                  <span className="url">archit.suite/designer — my house</span>
                </div>
                <Film base="/demo/builder" poster="/demo/builder-poster.webp" />
              </div>
              <div className="frame-caption">
                <b>3D Builder session</b>
                <span>live cost · materials</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ============ DEMO THEATER — full videos, muted autoplay loops ============ */}
      <section className="theater" id="demos">
        <div className="sec-head" data-reveal>
          <div className="kicker">/ The demo reel /</div>
          <h2>
            Watch the <em>full</em> demos.
          </h2>
          <p>
            Three short films, end to end — the concept, the suite, and a live design session. Press play,
            go fullscreen, judge for yourself.
          </p>
        </div>
        <div className="reel-grid">
          <article className="reel wide" data-reveal>
            <Film base="/demo/wireframe" poster="/demo/wireframe-poster.webp" />
            <div className="reel-info">
              <h3>
                Wireframe becomes home
                <small>The ArchIt idea in ten seconds — a glowing blueprint grows into a finished house.</small>
              </h3>
              <div className="reel-meta">
                <b>Film 01</b>
                <br />
                00:10 · 1080p · 24 fps
              </div>
            </div>
          </article>
          <article className="reel" data-reveal="2">
            <Film base="/demo/suite" poster="/demo/suite-poster.webp" />
            <div className="reel-info">
              <h3>
                The suite, assembled
                <small>Lite, Find and Builder snap together into one interface.</small>
              </h3>
              <div className="reel-meta">
                <b>Film 02</b>
                <br />
                00:10 · 1080p
              </div>
            </div>
          </article>
          <article className="reel" data-reveal="3">
            <Film base="/demo/builder" poster="/demo/builder-poster.webp" />
            <div className="reel-info">
              <h3>
                Inside the 3D Builder
                <small>Materials, walls and live construction cost — a real session.</small>
              </h3>
              <div className="reel-meta">
                <b>Film 03</b>
                <br />
                00:10 · 1080p
              </div>
            </div>
          </article>
          <article className="reel wide" data-reveal>
            <Film base="/demo/find" poster="/demo/find-poster.webp" />
            <div className="reel-info">
              <h3>
                Inside ArchIt Find
                <small>Fly over a satellite city, open a real listing, request a view — the marketplace in motion.</small>
              </h3>
              <div className="reel-meta">
                <b>Film 04</b>
                <br />
                00:10 · 1080p · 24 fps
              </div>
            </div>
          </article>
        </div>
      </section>

      {/* ============ PRODUCTS — island flips against the theme ============ */}
      <section className="island" id="products">
        <div className="sec-head" data-reveal>
          <div className="kicker">/ The suite /</div>
          <h2>
            Three tools.
            <br />
            One journey home.
          </h2>
        </div>
        <div className="prod-grid">
          <article className="prod" data-reveal>
            <div className="prod-top">
              <LiteArt />
              <span className="badge">Free</span>
            </div>
            <h3>
              ArchIt Lite<small>No account needed</small>
            </h3>
            <p>
              Wander a crafted 3D showcase home right in your browser. The fastest way to feel what ArchIt
              can do.
            </p>
            <a className="cta" href="https://archit-lit.chaudharyankit.in/" target="_blank" rel="noreferrer">
              Try it free ↗
            </a>
          </article>
          <article className="prod" data-reveal="2">
            <div className="prod-top">
              <FindArt />
              <span className="badge">Free list · {feeLabel("contact_owner")} contact</span>
            </div>
            <h3>
              ArchIt Find<small>Buy · rent · sell</small>
            </h3>
            <p>
              Fly over a 3D satellite city, browse real listings, list your own property and reach owners
              directly.
            </p>
            <Link className="cta" href="/find">
              Open the map →
            </Link>
            <div className="lock">Sign in required</div>
          </article>
          <article className="prod" data-reveal="3">
            <div className="prod-top">
              <BuildArt />
              <span className="badge">Paid</span>
            </div>
            <h3>
              ArchIt 3D Builder<small>Room by room</small>
            </h3>
            <p>
              Design a complete house — floors, facades, windows, furniture — then save every idea and
              refine it any time.
            </p>
            <Link className="cta" href="/designer">
              Start designing →
            </Link>
            <div className="lock">Sign in required</div>
          </article>
        </div>
      </section>

      {/* ============ FINALE ============ */}
      <section className="finale">
        <h2 data-reveal>
          Ready to build
          <br />
          your <em>world?</em>
        </h2>
        <div className="row" data-reveal="2">
          <SignUpButton mode="modal">
            <button className="cta glow">Get started free</button>
          </SignUpButton>
          <Link className="cta ghost" href="/find">
            Find a home →
          </Link>
          <Link className="cta ghost" href="/designer">
            Design a home →
          </Link>
        </div>
        <div className="foot">
          <span>© 2026 ArchIt — dream it. find it. build it.</span>
          <span>Secured by Clerk · Data on Supabase · Payments by Razorpay</span>
        </div>
      </section>
    </div>
  );
}
