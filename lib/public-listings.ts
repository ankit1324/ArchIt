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
