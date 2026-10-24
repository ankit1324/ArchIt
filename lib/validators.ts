import type {
  Design,
  DesignBlock,
  DesignMeta,
  DesignStateV3,
  Listing,
  ListingType,
  PropertyKind,
} from "./types";

/**
 * Hand-rolled body validators for the write routes. Pure: type imports only,
 * so they run under `node --test`. The image-URL allowlist check is injected
 * (`safeImageUrl` from lib/url.ts) rather than imported, since node's ESM
 * loader cannot resolve extensionless TS imports in the test runner.
 *
 * Each returns the narrowed value or a string error message — the shape
 * `parseJsonBody` in lib/request.ts turns into a 400.
 */

/** `safeImageUrl` shape: the URL back when allowed, null otherwise. */
export type ImageUrlCheck = (url: string) => string | null;

export const MAX_TEXT = 200;
export const MAX_PHOTOS = 5;
export const MAX_DESIGN_NAME = 100;
/** Serialized `design` JSON cap (1 MB). */
export const MAX_DESIGN_BYTES = 1024 * 1024;
/**
 * Largest count (beds, sqft, …) a listing may carry: the properties columns
 * are Postgres INT, so anything bigger used to fail the insert with a 500.
 */
export const MAX_COUNT = 2_147_483_647;
/**
 * Largest price accepted. The column is NUMERIC (no practical ceiling), but
 * prices come back through Number(): past 2^53 they silently lose digits, and
 * no real listing is anywhere near ₹9e15.
 */
export const MAX_PRICE = Number.MAX_SAFE_INTEGER;

const LISTING_TYPES: readonly ListingType[] = ["sale", "rent"];
const PROPERTY_KINDS: readonly PropertyKind[] = [
  "apartments",
  "house",
  "land",
  "room",
  "business",
  "hotels",
];

type Obj = Record<string, unknown>;

