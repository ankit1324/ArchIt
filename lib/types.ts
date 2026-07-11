export type ListingType = "sale" | "rent";

export type PropertyKind =
  | "apartments"
  | "house"
  | "land"
  | "room"
  | "business"
  | "hotels";

export interface Listing {
  id: string;
  buildingName?: string;
  owner?: string;
  address: string;
  city: string;
  price: number;
  type: ListingType;
  beds: number;
  baths: number;
  sqft: number;
  rooms: number;
  areaM: number; // plot/unit area in meters, for the Area filter
  floors: number;
  coords: [number, number]; // [lng, lat]
  photo?: string;
  kind: PropertyKind;
}

export interface Poi {
  id: string;
  label?: string;
  icon: "building" | "park" | "coffee" | "bank" | "scissors" | "compare";
  coords: [number, number];
}

export interface Filters {
  kind: PropertyKind | null;
  price: [number, number];
  rooms: number | null; // 5 means 5+
  areaFrom: number;
  areaTo: number;
  floorArea: "less5" | "6-10" | "more10" | null;
}

export function formatPrice(l: Listing): string {
  const n = `₹${l.price.toLocaleString("en-IN")}`;
  return l.type === "rent" ? `${n}/mo` : n;
}
