import { cityName, type PublicListing } from "@/lib/public-listings";
import { formatPrice } from "@/lib/types";
import { safeImageUrl } from "@/lib/url";

// Text shared by the listing page, its metadata and its Open Graph card, so a
// WhatsApp preview and the page it opens always say the same thing.

const KIND_LABEL: Record<string, string> = {
  apartments: "Apartment",
  house: "House",
  land: "Plot",
  room: "Room",
  business: "Commercial space",
  hotels: "Hotel",
};

/** Kinds where beds/baths/rooms mean something (a plot has none). */
export function isDwelling(l: PublicListing): boolean {
  return l.kind === "apartments" || l.kind === "house" || l.kind === "room" || l.kind === "hotels";
}

export function headline(l: PublicListing): string {
  return l.buildingName || l.address;
}

export function kindLabel(l: PublicListing): string {
  return KIND_LABEL[l.kind] ?? "Property";
}

export function dealLabel(l: PublicListing): string {
  return l.type === "sale" ? "For Sale" : "For Rent";
}

export function photosOf(l: PublicListing): string[] {
  return (l.photos ?? []).map((p) => safeImageUrl(p)).filter((p): p is string => !!p);
}

export function summary(l: PublicListing): string {
  const deal = l.type === "sale" ? "for sale" : "for rent";
  const facts = [
    l.beds ? `${l.beds} bed` : null,
    l.baths ? `${l.baths} bath` : null,
    l.sqft ? `${l.sqft.toLocaleString("en-IN")} sqft` : null,
  ].filter(Boolean);
  const where = [l.buildingName ? l.address : null, l.city].filter(Boolean).join(", ");
  return `${kindLabel(l)} ${deal}${where ? ` in ${where}` : ""} at ${formatPrice(l)}${
    facts.length ? ` · ${facts.join(" · ")}` : ""
  }. Explore it on ArchIt's 3D map.`;
}

/** One line for share messages: "Sunrise Villa — ₹45,00,000 · For Sale in Chandigarh". */
export function shareLine(l: PublicListing): string {
  const city = cityName(l.city);
  return `${headline(l)} — ${formatPrice(l)} · ${dealLabel(l)}${city ? ` in ${city}` : ""}`;
}
