"use client";

import { useEffect, useRef } from "react";
import type { Listing } from "@/lib/types";
import PropertyCard from "./PropertyCard";

export default function PropertyCarousel({
  listings,
  onSelect,
  hasAny = true,
  status = "ready",
  selectedId,
  onReset,
  onRetry,
}: {
  listings: Listing[];
  onSelect: (id: string) => void;
  hasAny?: boolean;
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
  if (status === "loading") return <div role="status" className="rounded-2xl bg-cream/95 p-6 text-sm font-semibold text-plum">Loading properties…</div>;
  if (status === "error") return <div role="alert" className="pointer-events-auto rounded-2xl bg-cream/95 p-5 text-sm text-plum"><p className="font-bold">Properties couldn’t be loaded.</p><p className="mt-1 text-xs">Check your connection and try again.</p><button onClick={onRetry} className="mt-3 rounded-full bg-plum px-4 py-2 text-xs font-bold text-cream">Try again</button></div>;
  if (listings.length === 0) {
    return (
      <div role="status" className="bg-cream/95 pointer-events-auto rounded-2xl px-5 py-4 text-[13px] font-semibold text-plum">
        {hasAny
          ? "No properties match your search."
          : "No properties yet — press “+ Add property”, then click a spot on the map."}
        {hasAny && <div className="mt-2"><p className="mb-3 text-xs font-normal text-plum-soft">Try another location or clear your filters to explore more places.</p><button onClick={onReset} className="rounded-full bg-plum px-4 py-2 text-xs text-cream">Clear search & filters</button></div>}
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