function isObj(v: unknown): v is Obj {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

type Field<T> = { ok: true; value: T } | { ok: false; error: string };

/** Postgres text cannot hold U+0000: such a string fails the write with a 500. */
function hasNul(v: string): boolean {
  return v.includes("\u0000");
}

/** Optional string ≤ max; absent (undefined/null) is fine. */
function optText(v: unknown, name: string, max = MAX_TEXT): Field<string | undefined> {
  if (v === undefined || v === null) return { ok: true, value: undefined };
  if (typeof v !== "string") return { ok: false, error: `${name} must be a string` };
  if (v.length > max) return { ok: false, error: `${name} too long (max ${max})` };
  if (hasNul(v)) return { ok: false, error: `${name} contains invalid characters` };
  return { ok: true, value: v };
}

function isLngLat(v: unknown): v is [number, number] {
  return (
    Array.isArray(v) &&
    v.length === 2 &&
    isFiniteNumber(v[0]) &&
    isFiniteNumber(v[1]) &&
    v[0] >= -180 &&
    v[0] <= 180 &&
    v[1] >= -90 &&
    v[1] <= 90
  );
}

/** Optional non-negative integer; defaults are applied by listingToRow. */
function optCount(v: unknown, name: string): Field<number | undefined> {
  if (v === undefined || v === null) return { ok: true, value: undefined };
  if (!isFiniteNumber(v) || !Number.isInteger(v) || v < 0) {
    return { ok: false, error: `${name} must be a non-negative integer` };
  }
  if (v > MAX_COUNT) return { ok: false, error: `${name} too large (max ${MAX_COUNT})` };
  return { ok: true, value: v };
}

// ---------------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------------

export type ListingInput = Omit<Listing, "id" | "mine" | "featured" | "hasOwner">;

/**
 * Validate a POST/PUT /api/properties body. Server-stamped fields (`id`,
 * `mine`, `featured`, `hasOwner`, `user_id`) are dropped here so nothing in
 * the body can set them.
 */
export function validateListing(v: unknown, safeImageUrl: ImageUrlCheck): ListingInput | string {
  if (!isObj(v)) return "body must be an object";

  if (typeof v.address !== "string" || !v.address.trim()) return "address required";
  if (v.address.length > MAX_TEXT) return `address too long (max ${MAX_TEXT})`;
  if (hasNul(v.address)) return "address contains invalid characters";

  const city = optText(v.city, "city");
  if (!city.ok) return city.error;

  // `!l.price` used to reject a genuine ₹0 listing; only NaN/negative are bad.
  if (!isFiniteNumber(v.price) || v.price < 0) return "price must be a number >= 0";
  if (v.price > MAX_PRICE) return "price too large";

  if (!isLngLat(v.coords)) return "coords must be [lng, lat] within range";

  if (typeof v.type !== "string" || !LISTING_TYPES.includes(v.type as ListingType)) {
    return "type must be sale or rent";
  }
  if (typeof v.kind !== "string" || !PROPERTY_KINDS.includes(v.kind as PropertyKind)) {
    return `kind must be one of ${PROPERTY_KINDS.join(", ")}`;
  }

  // same defaults as listingToRow, so the returned value is a complete listing
  const counts = { beds: 0, baths: 0, sqft: 0, rooms: 1, floors: 1, areaM: 50 };
  for (const key of Object.keys(counts) as (keyof typeof counts)[]) {
    const n = optCount(v[key], key);
    if (!n.ok) return n.error;
    if (n.value !== undefined) counts[key] = n.value;
  }

  let photos: string[] | undefined;
  if (v.photos !== undefined && v.photos !== null) {
    if (!Array.isArray(v.photos)) return "photos must be an array";
    if (v.photos.length > MAX_PHOTOS) return `max ${MAX_PHOTOS} photos`;
    for (const p of v.photos) {
      if (typeof p !== "string" || !safeImageUrl(p)) return "invalid photo url";
    }
    photos = v.photos as string[];
  }

  let photo: string | undefined;
  if (v.photo !== undefined && v.photo !== null && v.photo !== "") {
    if (typeof v.photo !== "string" || !safeImageUrl(v.photo)) return "invalid photo url";
    photo = v.photo;
  }

  const owner = optText(v.owner, "owner");
  if (!owner.ok) return owner.error;
  const buildingName = optText(v.buildingName, "buildingName");
  if (!buildingName.ok) return buildingName.error;

  return {
    address: v.address,
    city: city.value ?? "",
    price: v.price,
    coords: v.coords,
    type: v.type as ListingType,
    kind: v.kind as PropertyKind,
    ...counts,
    ...(photos !== undefined ? { photos } : {}),
    ...(photo !== undefined ? { photo } : {}),
    ...(owner.value !== undefined ? { owner: owner.value } : {}),
    ...(buildingName.value !== undefined ? { buildingName: buildingName.value } : {}),
  };
}

// ---------------------------------------------------------------------------
// Designs
// ---------------------------------------------------------------------------

export type DesignInput = Omit<Design, "id">;

function hasBlocks(state: Obj): boolean {
  const floors = state.floors;
  if (Array.isArray(floors)) {
    return floors.some(
      (f) => isObj(f) && Array.isArray(f.blocks) && (f.blocks as DesignBlock[]).length > 0,
    );
  }
  return Array.isArray(state.blocks) && state.blocks.length > 0;
}

/**
 * Validate a POST/PUT /api/designs body. Guards `design.state` being missing
 * (previously a TypeError → 500) and caps the serialized design at 1 MB.
 */
export function validateDesign(v: unknown, safeImageUrl: ImageUrlCheck): DesignInput | string {
  if (!isObj(v)) return "body must be an object";

  if (!isLngLat(v.plotCenter)) return "plotCenter must be [lng, lat] within range";
  if (!isFiniteNumber(v.plotW) || v.plotW <= 0) return "plotW must be a number > 0";
  if (!isFiniteNumber(v.plotD) || v.plotD <= 0) return "plotD must be a number > 0";

  let name = "My home";
  if (v.name !== undefined && v.name !== null && v.name !== "") {
    if (typeof v.name !== "string") return "name must be a string";
    if (v.name.length > MAX_DESIGN_NAME) return `name too long (max ${MAX_DESIGN_NAME})`;
    if (hasNul(v.name)) return "name contains invalid characters";
    name = v.name;
  }

  const design = v.design;
  if (!isObj(design) || design.v !== 3) return "design.v must be 3";
  if (!isObj(design.state)) return "design.state required";
  if (!hasBlocks(design.state)) return "design must contain at least one block";
  if (JSON.stringify(design).length > MAX_DESIGN_BYTES) {
    return "design too large (max 1 MB)";
  }

  let snapshot: string | undefined;
  if (v.snapshot !== undefined && v.snapshot !== null && v.snapshot !== "") {
    if (typeof v.snapshot !== "string" || !safeImageUrl(v.snapshot)) {
      return "invalid snapshot url";
    }
    snapshot = v.snapshot;
  }

  let meta: DesignMeta | undefined;
  if (v.meta !== undefined && v.meta !== null) {
    if (!isObj(v.meta)) return "meta must be an object";
    meta = v.meta as DesignMeta;
  }

  return {
    name,
    plotCenter: v.plotCenter,
    plotW: v.plotW,
    plotD: v.plotD,
    design: design as unknown as DesignStateV3,
    ...(snapshot !== undefined ? { snapshot } : {}),
    ...(meta !== undefined ? { meta } : {}),
  };
}
