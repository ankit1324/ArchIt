import { auth } from "@clerk/nextjs/server";
import { checkRateLimit, ipKey, rateLimitedResponse } from "@/lib/rate-limit";
import { getPublishedDesign } from "@/lib/showcase-db";

// One published design including its v3 JSON, for the read-only viewer.
// Public. Private designs are a 404 for everyone, the owner included (they
// use /designer).
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  // bound anonymous scraping per IP (signed-in users per id)
  const { userId } = await auth();
  if (!(await checkRateLimit(ipKey(request, "showcase-read", userId), 120, 60_000))) {
    return rateLimitedResponse();
  }
  const { id } = await params;
  try {
    const design = await getPublishedDesign(id, userId ?? null, true);
    if (!design) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json(design);
  } catch (e) {
    console.error(`GET /api/showcase/${id} failed:`, e instanceof Error ? e.message : e);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
}
