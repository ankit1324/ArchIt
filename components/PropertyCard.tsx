import Image from "next/image";
import type { Listing } from "@/lib/types";
import { formatPrice } from "@/lib/types";

export default function PropertyCard({
  listing,
  onClick,
}: {
  listing: Listing;
  onClick?: () => void;
}) {
  const sale = listing.type === "sale";
  return (
    <button
      onClick={onClick}
      className="group relative h-[196px] w-[236px] shrink-0 snap-start overflow-hidden rounded-2xl text-left shadow-lg transition-transform hover:-translate-y-1"
    >
      {listing.photo ? (
        <Image
          src={listing.photo}
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
            ...(listing.owner ? [`Owner ${listing.owner}`] : []),
          ].map((t) => (
            <span
              key={t}
              className="rounded-full bg-white/25 px-2 py-1 text-[10px] font-semibold text-white backdrop-blur-sm"
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}
