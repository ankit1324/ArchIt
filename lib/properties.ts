import "server-only";
import { db, listingForViewer, OWNED_COLUMNS, type PropertyRow } from "./db";
import { PAGE_LIMIT, type BBox } from "./listing-query";
import { onlyVisible } from "./moderation";
import type { Listing } from "./types";

export interface ListingPage {
  listings: Listing[];
  /** pass back as `cursor` for the next page; null on the last page */
  nextCursor: string | null;
}

/**
 * One page of the public listing set, optionally limited to a map viewport.
 * Shared by GET /api/properties and the /find server render so the first page
 * ships with the HTML. Owner contact is paywalled: OWNED_COLUMNS never
 * includes it, and the raw lister user_id is reduced to a `mine` flag.
 * Moderation: only live listings, plus the viewer's own pending/rejected ones.
 */
export async function listProperties({
  userId,
  bbox = null,
  cursor = null,
  limit = PAGE_LIMIT,
}: {
  userId: string | null;
  bbox?: BBox | null;
  cursor?: string | null;
  limit?: number;
}): Promise<ListingPage> {
  // keyset on id: stable under concurrent inserts/deletes, unlike offsets
  const base = db.from("properties").select(OWNED_COLUMNS);
  let q = onlyVisible<typeof base>(base, userId).order("id").limit(limit);
  if (cursor) q = q.gt("id", cursor);
  if (bbox) {
    const [w, s, e, n] = bbox;
    q = q.gte("lng", w).lte("lng", e).gte("lat", s).lte("lat", n);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = data as unknown as PropertyRow[];
  return {
    listings: rows.map((r) => listingForViewer(r, userId)),
    nextCursor: rows.length === limit ? rows[rows.length - 1].id : null,
  };
}
