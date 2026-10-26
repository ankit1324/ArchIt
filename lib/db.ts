import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { ListingStatus } from "./moderation";
import type {
  Design,
  DesignMeta,
  DesignStateV3,
  Listing,
  ListingType,
  ListingView,
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

// Same set plus user_id and the moderation status, for selects that need to
// derive ownership server-side. user_id is used to compute the `mine` flag and
// is stripped before the row is returned — it must never appear in a response
// body (rowToListing drops it). status is only echoed to the lister
// (listingForViewer), since everyone else only ever sees live rows.
// design_id / default_view ride along so routes can apply the attached-design
// rules (lib/listing-presentation.ts presentListing) before anything reaches
// the client: visitors only see a design while it is published.
export const OWNED_COLUMNS = `${PUBLIC_COLUMNS}, user_id, status, design_id, default_view`;

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
  /** moderation state; public queries only return 'live' (lib/moderation.ts) */
  status: ListingStatus;
  /** attached design; set by the routes after validation, never by listingToRow */
  design_id: string | null;
  /** what the listing opens on; set by the routes, never by listingToRow */
  default_view: ListingView;
}

// user_id and status deliberately excluded: routes stamp them server-side,
// never from the client body. design_id / default_view are excluded too: the
// listing routes write them after validateListingWrite (absent = keep).
export function listingToRow(
  l: Omit<Listing, "id" | "designId">,
): Omit<PropertyRow, "id" | "user_id" | "status" | "design_id" | "default_view"> {
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
  /** NULL = private; set only by the publish route (and admin unpublish) */
  published_at: string | null;
  /** display name captured at publish time */
  author_name: string | null;
  /** short label for the picked spot */
  place: string | null;
}

// user_id deliberately excluded: routes stamp it from the Clerk session,
// never from the client body (same rule as listings).
// published_at / author_name / place are written only by the publish route.
export function designToRow(
  d: Omit<Design, "id">,
): Omit<DesignRow, "id" | "user_id" | "published_at" | "author_name" | "place"> {
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
    publishedAt: r.published_at ?? undefined,
    place: r.place ?? undefined,
  };
}

/**
 * For PUT /api/designs/[id]: the designer sends plotCenter [0, 0] for
 * standalone designs, so an update must never touch the stored location —
 * a published design's map pin moves only via the publish route.
 */
export function designUpdateRow(
  d: Omit<Design, "id">,
): Omit<ReturnType<typeof designToRow>, "plot_lng" | "plot_lat"> {
  const { name, plot_w, plot_d, design, snapshot, meta } = designToRow(d);
  return { name, plot_w, plot_d, design, snapshot, meta };
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

/**
 * rowToListing plus the viewer-specific fields: `mine`, and — for the lister
 * only — the moderation `status` of a listing that isn't live yet.
 */
export function listingForViewer(
  r: PublicPropertyRow,
  userId: string | null | undefined,
): Listing {
  const mine = ownsRow(r, userId);
  const listing: Listing = { ...rowToListing(r), mine };
  if (mine && r.status && r.status !== "live") listing.status = r.status;
  return listing;
}

export type AttachedDesign = { published: boolean; snapshot: string | null };

/**
 * Publish state + snapshot of the designs attached to listings, keyed by id —
 * one query for a whole page (see presentListing). Throws on a DB error.
 */
export async function attachedDesigns(
  ids: (string | null | undefined)[],
): Promise<Map<string, AttachedDesign>> {
  const unique = [...new Set(ids.filter((id): id is string => !!id))];
  const out = new Map<string, AttachedDesign>();
  if (!unique.length) return out;
  const { data, error } = await db
    .from("designs")
    .select("id, published_at, snapshot")
    .in("id", unique);
  if (error) throw new Error(error.message);
  for (const d of data as Pick<DesignRow, "id" | "published_at" | "snapshot">[]) {
    out.set(d.id, { published: !!d.published_at, snapshot: d.snapshot });
  }
  return out;
}

/**
 * What validateListingWrite needs to know about a design being attached:
 * null when it does not exist. Throws on a DB error.
 */
export async function designAttachCheck(
  designId: string,
  userId: string,
): Promise<{ owned: boolean; published: boolean } | null> {
  const { data, error } = await db
    .from("designs")
    .select("id, user_id, published_at")
    .eq("id", designId)
    .maybeSingle<Pick<DesignRow, "id" | "user_id" | "published_at">>();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return { owned: ownsRow(data, userId), published: !!data.published_at };
}

/** True when `row` belongs to the given session user. Server-side only. */
export function ownsRow(
  row: { user_id?: string | null },
  userId: string | null | undefined,
): boolean {
  return !!userId && row.user_id === userId;
}
