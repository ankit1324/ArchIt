import type { Filters, Listing, PublishedDesign } from "./types";

export const DEFAULT_FILTERS: Filters = {
  type: null,
  kind: null,
  price: [0, Infinity],
  rooms: null,
  areaFrom: 0,
  areaTo: Infinity,
  floorArea: null,
};

export type ListingSort = "recommended" | "price-asc" | "price-desc" | "area-desc";

/** which pins the /find map shows */
export type MapLayer = "listings" | "designs" | "both";

function matchesWords(fields: Array<string | undefined>, query: string): boolean {
  const text = fields.join(" ").toLocaleLowerCase();
  return query.trim().toLocaleLowerCase().split(/\s+/).every((word) => text.includes(word));
}

export function matchesQuery(listing: Listing, query: string): boolean {
  return matchesWords([listing.buildingName, listing.address, listing.city], query);
}

/** search over a published design's name and place */
export function matchesDesignQuery(design: PublishedDesign, query: string): boolean {
  return matchesWords([design.name, design.place], query);
}

export function findListings(listings: Listing[], filters: Filters, query: string, sort: ListingSort): Listing[] {
  return listings.filter((l) => {
    if (!matchesQuery(l, query)) return false;
    if (filters.type && l.type !== filters.type) return false;
    if (filters.kind && l.kind !== filters.kind) return false;
    // showcase listings carry price 0 (not for sale/rent), so price ranges ignore them
    if (l.type !== "showcase" && (l.price < filters.price[0] || l.price > filters.price[1])) return false;
    if (filters.rooms !== null && (filters.rooms === 5 ? l.rooms < 5 : l.rooms !== filters.rooms)) return false;
    if (l.areaM < filters.areaFrom || l.areaM > filters.areaTo) return false;
    if (filters.floorArea === "less5" && l.floors > 5) return false;
    if (filters.floorArea === "6-10" && (l.floors < 6 || l.floors > 10)) return false;
    if (filters.floorArea === "more10" && l.floors <= 10) return false;
    return true;
  }).sort((a, b) => {
    if (sort === "price-asc" || sort === "price-desc") {
      const showcase = Number(a.type === "showcase") - Number(b.type === "showcase");
      if (showcase) return showcase; // showcase listings sort last on price sorts
    }
    if (sort === "price-asc") return a.price - b.price;
    if (sort === "price-desc") return b.price - a.price;
    if (sort === "area-desc") return b.areaM - a.areaM;
    return Number(!!b.featured) - Number(!!a.featured);
  });
}

export function countFilters(filters: Filters): number {
  return [filters.type, filters.kind, filters.rooms !== null, filters.price[0] > 0 || Number.isFinite(filters.price[1]), filters.areaFrom > 0 || Number.isFinite(filters.areaTo), filters.floorArea].filter(Boolean).length;
}
