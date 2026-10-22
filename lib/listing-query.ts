// Request-shape parsing for GET /api/properties, kept free of server-only
// imports so tests/listing-query.test.mjs can exercise it directly.

/** Rows per page; also the most the map is handed in one response. */
export const PAGE_LIMIT = 1000;

/** [west, south, east, north] in degrees */
export type BBox = [number, number, number, number];

/**
 * `bbox=w,s,e,n` → BBox, null when absent, or "invalid". A box crossing the
 * antimeridian (w > e) is rejected — nothing on this map is near it.
 */
export function parseBBox(raw: string | null): BBox | null | "invalid" {
  if (raw === null || raw === "") return null;
  const parts = raw.split(",").map((p) => Number(p.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return "invalid";
  const [w, s, e, n] = parts;
  if (w < -180 || e > 180 || s < -90 || n > 90 || w > e || s > n) return "invalid";
  return [w, s, e, n];
}

/** `limit` → 1..PAGE_LIMIT (default PAGE_LIMIT), or "invalid". */
export function parseLimit(raw: string | null): number | "invalid" {
  if (raw === null || raw === "") return PAGE_LIMIT;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) return "invalid";
  return Math.min(n, PAGE_LIMIT);
}

// ids are gen_random_uuid() text; this only has to keep the value inert
const ID = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Keyset cursor: the id of the last row of the previous page (rows are served
 * in id order, so a page never repeats or skips rows when listings are added
 * or removed between requests). null when absent, or "invalid".
 */
export function parseCursor(raw: string | null): string | null | "invalid" {
  if (raw === null || raw === "") return null;
  return ID.test(raw) ? raw : "invalid";
}
