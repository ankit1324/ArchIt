import "server-only";
import { cache } from "react";
import { db, PUBLIC_COLUMNS, rowToListing, type PublicPropertyRow } from "./db";
import { onlyLive } from "./moderation";
import type { Listing } from "./types";

// The one place that decides which listings are public: the crawlable
// /property/[id] pages and the sitemap both read through here. Selects
// PUBLIC_COLUMNS only — `owner` (paywalled) and `user_id` never leave the
// server on these routes. Moderation: both queries go through onlyLive, so a
// pending or rejected listing has no public page and no sitemap entry.

/** Sitemap cap: one sitemap file holds at most 50,000 URLs. */
const SITEMAP_LIMIT = 45_000;

const ID_RE = /^[A-Za-z0-9-]{1,64}$/;

export type PublicListing = Listing & { createdAt?: string };

/** A single live listing, or null. Cached per request (metadata + page). */
export const getPublicListing = cache(async (id: string): Promise<PublicListing | null> => {
  if (!ID_RE.test(id)) return null;
  const base = db.from("properties").select(`${PUBLIC_COLUMNS}, created_at`);
  const { data, error } = await onlyLive<typeof base>(base)
    .eq("id", id)
    .maybeSingle<PublicPropertyRow & { created_at: string }>();
  if (error) throw new Error(`public listing ${id}: ${error.message}`);
  if (!data) return null;
  return { ...rowToListing(data), createdAt: data.created_at };
});

/** Ids + timestamps of every live listing, newest first, for the sitemap. */
export async function listPublicListingIds(): Promise<Array<{ id: string; createdAt: string }>> {
  const base = db.from("properties").select("id, created_at");
  const { data, error } = await onlyLive<typeof base>(base)
    .order("created_at", { ascending: false })
    .limit(SITEMAP_LIMIT);
  if (error) throw new Error(`public listing ids: ${error.message}`);
  return data.map((r) => ({ id: r.id as string, createdAt: r.created_at as string }));
}

// ---------------------------------------------------------------------------
// "More in <city>" on /property/[id]

/** How many sibling listings the property page shows. */
export const MORE_IN_CITY_LIMIT = 4;

/**
 * The city part of a stored `city` value. Listings store the geocoder's
 * locality, often with a PIN code ("Chandigarh, 160015"), so two listings in
 * the same city rarely share the exact string; compare on the name instead.
 */
export function cityName(city: string | null | undefined): string {
  return (city ?? "").split(",")[0].trim();
}

/** Escape LIKE/ILIKE wildcards so a city name only ever matches literally. */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Up to `limit` other live listings in the same city as `l`, featured first,
 * then newest. Never throws: it is a nice-to-have block, so a failed query
 * must not take the listing page down with it (logs and returns []).
 */
export async function listMoreInCity(
  l: Pick<Listing, "id" | "city">,
  limit = MORE_IN_CITY_LIMIT,
): Promise<PublicListing[]> {
  const name = cityName(l.city);
  if (!name) return [];
  try {
    // ILIKE "<name>%" narrows in SQL (covers every PIN-code suffix); the exact
    // name check below drops prefixes of other cities ("Mohali" vs "Mohalia").
    const base = db.from("properties").select(PUBLIC_COLUMNS);
    const { data, error } = await onlyLive<typeof base>(base)
      .ilike("city", `${escapeLike(name)}%`)
      .neq("id", l.id)
      .order("featured", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(limit * 3);
    if (error) throw new Error(error.message);
    const want = name.toLowerCase();
    return ((data ?? []) as unknown as PublicPropertyRow[])
      .filter((r) => r.id !== l.id && cityName(r.city).toLowerCase() === want)
      .slice(0, limit)
      .map(rowToListing);
  } catch (e) {
    console.error(`more in city for ${l.id}:`, (e as Error).message);
    return [];
  }
}
