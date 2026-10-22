import Image from "next/image";
import { memo, useEffect, useRef } from "react";
import type { Listing } from "@/lib/types";
import { formatPrice } from "@/lib/types";
import { safeImageUrl } from "@/lib/url";

function PropertyCard({
  listing,
  onSelect,
  selected = false,
}: {
  listing: Listing;
  /** receives the listing id so the parent can pass one stable callback */
  onSelect?: (id: string) => void;
  selected?: boolean;
}) {
  const sale = listing.type === "sale";
  const ref = useRef<HTMLButtonElement>(null);
  // keep the card for the listing picked on the map in view in the strip
  useEffect(() => {
    if (!selected) return;
    ref.current?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [selected]);
  return (
    <button
      ref={ref}
      onClick={() => onSelect?.(listing.id)}
      aria-pressed={selected}
      style={selected ? { boxShadow: "inset 0 0 0 3px #e2ef6a, 0 8px 24px #3d183030" } : undefined}
      className="group pointer-events-auto relative h-[196px] w-[236px] shrink-0 snap-start overflow-hidden rounded-2xl text-left shadow-lg transition-transform hover:-translate-y-1"
    >
      {selected && <span className="pointer-events-none absolute inset-0 z-10 rounded-2xl border-[3px] border-lime" />}
      {safeImageUrl(listing.photo) ? (
        <Image
          src={safeImageUrl(listing.photo)!}
          alt={`${listing.address}, ${listing.city}`}
          fill
          sizes="236px"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-plum-soft to-plum" />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-plum/55 via-transparent to-plum/45" />

      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
        <div className="text-[13.5px] font-bold leading-snug text-white drop-shadow">
          {listing.buildingName || listing.address},
          <br />
          {listing.buildingName ? listing.address : listing.city}
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
            sale ? "bg-lime text-plum" : "bg-magenta text-white"
          }`}
        >
          {sale ? "For Sale" : "For Rent"}
        </span>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-2 p-3">
        <span
          className={`px-1.5 py-0.5 text-[17px] font-extrabold ${
            sale ? "bg-lime text-plum" : "bg-magenta text-white"
          }`}
        >
          {formatPrice(listing)}
        </span>
        <div className="flex flex-wrap gap-1.5">
          {[
            `${listing.beds} Beds`,
            `${listing.baths} Baths`,
            `${listing.sqft.toLocaleString()} Sqft`,
            // owner is paywalled and never present in the public list
            // ...(listing.owner ? [`Owner ${listing.owner}`] : []),
          ].map((t) => (
            <span
              key={t}
              className="rounded-full bg-plum/45 px-2 py-1 text-[10px] font-semibold text-white"
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}

// memoised: the strip re-renders on every keystroke / slider tick of the page,
// but a card only needs to repaint when its own listing or selection changes
export default memo(PropertyCard);
