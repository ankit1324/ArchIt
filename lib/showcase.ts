// Public projection and input parsing for the multi-user showcase.
// Pure (type-only imports) so `node --test` can import it directly.
import type { DesignRow } from "./db";
import type { PublishedDesign } from "./types";

const DEFAULT_LIMIT = 60;
const MAX_LIMIT = 200;
const MAX_PLACE = 120;

// Every column toPublishedDesign reads, minus the heavy `design` JSON (the
// single-design endpoint appends it). user_id and meta are read server-side
// for `mine` / `facing` and never copied into the projection.
export const SHOWCASE_COLUMNS =
  "id, user_id, name, plot_lng, plot_lat, plot_w, plot_d, snapshot, meta, published_at, author_name, place";

/** A design "has a location" unless its plot centre is exactly [0, 0]. */
export function hasLocation(lng: number, lat: number): boolean {
  return !(lng === 0 && lat === 0);
}

/**
 * Row → what other users may see. Only whitelisted fields are copied: never
 * user_id, and from meta only `facing` (budget/notes stay private).
 */
export function toPublishedDesign(
  row: DesignRow,
  viewerId: string | null,
  opts?: { includeDesign?: boolean },
): PublishedDesign {
  const p: PublishedDesign = {
    id: row.id,
    name: row.name,
    plotCenter: hasLocation(row.plot_lng, row.plot_lat) ? [row.plot_lng, row.plot_lat] : null,
    plotW: row.plot_w,
    plotD: row.plot_d,
    place: row.place ?? undefined,
    facing: row.meta?.facing,
    snapshot: row.snapshot ?? undefined,
    authorName: row.author_name || "ArchIt user",
    publishedAt: row.published_at ?? "",
    mine: !!viewerId && row.user_id === viewerId,
  };
  if (opts?.includeDesign) p.design = row.design;
  return p;
}

export function parseShowcaseQuery(params: URLSearchParams): {
  limit: number;
  before: string | null;
  located: boolean;
} {
  const n = Number.parseInt(params.get("limit") ?? "", 10);
  const limit = Number.isNaN(n) ? DEFAULT_LIMIT : Math.min(MAX_LIMIT, Math.max(1, n));
  const rawBefore = params.get("before");
  const before = rawBefore && !Number.isNaN(Date.parse(rawBefore)) ? rawBefore : null;
  return { limit, before, located: params.get("located") === "1" };
}

export type PublishBody =
  | {
      ok: true;
      published: boolean;
      location: { lng: number; lat: number; place: string | null } | null;
    }
  | { ok: false; error: string };

export function parsePublishBody(body: unknown): PublishBody {
  if (!body || typeof body !== "object") return { ok: false, error: "Invalid body" };
  const { published, location } = body as { published?: unknown; location?: unknown };
  if (typeof published !== "boolean") return { ok: false, error: "published must be a boolean" };
  if (location === undefined || location === null) return { ok: true, published, location: null };
  if (!published) return { ok: false, error: "location is only accepted when publishing" };
  if (typeof location !== "object") return { ok: false, error: "Invalid location" };

  const { lng, lat, place } = location as { lng?: unknown; lat?: unknown; place?: unknown };
  if (
    typeof lng !== "number" ||
    typeof lat !== "number" ||
    !Number.isFinite(lng) ||
    !Number.isFinite(lat) ||
    lng < -180 ||
    lng > 180 ||
    lat < -90 ||
    lat > 90 ||
    !hasLocation(lng, lat)
  ) {
    return { ok: false, error: "Invalid location" };
  }
  if (place !== undefined && place !== null && typeof place !== "string") {
    return { ok: false, error: "Invalid place" };
  }
  const trimmed = typeof place === "string" ? place.trim().slice(0, MAX_PLACE).trim() : "";
  return { ok: true, published, location: { lng, lat, place: trimmed || null } };
}
