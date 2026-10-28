"use client";

import { useEffect, useRef } from "react";
import type { Listing } from "@/lib/types";
import PropertyCard from "./PropertyCard";

// state notices float over the map, so they keep the floating shadow
const notice =
  "rounded-md border border-line bg-paper/95 text-[14px] leading-relaxed text-ink shadow-[0_18px_35px_-24px_rgb(41_55_44/0.45)] backdrop-blur";
const focusRing =
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent";

export default function PropertyCarousel({
  listings,
  onSelect,
  hasAny = true,
  status = "ready",
  selectedId,
  onReset,
  onRetry,
  emptyMessage,
}: {
  listings: Listing[];
  onSelect: (id: string) => void;
  hasAny?: boolean;
  /** replaces the "no match / clear filters" empty state (e.g. an empty map area) */
  emptyMessage?: string;
  status?: "loading" | "ready" | "error";
  selectedId?: string | null;
  onReset?: () => void;
  onRetry?: () => void;
}) {
  const stripRef = useRef<HTMLDivElement>(null);
  // Centre the card for the listing picked on the map. Scrolls only the strip:
  // scrollIntoView would also scroll every overflow:hidden ancestor, nudging
  // the whole map canvas on mobile.
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip || !selectedId) return;
    const card = strip.querySelector<HTMLElement>(`[data-listing-id="${CSS.escape(selectedId)}"]`);
    if (!card) return;
    const left = card.offsetLeft - (strip.clientWidth - card.offsetWidth) / 2;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    strip.scrollTo({ left: Math.max(0, left), behavior: reduce ? "auto" : "smooth" });
  }, [selectedId, listings]);
  if (status === "loading") return <div role="status" className={`${notice} p-5 font-semibold`}>Loading properties…</div>;
  if (status === "error") return <div role="alert" className={`${notice} pointer-events-auto p-5`}><p className="font-display text-[18px] font-medium tracking-[-0.01em]">Properties couldn’t be loaded.</p><p className="mt-1 text-ink-soft">Check your connection and try again.</p><button onClick={onRetry} className={`${focusRing} mt-3 min-h-11 rounded-[5px] bg-accent px-5 py-3 text-[13px] font-semibold text-paper transition-colors hover:bg-accent-deep`}>Try again</button></div>;
  if (listings.length === 0 && emptyMessage) {
    return <div role="status" className={`${notice} pointer-events-auto px-5 py-4 font-semibold`}>{emptyMessage}</div>;
  }
  if (listings.length === 0) {
    return (
      <div role="status" className={`${notice} pointer-events-auto px-5 py-4 font-semibold`}>
        {hasAny
          ? "No properties match your search."
          : "No properties yet — press “+ Add property”, then click a spot on the map."}
        {hasAny && <div className="mt-2"><p className="mb-3 font-normal text-ink-soft">Try another location or clear your filters to explore more places.</p><button onClick={onReset} className={`${focusRing} min-h-11 rounded-[5px] border border-line-strong px-5 py-3 text-[13px] font-semibold text-ink transition-colors hover:border-ink`}>Clear search & filters</button></div>}
      </div>
    );
  }
  return (
    /* strip itself must not eat clicks meant for the map/panels behind it —
       only the cards are interactive */
    <div ref={stripRef} className="no-scrollbar pointer-events-none relative flex snap-x gap-3 overflow-x-auto pb-1">
      {listings.map((l) => (
        <PropertyCard key={l.id} listing={l} selected={selectedId === l.id} onSelect={onSelect} />
      ))}
    </div>
  );
}
