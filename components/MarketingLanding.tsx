import Link from "next/link";
import localFont from "next/font/local";
import LandingNav from "./LandingNav";
import TrackedLink from "./TrackedLink";
import { TEMPLATE_CATALOG } from "@/lib/template-catalog";
import styles from "./MarketingLanding.module.css";

const display = localFont({
  src: "../assets/fonts/fraunces-latin-wght-normal.woff2",
  weight: "100 900",
  variable: "--landing-display",
  adjustFontFallback: "Times New Roman",
});
const body = localFont({
  src: "../assets/fonts/manrope-latin-wght-normal.woff2",
  weight: "200 800",
  variable: "--landing-body",
});

const starters = [
  { key: "in_1bhk", label: "A little space. A fresh start.", type: "01 / COMPACT HOME", rooms: "1 bedroom · Living · Kitchen · Bath", note: "Start small and explore how your everyday spaces could fit together." },
  { key: "in_2bhk", label: "Room for everyday life.", type: "02 / FAMILY HOME", rooms: "2 bedrooms · Living · Kitchen · 2 baths", note: "A starting point for thinking through shared spaces and private rooms." },
  { key: "in_row", label: "Think along the plot.", type: "03 / ROW HOUSE", rooms: "2 bedrooms · Porch · Living · Balcony", note: "Explore a longer arrangement with rooms running from front to back." },
];

// Sign-up, then straight into the builder. A link rather than a Clerk modal
// button keeps Clerk's bundle off this page and the first click instant.
const START_HREF = "/sign-up?redirect_url=%2Fdesigner";

function StartButton({ children = "Start planning", cta }: { children?: React.ReactNode; cta: string }) {
  return <TrackedLink href={START_HREF} cta={cta} className={styles.button}>{children} <span aria-hidden="true">↗</span></TrackedLink>;
}

/** Editorial illustration, deliberately not presented as an available template. */
function HomeDrawing() {
  return <svg viewBox="0 0 600 470" role="img" aria-label="Illustrative floor plan showing bedrooms, living and dining spaces, a kitchen, and a garden. Not a builder template.">
    <defs><pattern id="landing-grid" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M22 0H0V22" fill="none" stroke="#d7d4c8" strokeWidth=".5" /></pattern></defs>
    <rect width="600" height="470" fill="url(#landing-grid)" />
    <g fill="none" stroke="#777a69" strokeWidth="1"><path d="M93 44H507M93 38V50M507 38V50M546 84V383M540 84H552M540 383H552" /></g>
    <text x="300" y="33" textAnchor="middle" fill="#65685b" fontSize="10" letterSpacing="3">A PLACE TO CALL YOUR OWN</text>
    <rect x="94" y="84" width="412" height="300" fill="#fcfbf6" stroke="#343b31" strokeWidth="7" />
    <path d="M94 229H262V84M262 229H330M369 229H506M330 84V229M330 303V384M330 266V229" fill="none" stroke="#343b31" strokeWidth="5" />
    <path d="M137 84H207M375 84H456M506 267V339M134 384H226M94 270V330" stroke="#fcfbf6" strokeWidth="8" />
    <path d="M137 84H207M375 84H456M506 267V339M134 384H226M94 270V330" stroke="#9caa9c" strokeWidth="2" />
    <g fill="#e3dac9" stroke="#9b9483" strokeWidth="1.5"><rect x="121" y="108" width="105" height="81" rx="3"/><rect x="129" y="115" width="39" height="23" rx="3" fill="#faf7ee"/><rect x="178" y="115" width="39" height="23" rx="3" fill="#faf7ee"/><path d="M122 148H225"/><rect x="356" y="109" width="121" height="76" rx="3"/><rect x="364" y="116" width="44" height="22" rx="3" fill="#faf7ee"/><rect x="418" y="116" width="49" height="22" rx="3" fill="#faf7ee"/><path d="M357 147H477"/></g>
    <g fill="#dce3d6" stroke="#8b9986" strokeWidth="1.5"><rect x="119" y="258" width="32" height="87" rx="6"/><rect x="151" y="316" width="68" height="29" rx="6"/><rect x="181" y="265" width="45" height="31" rx="12"/></g>
    <g fill="#e8dfd0" stroke="#9b9483" strokeWidth="1.5"><rect x="368" y="271" width="65" height="72" rx="18"/><path d="M359 284V301M359 315V331M442 284V301M442 315V331" strokeWidth="5"/><path d="M284 104V193H311" fill="none" strokeWidth="17"/></g>
    <g fill="#515b4d" fontFamily="sans-serif" fontSize="10" textAnchor="middle" letterSpacing="1.2"><text x="177" y="211">REST</text><text x="416" y="211">RECHARGE</text><text x="215" y="364">LIVE</text><text x="405" y="365">GATHER</text><text x="298" y="216" fontSize="8">COOK</text></g>
    <path d="M267 384H309" stroke="#fcfbf6" strokeWidth="9"/><path d="M268 384V344Q308 344 308 384" fill="none" stroke="#9b9483" strokeWidth="1.5"/>
    <g fill="#c3ceb6" stroke="#8d9b80"><circle cx="114" cy="423" r="16"/><circle cx="141" cy="426" r="12"/><circle cx="465" cy="422" r="19"/><circle cx="491" cy="430" r="11"/></g>
    <path d="M285 404V445" stroke="#a69c88" strokeWidth="2" strokeDasharray="3 4"/>
    <text x="410" y="434" fontSize="9" fill="#65685b" letterSpacing="2">ROOM TO GROW</text>
    <path d="M555 413V390L551 399M555 390L559 399" fill="none" stroke="#343b31"/><text x="555" y="427" fontSize="9" textAnchor="middle" fill="#343b31">N</text>
  </svg>;
}

