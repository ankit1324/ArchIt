import { auth } from "@clerk/nextjs/server";
import { checkRateLimit, ipKey, rateLimitedResponse } from "@/lib/rate-limit";
import { parseShowcaseQuery } from "@/lib/showcase";
import { listPublishedDesigns } from "@/lib/showcase-db";

// Published designs from every user, newest first. Public (proxy.ts leaves
// /api/showcase open). Everything leaves through the PublishedDesign
// projection: no user_id, no budget/notes, no design JSON.
// ?limit (1..200, default 60), ?before=<publishedAt> cursor, ?located=1 for
// designs with a map pin only (/find).
export async function GET(request: Request) {
  // bound anonymous scraping per IP (signed-in users per id)
  const { userId } = await auth();
  if (!(await checkRateLimit(ipKey(request, "showcase-list", userId), 120, 60_000))) {
    return rateLimitedResponse();
  }
  const { limit, before, located } = parseShowcaseQuery(new URL(request.url).searchParams);
  try {
    const designs = await listPublishedDesigns({ viewerId: userId ?? null, limit, before, located });
    return Response.json(designs);
  } catch (e) {
    console.error("GET /api/showcase failed:", e instanceof Error ? e.message : e);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
}
