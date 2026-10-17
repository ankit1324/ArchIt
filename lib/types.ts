export type ListingType = "sale" | "rent" | "showcase";

/** what a listing opens on: its photos or the attached 3D design */
export type ListingView = "photos" | "3d";

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
  /** first photo, kept in sync with photos[0] for older consumers */
  photo?: string;
  /** up to 5 photos, Supabase Storage public URLs */
  photos?: string[];
  kind: PropertyKind;
  /**
   * True when the current session user is the lister (server-computed).
   * Only the lister may edit/delete. The raw Clerk id is never sent to the
   * client — the server compares it and returns this flag instead.
   */
  mine?: boolean;
  /** true when the lister paid the ₹250 featured-listing fee */
  featured?: boolean;
  /** attached ArchIt design; visitors only see it while it is published */
  designId?: string;
  /** snapshot of the attached design (published only) */
  designSnapshot?: string;
  /** what the listing opens on; visitors get "photos" unless the design is published */
  defaultView?: ListingView;
  /** owner-only: whether the attached design is currently published */
  designPublished?: boolean;
}

export interface Poi {
  id: string;
  label?: string;
  icon: "building" | "park" | "coffee" | "bank" | "scissors" | "compare";
  coords: [number, number];
}

export interface Filters {
  type: ListingType | null;
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
  /** ISO time it was published; absent = private */
  publishedAt?: string;
  /** short human label for the picked spot, e.g. "Sector 8, Chandigarh" */
  place?: string;
}

/**
 * What other users see of a published design. Never carries user_id or the
 * private parts of meta (budget, notes) — see lib/showcase.ts.
 */
export interface PublishedDesign {
  id: string;
  name: string;
  /** [lng, lat]; null when no spot was picked */
  plotCenter: [number, number] | null;
  plotW: number;
  plotD: number;
  place?: string;
  facing?: DesignMeta["facing"];
  snapshot?: string;
  authorName: string;
  publishedAt: string;
  /** true when the session user published it (server-computed) */
  mine: boolean;
  /** only on the single-design endpoint */
  design?: DesignStateV3;
}

export function formatPrice(l: Listing): string {
  if (l.type === "showcase") return "Showcase";
  const n = `₹${l.price.toLocaleString("en-IN")}`;
  return l.type === "rent" ? `${n}/mo` : n;
}
