"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

// Share row for public pages (/property/[id]). Shared links are the growth
// channel — most of them travel over WhatsApp — so WhatsApp gets the first,
// most prominent button; the system share sheet shows only where the browser
// has one (navigator.share, mostly mobile), and copy-link works everywhere.

type Props = {
  /** Absolute URL to share (canonical, not the current location). */
  url: string;
  /** Short line that goes before the URL, e.g. "3 BHK in Chandigarh — ₹45,00,000". */
  title: string;
  className?: string;
};

/** wa.me deep link with the message pre-filled (opens the app on phones). */
export function whatsAppShareUrl(title: string, url: string): string {
  return `https://wa.me/?text=${encodeURIComponent(`${title}\n${url}`)}`;
}

// navigator.share never changes during a page's life, so there is nothing to
// subscribe to. The server snapshot is false, which keeps hydration stable and
// reveals the button right after hydrating on browsers that support it.
const noopSubscribe = () => () => {};
const canNativeShare = () => typeof navigator !== "undefined" && typeof navigator.share === "function";

/** Copy via the async Clipboard API, falling back to execCommand off-HTTPS. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // permission denied or not focused: try the legacy path
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

const BTN =
  "inline-flex min-h-11 items-center gap-2 rounded-full px-3.5 py-2 text-[14px] sm:px-4 font-bold transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum";

export default function ShareButtons({ url, title, className }: Props) {
  const nativeShare = useSyncExternalStore(noopSubscribe, canNativeShare, () => false);
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  async function onCopy() {
    const ok = await copyText(url);
    setCopied(ok ? "ok" : "fail");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied("idle"), 2000);
  }

  async function onNativeShare() {
    try {
      await navigator.share({ title, text: title, url });
    } catch {
      // AbortError when the user closes the sheet: nothing to do
    }
  }

  return (
    <div role="group" aria-label="Share this listing" className={`flex flex-wrap items-center gap-2 ${className ?? ""}`}>
      <a
        href={whatsAppShareUrl(title, url)}
        target="_blank"
        rel="noopener noreferrer"
        className={`${BTN} bg-[#1f7a47] text-white`}
      >
        <svg aria-hidden viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
          <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" />
        </svg>
        WhatsApp
        <span className="sr-only">(opens in a new tab)</span>
      </a>
      <button type="button" onClick={onCopy} className={`${BTN} bg-white/70 text-plum`}>
        <svg aria-hidden viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
          <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
        </svg>
        {copied === "ok" ? "Copied" : copied === "fail" ? "Copy failed" : "Copy link"}
      </button>
      {nativeShare && (
        <button type="button" onClick={onNativeShare} className={`${BTN} bg-white/70 text-plum`}>
          <svg aria-hidden viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
          </svg>
          Share
        </button>
      )}
      {/* Screen readers hear the copy result; the button label alone is not announced. */}
      <span role="status" aria-live="polite" className="sr-only">
        {copied === "ok" ? "Link copied to clipboard" : copied === "fail" ? "Could not copy the link" : ""}
      </span>
    </div>
  );
}
