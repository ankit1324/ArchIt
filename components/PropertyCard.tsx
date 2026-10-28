import Image from "next/image";
import { memo } from "react";
import type { Listing } from "@/lib/types";
import { formatPrice } from "@/lib/types";
import { safeImageUrl, thumbnailUrl } from "@/lib/url";

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
  // badge colours follow the map prisms (Map3D PRISM_COLORS): sale is
  // highlight, rent is clay, showcase is mist. All three carry ink text, the
  // only text colour that passes AA on every one of them.
  const tone =
    listing.type === "showcase"
      ? "bg-mist text-ink"
      : listing.type === "sale"
        ? "bg-highlight text-ink"
        : "bg-clay text-ink";
  const label =
    listing.type === "showcase" ? "Showcase" : listing.type === "sale" ? "For Sale" : "For Rent";
  // a stored 480px webp needs no optimizer round-trip; older photos get one
  const thumb = thumbnailUrl(listing.photo, 480);
  const photo = thumb ?? safeImageUrl(listing.photo);
  return (
    <button
      data-listing-id={listing.id}
      onClick={() => onSelect?.(listing.id)}
      aria-pressed={selected}
      className="group pointer-events-auto relative h-[196px] w-[236px] shrink-0 snap-start overflow-hidden rounded-md border border-line bg-forest text-left shadow-[0_18px_35px_-24px_rgb(41_55_44/0.45)] transition-transform hover:-translate-y-0.5 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none motion-reduce:hover:translate-y-0"
    >
      {/* drawn above the photo so the selection reads on any image */}
      {selected && (
        <span className="pointer-events-none absolute inset-0 z-10 rounded-md border-[3px] border-accent" />
      )}
      {photo ? (
        <Image
          src={photo}
          unoptimized={!!thumb}
          alt={`${listing.address}, ${listing.city}`}
          fill
          sizes="236px"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
      ) : (
        <div className="absolute inset-0 bg-forest" />
      )}
      {/* scrims keep paper text legible over bright photos; the top one is
          heavier because the title sits on it */}
      <div className="absolute inset-0 bg-gradient-to-b from-ink/80 via-ink/25 to-ink/60" />

      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
        <div className="font-display text-[15px] font-medium leading-snug tracking-[-0.01em] text-paper [text-shadow:0_1px_3px_rgb(0_0_0/0.55)]">
          {listing.buildingName || listing.address},
          <br />
          {listing.buildingName ? listing.address : listing.city}
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${tone}`}>
          {label}
        </span>
      </div>

      <div className="absolute inset-x-0 bottom-0 flex flex-col items-start gap-2 p-3">
        {/* showcase listings have no price: say so, as PropertyDetailPanel does */}
        <span className={`rounded-[3px] px-1.5 py-0.5 text-[16px] font-bold tabular-nums ${tone}`}>
          {listing.type === "showcase" ? "Not for sale/rent" : formatPrice(listing)}
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
              className="rounded-full bg-ink/60 px-2 py-1 text-[11px] font-semibold tabular-nums text-paper"
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
