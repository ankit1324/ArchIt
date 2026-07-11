import Link from "next/link";
import { Manrope } from "next/font/google";
import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import SuiteDashboard from "@/components/SuiteDashboard";

const manrope = Manrope({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"] });

const MARQUEE = [
  "FREE 3D SHOWCASE",
  "FIND REAL HOMES",
  "SATELLITE MAP",
  "ROOM-BY-ROOM BUILDER",
  "CHANDIGARH & BEYOND",
  "NO CAD DEGREE",
];

const css = `
.ld{background:#1d1d1b;padding:10px;height:100%;overflow-y:auto;overflow-x:hidden;
  --bone:#f1f0eb;--ink:#1d1d1b;--ink-soft:#3a3a36;--muted:#8b8b84;--line:#dddbd2;
  --mauve:#b9a8b1;--sage:#c3c8ae;--lavender:#c4c8d9;--blush:#cbb9b3;
  --r:36px;--pad:min(6.5vw,88px);
  color:var(--ink);-webkit-font-smoothing:antialiased}
.ld ::selection{background:var(--ink);color:var(--bone)}
.ld .sheet{background:var(--bone);border-radius:40px;overflow:hidden;position:relative}

.ld header{display:flex;align-items:center;justify-content:space-between;height:96px;padding:0 var(--pad);
  background:linear-gradient(to bottom,var(--bone) 72%,transparent);position:relative;z-index:5}
.ld .logo{display:inline-flex;align-items:center;gap:11px;font-weight:800;font-size:26px;letter-spacing:-.03em}
.ld .logo i{font-style:normal;color:var(--muted)}
.ld .logo svg{width:36px;height:36px;transition:transform .5s cubic-bezier(.2,.8,.2,1)}
.ld .logo:hover svg{transform:rotate(-8deg) scale(1.08)}
.ld .hdr-right{display:flex;align-items:center;gap:26px}
.ld .quiet{font-weight:700;font-size:15px}
.ld .quiet:hover{opacity:.6}
.ld .cta-pill{display:inline-flex;align-items:center;justify-content:center;gap:10px;background:var(--ink);color:var(--bone);
  font-weight:700;font-size:15px;padding:16px 28px;border-radius:999px;cursor:pointer;border:none;font-family:inherit;
  transition:transform .3s cubic-bezier(.2,.8,.2,1)}
.ld .cta-pill:hover{transform:scale(1.04)}
.ld .cta-pill.light{background:var(--bone);color:var(--ink)}

.ld .hero{padding:56px var(--pad) 0}
.ld .hero-grid{display:grid;grid-template-columns:1fr minmax(260px,340px);gap:48px;align-items:start}
.ld h1{font-size:clamp(50px,8.4vw,126px);line-height:.98;letter-spacing:-.045em;font-weight:700}
.ld h1 .row2{display:flex;align-items:center;gap:.18em;white-space:nowrap}
.ld .squig{width:.85em;height:.62em;flex:none;color:#b9b7ac}
.ld .star-badge{width:.62em;height:.62em;flex:none;border-radius:50%;background:var(--mauve);
  display:inline-grid;place-items:center;animation:ld-spin 14s linear infinite}
.ld .star-badge svg{width:58%;height:58%}
@keyframes ld-spin{to{transform:rotate(360deg)}}
.ld .hero-aside{padding-top:18px}
.ld .hero-aside p{font-size:13.5px;font-weight:700;letter-spacing:.08em;line-height:1.75;text-transform:uppercase;color:var(--ink-soft)}
.ld .hero-aside p b{color:var(--muted)}

.ld .marquee{margin-top:64px;border-top:1px solid var(--line);border-bottom:1px solid var(--line);
  overflow:hidden;white-space:nowrap;padding:14px 0}
.ld .marquee-track{display:inline-flex;align-items:center;gap:26px;animation:ld-mq 28s linear infinite;padding-right:26px}
@keyframes ld-mq{to{transform:translateX(-50%)}}
.ld .marquee span{font-size:13px;font-weight:700;letter-spacing:.14em;color:var(--muted);display:inline-flex;align-items:center;gap:26px}
.ld .marquee span:nth-child(odd){color:var(--ink)}

.ld .hero-art{margin:40px var(--pad) 0;background:var(--mauve);border-radius:var(--r);position:relative;overflow:hidden}
.ld .hero-art svg.scene{display:block;width:100%;height:auto}
.ld .cloud{animation:ld-drift 11s ease-in-out infinite alternate}
.ld .c2{animation-duration:14s;animation-delay:-4s}
.ld .c3{animation-duration:9s;animation-delay:-2s}
@keyframes ld-drift{from{transform:translateX(-16px)}to{transform:translateX(22px)}}
.ld .crane-load{transform-box:fill-box;transform-origin:50% 0;animation:ld-sway 6s ease-in-out infinite}
@keyframes ld-sway{0%,100%{transform:rotate(2.2deg)}50%{transform:rotate(-2.2deg) translateY(12px)}}
.ld .tw{transform-box:fill-box;transform-origin:center;animation:ld-twinkle 3.2s ease-in-out infinite}
.ld .tw2{animation-delay:-1.1s}.ld .tw3{animation-delay:-2.2s}
@keyframes ld-twinkle{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(.45);opacity:.35}}
.ld .orbit{stroke-dasharray:16 12;animation:ld-march 9s linear infinite}
@keyframes ld-march{to{stroke-dashoffset:-280}}

.ld .sec-head{display:grid;grid-template-columns:220px 1fr;gap:40px;padding:100px var(--pad) 60px;align-items:start}
.ld .kicker{font-size:12px;font-weight:800;letter-spacing:.12em;color:var(--muted);text-transform:uppercase;padding-top:14px}
.ld .sec-head h2{font-size:clamp(40px,4.6vw,64px);line-height:1.05;letter-spacing:-.035em;font-weight:700}

.ld .tpl-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:26px;padding:0 var(--pad) 90px}
.ld .tpl-card .art{border-radius:24px;overflow:hidden;aspect-ratio:1/1;display:grid;place-items:center;position:relative}
.ld .tpl-card:nth-child(1) .art{background:var(--lavender)}
.ld .tpl-card:nth-child(2) .art{background:var(--sage)}
.ld .tpl-card:nth-child(3) .art{background:var(--mauve)}
.ld .tpl-card .art svg{width:60%;height:60%;transition:transform .6s cubic-bezier(.2,.8,.2,1)}
.ld .tpl-card:hover .art svg{transform:scale(1.06) rotate(-1.5deg)}
.ld .badge{position:absolute;top:18px;right:18px;background:var(--bone);border:2px solid var(--ink);
  border-radius:999px;padding:7px 14px;font-size:12px;font-weight:800;letter-spacing:.06em}
.ld .tpl-card h3{font-size:22px;font-weight:800;margin:26px 0 10px}
.ld .tpl-card h3 small{font-size:13px;font-weight:700;color:var(--muted);margin-left:10px;letter-spacing:.04em}
.ld .tpl-card p{font-size:15.5px;line-height:1.65;color:var(--ink-soft);font-weight:500;min-height:76px}
.ld .tpl-card .cta-pill{margin-top:20px;padding:14px 24px;font-size:14px}
.ld .lock{font-size:11.5px;font-weight:700;color:var(--muted);margin-top:10px;letter-spacing:.05em;text-transform:uppercase}

.ld .launch{background:var(--ink);color:var(--bone);border-radius:40px;margin-top:10px;
  padding:90px var(--pad);position:relative;overflow:hidden}
.ld .launch h2{font-size:clamp(46px,7vw,104px);line-height:1.02;letter-spacing:-.045em;font-weight:700;max-width:13ch}
.ld .launch .deco{position:absolute;top:90px;right:var(--pad);display:flex;gap:14px}
.ld .bubble{width:96px;height:96px;border-radius:50%;display:grid;place-items:center;animation:ld-bob 5s ease-in-out infinite}
.ld .bubble:nth-child(2){animation-delay:-2.5s}
@keyframes ld-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}
.ld .bubble.b1{background:var(--lavender)}.ld .bubble.b2{background:var(--sage)}
.ld .bubble svg{width:44px;height:44px;color:var(--ink)}
.ld .launch .row{display:flex;gap:16px;flex-wrap:wrap;margin-top:56px}
.ld .foot-base{display:flex;justify-content:space-between;gap:30px;margin-top:90px;
  font-size:13.5px;color:#7c7c74;font-weight:600;flex-wrap:wrap}
.ld .foot-base a:hover{color:var(--bone)}

@media(max-width:1024px){
  .ld .hero-grid{grid-template-columns:1fr}
  .ld .sec-head{grid-template-columns:1fr;gap:16px;padding-bottom:36px}
  .ld .tpl-grid{grid-template-columns:1fr;gap:40px}
}
@media(max-width:640px){
  .ld{--pad:20px}
  .ld header{height:76px}
  .ld .quiet{display:none}
  .ld .launch .deco{position:static;margin-bottom:26px}
}
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

const Squiggle = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 100 70" fill="none" aria-hidden>
    <path d="M4 38 c0-14 12-14 12 0 v6 c0 12 12 12 12 0 V20 c0-12 12-12 12 0 v16 h40" stroke="currentColor" strokeWidth="9" strokeLinecap="round" />
    <path d="M66 20 l18 16 -18 16" stroke="currentColor" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const Ast = () => (
  <svg viewBox="0 0 40 40" fill="none" aria-hidden>
    <path d="M20 4v32M6 12l28 16M6 28l28-16" stroke="#1d1d1b" strokeWidth="5.5" strokeLinecap="round" />
  </svg>
);

function HeroScene() {
  return (
    <svg className="scene" viewBox="0 0 1280 620" fill="none" aria-hidden>
      <path className="cloud" d="M60 140 a40 40 0 0 1 70-26 a34 34 0 0 1 62 8 a30 30 0 0 1 28 42 H70 a32 32 0 0 1-10-24z" stroke="#1d1d1b" strokeWidth="3" />
      <path className="cloud c2" d="M1020 90 a44 44 0 0 1 78-22 a36 36 0 0 1 64 14 a28 28 0 0 1 20 40 H1032z" stroke="#1d1d1b" strokeWidth="3" />
      <path className="cloud c3" d="M560 70 a30 30 0 0 1 54-16 a26 26 0 0 1 46 10 a22 22 0 0 1 16 30 H570z" stroke="#1d1d1b" strokeWidth="3" />
      <line x1="0" y1="560" x2="1280" y2="560" stroke="#1d1d1b" strokeWidth="4" />
      <g>
        <rect x="430" y="300" width="420" height="260" fill="#1d1d1b" />
        <path d="M410 300 L640 170 L870 300 Z" fill="#1d1d1b" />
        <rect x="610" y="430" width="70" height="130" rx="4" fill="#b9a8b1" stroke="#1d1d1b" strokeWidth="5" />
        <circle cx="665" cy="498" r="5" fill="#1d1d1b" />
        <rect x="470" y="350" width="90" height="90" rx="6" fill="#b9a8b1" stroke="#1d1d1b" strokeWidth="5" />
        <path d="M470 395 h90 M515 350 v90" stroke="#1d1d1b" strokeWidth="5" />
        <rect x="720" y="350" width="90" height="90" rx="6" fill="#b9a8b1" stroke="#1d1d1b" strokeWidth="5" />
        <path d="M720 395 h90 M765 350 v90" stroke="#1d1d1b" strokeWidth="5" />
        <circle cx="640" cy="262" r="26" fill="#b9a8b1" stroke="#1d1d1b" strokeWidth="5" />
        <path d="M640 236 v52 M614 262 h52" stroke="#1d1d1b" strokeWidth="5" />
      </g>
      <g>
        <rect x="150" y="180" width="26" height="380" fill="#1d1d1b" />
        <rect x="120" y="540" width="130" height="20" rx="8" fill="#1d1d1b" />
        <path d="M163 180 L560 120" stroke="#1d1d1b" strokeWidth="16" strokeLinecap="round" />
        <path d="M163 180 L120 120" stroke="#1d1d1b" strokeWidth="16" strokeLinecap="round" />
        <circle cx="163" cy="180" r="34" fill="#1d1d1b" />
        <circle cx="163" cy="180" r="15" fill="#b9a8b1" />
        <g className="crane-load">
          <line x1="520" y1="127" x2="520" y2="205" stroke="#1d1d1b" strokeWidth="4" />
          <rect x="488" y="205" width="64" height="84" rx="6" fill="#1d1d1b" />
          <rect x="480" y="196" width="80" height="14" rx="7" fill="#1d1d1b" />
        </g>
        <circle cx="120" cy="120" r="24" fill="#1d1d1b" />
        <path d="M111 111 l18 18 M129 111 l-18 18" stroke="#b9a8b1" strokeWidth="5" strokeLinecap="round" />
      </g>
      <g fill="#1d1d1b">
        <path className="tw" d="M330 250 c3 14 8 19 22 22 c-14 3-19 8-22 22 c-3-14-8-19-22-22 c14-3 19-8 22-22z" />
        <path className="tw tw2" d="M950 200 c2.5 12 7 16 19 18.5 c-12 2.5-16.5 7-19 19 c-2.5-12-7-16.5-19-19 c12-2.5 16.5-6.5 19-18.5z" />
        <circle className="tw tw2" cx="985" cy="430" r="8" />
        <circle className="tw tw3" cx="285" cy="480" r="8" />
      </g>
      <ellipse className="orbit" cx="640" cy="380" rx="330" ry="120" stroke="#1d1d1b" strokeWidth="3" opacity=".55" />
      <path d="M930 560 a30 30 0 0 1 58 0z M960 560 a30 30 0 0 1 58 0z" stroke="#1d1d1b" strokeWidth="4" fill="none" />
      <path d="M300 560 a26 26 0 0 1 52 0z" stroke="#1d1d1b" strokeWidth="4" fill="none" />
    </svg>
  );
}

/* product tile art, same hand-drawn ink style */
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

export default async function Home() {
  // signed out: editorial marketing landing; signed in: suite dashboard
  const { userId } = await auth();
  return userId ? <SuiteDashboard /> : <MarketingLanding />;
}

function MarketingLanding() {
  return (
    <div className={`${manrope.className} ld`}>
      <style>{css}</style>
      <div className="sheet">
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
            <Link className="quiet" href="/find">
              Find
            </Link>
            <SignInButton mode="modal">
              <button className="quiet">Sign in</button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="cta-pill">Get started</button>
            </SignUpButton>
          </div>
        </header>

        <section className="hero">
          <div className="hero-grid">
            <h1>
              <span>Design your</span>
              <span className="row2">
                <Squiggle className="squig" />
                dream home
                <span className="star-badge">
                  <Ast />
                </span>
              </span>
            </h1>
            <aside className="hero-aside">
              <p>
                <b>ArchIt</b> is one place for the whole journey home — a free
                3D showcase, a living satellite map of real listings, and a
                room-by-room home builder. No downloads, no CAD degree.
              </p>
            </aside>
          </div>

          <div className="marquee" aria-hidden>
            <div className="marquee-track">
              {[...MARQUEE, ...MARQUEE].map((t, i) => (
                <span key={i}>
                  {t}
                  <svg width="14" height="14" viewBox="0 0 40 40" fill="#c9c8bf">
                    <path d="M20 2 C22 14 26 18 38 20 C26 22 22 26 20 38 C18 26 14 22 2 20 C14 18 18 14 20 2 Z" />
                  </svg>
                </span>
              ))}
            </div>
          </div>
        </section>

        <div className="hero-art">
          <HeroScene />
        </div>

        <section id="products">
          <div className="sec-head">
            <div className="kicker">/ The suite /</div>
            <h2>
              Three tools.
              <br />
              One journey home.
            </h2>
          </div>

          <div className="tpl-grid">
            <article className="tpl-card">
              <div className="art">
                <LiteArt />
                <span className="badge">Free</span>
              </div>
              <h3>
                ArchIt Lite<small>no account needed</small>
              </h3>
              <p>
                Wander a crafted 3D showcase home right in your browser. The
                fastest way to feel what ArchIt can do.
              </p>
              <a className="cta-pill" href="https://archit-lit.chaudharyankit.in/" target="_blank" rel="noreferrer">
                Try it free ↗
              </a>
            </article>

            <article className="tpl-card">
              <div className="art">
                <FindArt />
                <span className="badge">₹100 list · ₹20 contact</span>
              </div>
              <h3>
                ArchIt Find<small>buy · rent · sell</small>
              </h3>
              <p>
                Fly over a 3D satellite city, browse real listings, list your
                own property and reach owners directly.
              </p>
              <Link className="cta-pill" href="/find">
                Open the map →
              </Link>
              <div className="lock">Sign in required</div>
            </article>

            <article className="tpl-card">
              <div className="art">
                <BuildArt />
                <span className="badge">Paid</span>
              </div>
              <h3>
                ArchIt 3D Builder<small>room by room</small>
              </h3>
              <p>
                Design a complete house — floors, facades, windows, furniture —
                then save every idea and refine it any time.
              </p>
              <Link className="cta-pill" href="/designer">
                Start designing →
              </Link>
              <div className="lock">Sign in required</div>
            </article>
          </div>
        </section>
      </div>

      <section className="launch">
        <div className="deco" aria-hidden>
          <span className="bubble b1">
            <LogoMark />
          </span>
          <span className="bubble b2">
            <svg viewBox="0 0 40 40" fill="none">
              <path d="M20 4v32M6 12l28 16M6 28l28-16" stroke="#1d1d1b" strokeWidth="5.5" strokeLinecap="round" />
            </svg>
          </span>
        </div>
        <h2>Ready to build your world?</h2>
        <div className="row">
          <Link className="cta-pill light" href="/find">
            Find a home →
          </Link>
          <Link className="cta-pill light" href="/designer">
            Design a home →
          </Link>
        </div>
        <div className="foot-base">
          <span>© 2026 ArchIt — Dream it. Find it. Build it.</span>
          <span>Secured by Clerk · Data on Supabase · Payments by Razorpay</span>
        </div>
      </section>
    </div>
  );
}