// Server component: only LandingNav (menu state) and TrackedLink (CTA events)
// hydrate; everything else ships as static HTML.
export default function MarketingLanding() {
  return <div className={`${styles.page} ${display.variable} ${body.variable}`}>
    <a className={styles.skip} href="#main-content">Skip to content</a>
    <header className={styles.header}>
      {/* prefetch={false}: this link points at the page it sits on, so the
          viewport prefetch was an ~8KB RSC request on every landing visit */}
      <Link href="/" prefetch={false} className={styles.logo} aria-label="ArchIt home"><svg viewBox="0 0 28 30" width="27" height="29" fill="none" aria-hidden="true"><path d="M3 13L14 3L25 13V27H3V13Z M18 4V1H23V8" stroke="currentColor" strokeWidth="1.8" /></svg>ArchIt<span className={styles.logoDot}>.</span></Link>
      <LandingNav />
    </header>

    <main id="main-content">
      <section className={styles.hero} aria-labelledby="hero-title">
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}><span /> A little imagination. A place of your own.</p>
          <h1 id="hero-title">A home begins<br />with <em>your idea.</em></h1>
          <p className={styles.intro}>Give it room to grow. Set up your plot, arrange your rooms, and explore your home in 3D — right in your browser.</p>
          <div className={styles.actions}><StartButton cta="hero" /><a className={styles.secondary} href="#builder-demo">See the builder <span aria-hidden="true">↓</span></a></div>
          <p className={styles.small}>Free to use right now · Sign in to create and save</p>
        </div>
        <figure className={styles.drawing}>
          <div className={styles.drawingTop}><span>THE POSSIBILITIES START HERE</span><span>FIG. 01</span></div>
          <HomeDrawing />
          <figcaption><span>A home, imagined.</span><span>Illustrative concept · Not to scale</span></figcaption>
        </figure>
      </section>
      <div className={styles.featureStrip}><span>Made for your first ideas</span><span>Plot sizes in feet or meters</span><span>2D & 3D views</span><span>Save and come back</span></div>

      <section className={styles.section} id="layouts" aria-labelledby="layouts-title">
        <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>01 / A starting point</p><h2 id="layouts-title">Skip the blank canvas.</h2></div><p>Explore a few layouts already in the builder. Pick a starting point, then make room for your own ideas.</p></div>
        <div className={styles.starterGrid}>{starters.map((starter) => {
          const template = TEMPLATE_CATALOG.find((entry) => entry.key === starter.key)!;
          return <article className={styles.starter} key={starter.key}>
            <p className={styles.eyebrow}>{starter.type}</p><h3>{starter.label}</h3><p className={styles.roomList}>{starter.rooms}</p>
            <details><summary>Explore this starting point <span aria-hidden="true">+</span></summary><div className={styles.starterDetails}><strong>{template.name}</strong><p>{template.desc}. {starter.note}</p><p>In the builder, open Templates and choose “{template.name}”.</p><StartButton cta={`starter_${starter.key}`}>Open the builder</StartButton></div></details>
          </article>;
        })}</div>
        <p className={styles.caption}>Starter layouts are editable concepts. Review room connections and dimensions for your project; they are not construction drawings.</p>
      </section>

      <section className={`${styles.section} ${styles.workflow}`} id="how-it-works" aria-labelledby="workflow-title">
        <div><p className={styles.eyebrow}>02 / From thought to layout</p><h2 id="workflow-title">Small steps.<br />Your own space.</h2><a className={styles.secondary} href="#builder-demo">Take a look inside <span aria-hidden="true">↘</span></a></div>
        <ol className={styles.steps}>
          <li><span>01</span><div><h3>Start with your plot.</h3><p>Give your project a name, enter its width and depth, and choose your floors.</p></div></li>
          <li><span>02</span><div><h3>Make room for real life.</h3><p>Start from a template or add rooms yourself. Explore windows, doors, furniture, and finishes.</p></div></li>
          <li><span>03</span><div><h3>See it from another angle.</h3><p>Switch between 2D and 3D to explore your design. Save it to your account and keep refining.</p></div></li>
        </ol>
      </section>

      <section className={`${styles.section} ${styles.demo}`} id="builder-demo" aria-labelledby="demo-title">
        <div className={styles.sectionHeading}><div><p className={styles.eyebrow}>03 / Inside the builder</p><h2 id="demo-title">Less guessing. More exploring.</h2></div><p>Watch a short builder walkthrough before you start. Play, pause, or go fullscreen at your own pace.</p></div>
        <div className={styles.videoFrame}><div className={styles.videoBar}><span><i /> ARCHIT / THE DESIGN WORKSPACE</span><span>BUILDER WALKTHROUGH</span></div><video controls playsInline preload="none" poster="/demo/builder-poster.webp" aria-label="Silent ArchIt builder walkthrough showing the design workspace and material controls"><source src="/demo/builder.av1.mp4" type='video/mp4; codecs="av01.0.05M.08"' /><source src="/demo/builder.h264.mp4" type="video/mp4" />Your browser does not support video. <a href="/demo/builder.h264.mp4">Download the builder walkthrough</a>.</video></div>
        <p className={styles.caption}>Silent demo · The builder includes room tools, material controls, 2D and 3D views, and saved designs.</p>
      </section>

      <section className={`${styles.section} ${styles.faq}`} aria-labelledby="faq-title"><div><p className={styles.eyebrow}>A few things to know</p><h2 id="faq-title">Before you begin.</h2></div><div>
        <details><summary>Do I need design experience?<span aria-hidden="true">+</span></summary><p>You can begin with a template and explore the room tools at your own pace. ArchIt is a place to develop ideas before discussing them with a professional.</p></details>
        <details><summary>Is the builder free?<span aria-hidden="true">+</span></summary><p>The builder and its templates are currently free. You need an account to create projects and save your designs.</p></details>
        <details><summary>Can I use a design to build my house?<span aria-hidden="true">+</span></summary><p>Use it to communicate your ideas. Layouts and cost estimates are preliminary; an architect or engineer needs to check the design for your site before construction.</p></details>
        <details><summary>Can I still search for properties?<span aria-hidden="true">+</span></summary><p>Yes. ArchIt Find is available separately for browsing property listings on a map.</p><TrackedLink href="/find" cta="faq_find" className={styles.textButton}>Sign in to explore properties ↗</TrackedLink></details>
      </div></section>

      <section className={styles.finale}><p className={styles.eyebrow}>There is room for your idea.</p><h2>Let’s make a start.</h2><StartButton cta="finale">Plan your home</StartButton><p>Start small. Save your progress. Make it yours.</p></section>
    </main>
    <footer className={styles.footer}><span>ArchIt. <span>A place for your next idea.</span></span><nav aria-label="Footer navigation"><Link href="/pricing">Pricing</Link><Link href="/contact">Contact</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><a href="https://archit-lit.chaudharyankit.in/" target="_blank" rel="noreferrer">Explore ArchIt Lite ↗</a></nav></footer>
  </div>;
}
