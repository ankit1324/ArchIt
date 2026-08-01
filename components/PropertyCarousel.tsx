"use client";

import type { Listing } from "@/lib/types";
import PropertyCard from "./PropertyCard";

export default function PropertyCarousel({
  listings,
  onSelect,
  hasAny = true,
}: {
  listings: Listing[];
  onSelect: (id: string) => void;
  hasAny?: boolean;
}) {
  if (listings.length === 0) {
    return (
      <div className="glass pointer-events-auto rounded-2xl px-5 py-4 text-[13px] font-semibold text-plum">
        {hasAny
          ? "No homes match these filters — try widening the price range."
          : "No properties yet — press “+ Add property”, then click a spot on the map."}
      </div>
    );
  }
  return (
    /* strip itself must not eat clicks meant for the map/panels behind it —
       only the cards are interactive */
    <div className="no-scrollbar pointer-events-none flex snap-x gap-3 overflow-x-auto pb-1">
      {listings.map((l) => (
        <PropertyCard key={l.id} listing={l} onClick={() => onSelect(l.id)} />
      ))}
    </div>
  );
}
