import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import type { DesignRow } from "@/lib/db";
import {
  SHOWCASE_COLUMNS,
  hasLocation,
  parseShowcaseQuery,
  toPublishedDesign,
} from "@/lib/showcase";

// Published designs from every user, newest first. Everything leaves through
// the PublishedDesign projection (no user_id, no budget/notes, no design JSON).
export async function GET(request: Request) {
  const { userId } = await auth();
  const { limit, before, located } = parseShowcaseQuery(new URL(request.url).searchParams);
  let query = db
    .from("designs")
    .select(SHOWCASE_COLUMNS)
    .not("published_at", "is", null)
    .order("published_at", { ascending: false })
    .limit(limit);
  if (before) query = query.lt("published_at", before);
  const { data, error } = await query;
  if (error) {
    console.error("GET /api/showcase failed:", error.message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
  // the list select omits the heavy `design` column; toPublishedDesign only
  // reads it when includeDesign is set
  const rows = data as unknown as DesignRow[];
  return Response.json(
    rows
      .filter((r) => !located || hasLocation(r.plot_lng, r.plot_lat))
      .map((r) => toPublishedDesign(r, userId ?? null)),
  );
}
