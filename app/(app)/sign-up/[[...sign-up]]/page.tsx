import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { LogoMark } from "@/components/icons";

export default function SignUpPage() {
  // The document scrolls (globals.css), so on short or landscape phones and
  // with the keyboard open the card's submit button stays reachable.
  return (
    <div className="flex min-h-full flex-col bg-paper text-ink">
      <header className="border-b border-line">
        <div className="mx-auto flex min-h-[72px] max-w-[1400px] items-center px-[clamp(20px,5.5vw,84px)]">
          <Link
            href="/"
            aria-label="ArchIt home"
            className="flex items-center gap-2 rounded-[5px] text-[24px] font-extrabold tracking-[-0.055em] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <LogoMark width={25} height={25} className="text-accent" aria-hidden="true" />
            <span>
              ArchIt<span className="text-accent">.</span>
            </span>
          </Link>
        </div>
      </header>
      {/* Clerk's card renders the page's h1 ("Create your account"). */}
      <main className="mx-auto grid w-full max-w-[1100px] flex-1 items-center gap-10 px-[clamp(20px,5.5vw,84px)] py-10 lg:grid-cols-[1fr_auto] lg:gap-20">
        <div className="hidden lg:block">
          <p className="flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-soft">
            <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
            Create an account
          </p>
          <p className="mt-5 font-display text-[48px] font-normal leading-[1.08] tracking-[-0.035em]">
            Make room for <em className="text-accent">your idea.</em>
          </p>
          <p className="mt-5 max-w-sm text-[15px] leading-[1.8] text-ink-soft">
            An account lets you save your designs and come back to them.
          </p>
        </div>
        <div className="flex justify-center">
          <SignUp />
        </div>
      </main>
    </div>
  );
}
