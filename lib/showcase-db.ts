import "server-only";
import { cache } from "react";
import { db, type DesignRow } from "./db";
import { isDesignId, SHOWCASE_COLUMNS, toPublishedDesign } from "./showcase";
import type { PublishedDesign } from "./types";

// The one place that reads published designs for other users: the public
// /api/showcase routes, the /showcase pages and the sitemap. Every row leaves
// through toPublishedDesign (no user_id, no budget/notes). Private designs
// (published_at NULL) are never selected here.

/** Sitemap cap: one sitemap file holds at most 50,000 URLs. */
const SITEMAP_LIMIT = 5_000;

/** Published designs, newest first (list projection, no design JSON). */
export async function listPublishedDesigns({
  viewerId,
  limit,
  before = null,
  located = false,
}: {
  viewerId: string | null;
  limit: number;
  before?: string | null;
  located?: boolean;
}): Promise<PublishedDesign[]> {
  let query = db
    .from("designs")
    .select(SHOWCASE_COLUMNS)
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (before) query = query.lt("published_at", before);
  // located filter runs in SQL so `limit` counts only pinnable designs;
  // same rule as hasLocation (not both zero)
  if (located) query = query.or("plot_lng.neq.0,plot_lat.neq.0");
  const { data, error } = await query;
  if (error) throw new Error(`published designs: ${error.message}`);
  // the list select omits the heavy `design` column; toPublishedDesign only
  // reads it when includeDesign is set
  return (data as unknown as DesignRow[]).map((r) => toPublishedDesign(r, viewerId));
}

/**
 * One published design, or null when it is missing or private (even for its
 * owner — they use /designer). Cached per request (metadata + page).
 */
export const getPublishedDesign = cache(
  async (
    id: string,
    viewerId: string | null,
    includeDesign = false,
  ): Promise<PublishedDesign | null> => {
    if (!isDesignId(id)) return null;
    const { data, error } = await db
      .from("designs")
      .select(includeDesign ? `${SHOWCASE_COLUMNS}, design` : SHOWCASE_COLUMNS)
      .eq("id", id)
      .not("published_at", "is", null)
      .maybeSingle<DesignRow>();
    if (error) throw new Error(`published design ${id}: ${error.message}`);
    if (!data) return null;
    return toPublishedDesign(data, viewerId, { includeDesign });
  },
);

/** Ids + publish times of published designs, newest first, for the sitemap. */
export async function listPublishedDesignIds(): Promise<Array<{ id: string; publishedAt: string }>> {
  const { data, error } = await db
    .from("designs")
    .select("id, published_at")
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(SITEMAP_LIMIT);
  if (error) throw new Error(`published design ids: ${error.message}`);
  return data.map((r) => ({ id: r.id as string, publishedAt: r.published_at as string }));
}
