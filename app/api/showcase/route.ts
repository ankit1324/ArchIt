import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import type { DesignRow } from "@/lib/db";
import { checkRateLimit, ipKey, rateLimitedResponse } from "@/lib/rate-limit";
import { SHOWCASE_COLUMNS, parseShowcaseQuery, toPublishedDesign } from "@/lib/showcase";

// Published designs from every user, newest first. Everything leaves through
// the PublishedDesign projection (no user_id, no budget/notes, no design JSON).
export async function GET(request: Request) {
  // public endpoint: bound anonymous scraping per IP (signed-in users per id)
  const { userId } = await auth();
  if (!(await checkRateLimit(ipKey(request, "showcase-list", userId), 120, 60_000))) {
    return rateLimitedResponse();
  }
  const { limit, before, located } = parseShowcaseQuery(new URL(request.url).searchParams);
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
  if (error) {
    console.error("GET /api/showcase failed:", error.message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
  // the list select omits the heavy `design` column; toPublishedDesign only
  // reads it when includeDesign is set
  const rows = data as unknown as DesignRow[];
  return Response.json(rows.map((r) => toPublishedDesign(r, userId ?? null)));
}
