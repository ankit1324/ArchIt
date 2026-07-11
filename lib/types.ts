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

/** one room block in an ArchIt design; extra builder fields pass through */
export interface DesignBlock {
  id: number;
  type: string;
  cx: number;
  cz: number;
  rot: number; // quarter turns
  w: number;
  len: number;
  [k: string]: unknown;
}

/** ArchIt builder save format */
export interface DesignStateV3 {
  v: 3;
  state: {
    floors?: Array<{ blocks: DesignBlock[] }> | null;
    blocks: DesignBlock[];
    floor?: number;
    [k: string]: unknown;
  };
}

/** setup answers collected before the builder opens */
export interface DesignMeta {
  unit?: "m" | "ft"; // input unit preference; plot dims are always stored in meters
  facing?: "N" | "E" | "S" | "W";
  budget?: number; // ₹
  notes?: string;
}

export interface Design {
  id: string;
  name: string;
  plotCenter: [number, number]; // [lng, lat]
  plotW: number; // east-west extent, meters
  plotD: number; // north-south extent, meters
  design: DesignStateV3;
  snapshot?: string;
  meta?: DesignMeta;
}

export function formatPrice(l: Listing): string {
  const n = `₹${l.price.toLocaleString("en-IN")}`;
  return l.type === "rent" ? `${n}/mo` : n;
}
