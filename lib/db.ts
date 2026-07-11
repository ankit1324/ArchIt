import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Listing, ListingType, PropertyKind } from "./types";

// one client per server process, survives dev HMR reloads
const globalForDb = globalThis as unknown as { __supabase?: SupabaseClient };

// Secret key: server-only, bypasses RLS. Never import this module in client code.
export const db =
  globalForDb.__supabase ??
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false } },
  );
globalForDb.__supabase = db;

export interface PropertyRow {
  id: string;
  building_name: string | null;
  owner: string | null;
  address: string;
  city: string;
  price: number;
  type: ListingType;
  kind: PropertyKind;
  beds: number;
  baths: number;
  sqft: number;
  rooms: number;
  area_m: number;
  floors: number;
  lng: number;
  lat: number;
  photo: string | null;
}

export function listingToRow(l: Omit<Listing, "id">): Omit<PropertyRow, "id"> {
  return {
    building_name: l.buildingName ?? null,
    owner: l.owner ?? null,
    address: l.address,
    city: l.city ?? "",
    price: l.price,
    type: l.type,
    kind: l.kind,
    beds: l.beds ?? 0,
    baths: l.baths ?? 0,
    sqft: l.sqft ?? 0,
    rooms: l.rooms ?? 1,
    area_m: l.areaM ?? 50,
    floors: l.floors ?? 1,
    lng: l.coords[0],
    lat: l.coords[1],
    photo: l.photo ?? null,
  };
}

export function rowToListing(r: PropertyRow): Listing {
  return {
    id: r.id,
    buildingName: r.building_name ?? undefined,
    owner: r.owner ?? undefined,
    address: r.address,
    city: r.city,
    price: Number(r.price),
    type: r.type,
    kind: r.kind,
    beds: r.beds,
    baths: r.baths,
    sqft: r.sqft,
    rooms: r.rooms,
    areaM: r.area_m,
    floors: r.floors,
    coords: [r.lng, r.lat],
    photo: r.photo ?? undefined,
  };
}
