import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type {
  Design,
  DesignMeta,
  DesignStateV3,
  Listing,
  ListingType,
  PropertyKind,
} from "./types";

// one client per server process, survives dev HMR reloads
const globalForDb = globalThis as unknown as { __supabase?: SupabaseClient };

// Secret key: server-only, bypasses RLS. Never import this module in client code.
function connect(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase server env missing: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY",
    );
  }
  return (globalForDb.__supabase ??= createClient(url, key, {
    auth: { persistSession: false },
  }));
}

// Lazy on purpose. `next build` evaluates every route module to collect page
// data, so a client constructed at import time fails the build on any machine
// without Supabase secrets (CI). The proxy defers connect() to the first real
// query, which only happens in a request where the env is present.
export const db = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = connect();
    const value = Reflect.get(client, prop);
    // Bind to the real client, not the proxy, so methods relying on internal
    // state (including any private fields) see the instance they belong to.
    return typeof value === "function" ? value.bind(client) : value;
  },
});

// columns safe to expose publicly; `owner` stays paywalled (#3) and
// `user_id` never leaves the server unprompted
export const PUBLIC_COLUMNS =
  "id, building_name, address, city, price, type, kind, beds, baths, sqft, rooms, area_m, floors, lng, lat, photo, photos, featured";

// Same set plus user_id, for selects that need to derive ownership server-side.
// user_id is used to compute the `mine` flag and is stripped before the row is
// returned — it must never appear in a response body (rowToListing drops it).
export const OWNED_COLUMNS = `${PUBLIC_COLUMNS}, user_id`;

export type PublicPropertyRow = Omit<PropertyRow, "owner">;

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
  photos: string[] | null;
  user_id: string | null;
  /** true when the lister paid the ₹250 featured-listing fee */
  featured: boolean;
}

// user_id deliberately excluded: routes stamp it from the Clerk session,
// never from the client body
export function listingToRow(
  l: Omit<Listing, "id">,
): Omit<PropertyRow, "id" | "user_id"> {
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
    // photo mirrors photos[0] so older readers keep working
    photo: l.photos?.[0] ?? l.photo ?? null,
    photos: l.photos ?? (l.photo ? [l.photo] : []),
    featured: l.featured ?? false,
  };
}

export interface DesignRow {
  id: string;
  user_id: string;
  name: string;
  plot_lng: number;
  plot_lat: number;
  plot_w: number;
  plot_d: number;
  design: DesignStateV3;
  snapshot: string | null;
  meta: DesignMeta | null;
}

// user_id deliberately excluded: routes stamp it from the Clerk session,
// never from the client body (same rule as listings)
export function designToRow(d: Omit<Design, "id">): Omit<DesignRow, "id" | "user_id"> {
  return {
    name: d.name,
    plot_lng: d.plotCenter[0],
    plot_lat: d.plotCenter[1],
    plot_w: d.plotW,
    plot_d: d.plotD,
    design: d.design,
    snapshot: d.snapshot ?? null,
    meta: d.meta ?? null,
  };
}

export function rowToDesign(r: DesignRow): Design {
  return {
    id: r.id,
    name: r.name,
    plotCenter: [r.plot_lng, r.plot_lat],
    plotW: r.plot_w,
    plotD: r.plot_d,
    design: r.design,
    snapshot: r.snapshot ?? undefined,
    meta: r.meta ?? undefined,
  };
}

export function rowToListing(r: PublicPropertyRow): Listing {
  return {
    id: r.id,
    buildingName: r.building_name ?? undefined,
    owner: "owner" in r ? (r as PropertyRow).owner ?? undefined : undefined,
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
    photo: r.photos?.[0] ?? r.photo ?? undefined,
    photos: r.photos?.length ? r.photos : r.photo ? [r.photo] : [],
    // `mine` is stamped by the route from the session; the raw user_id is never
    // returned to the client (see OWNED_COLUMNS).
    featured: r.featured ?? false,
  };
}

/** True when `row` belongs to the given session user. Server-side only. */
export function ownsRow(
  row: { user_id?: string | null },
  userId: string | null | undefined,
): boolean {
  return !!userId && row.user_id === userId;
}
