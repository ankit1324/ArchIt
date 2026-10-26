import { auth, clerkClient } from "@clerk/nextjs/server";
import { db, rowToDesign, type DesignRow } from "@/lib/db";
import { checkRateLimit, ipKey, rateLimitedResponse } from "@/lib/rate-limit";
import { parseJsonBody } from "@/lib/request";
import { isDesignId, parsePublishBody, publishUpdate, type PublishBody } from "@/lib/showcase";

/**
 * Display name stored on publish: first name, else username, else a generic
 * label — never the email. Stored rather than looked up per request so the
 * showcase stays one query.
 */
async function authorName(userId: string): Promise<string> {
  try {
    const user = await (await clerkClient()).users.getUser(userId);
    return (user.firstName || user.username || "ArchIt user").slice(0, 60);
  } catch (e) {
    console.error(`author name lookup failed for ${userId}:`, e instanceof Error ? e.message : e);
    return "ArchIt user";
  }
}

/** parsePublishBody in the `T | string` shape parseJsonBody expects */
function validatePublish(v: unknown): Extract<PublishBody, { ok: true }> | string {
  const parsed = parsePublishBody(v);
  return parsed.ok ? parsed : parsed.error;
}

// Owner-only: the user_id filter makes other users' ids a 404, checked before
// any Clerk lookup. Body `{ published: boolean, location?: { lng, lat, place? } }`.
// Publishing sets author_name, sets published_at only when the design is not
// already published (moving a pin keeps its date), and moves the pin when a
// location is given. Unpublishing clears both but keeps the location/place so
// re-publishing can pre-fill them. See publishUpdate in lib/showcase.ts.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!(await checkRateLimit(ipKey(request, "designs-publish", userId), 20, 60_000))) {
    return rateLimitedResponse();
  }
  const { id } = await params;
  if (!isDesignId(id)) return Response.json({ error: "not found" }, { status: 404 });
  // a tiny body: cap it well below the default
  const parsed = await parseJsonBody(request, validatePublish, { maxBytes: 4 * 1024 });
  if (parsed instanceof Response) return parsed;

  const { data: current, error: readError } = await db
    .from("designs")
    .select("published_at")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle<{ published_at: string | null }>();
  if (readError) {
    console.error(`POST /api/designs/${id}/publish read failed:`, readError.message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
  if (!current) return Response.json({ error: "not found" }, { status: 404 });

  const update = publishUpdate(
    parsed,
    current.published_at,
    parsed.published ? await authorName(userId) : null,
    new Date().toISOString(),
  );

  const { data, error } = await db
    .from("designs")
    .update(update)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .maybeSingle<DesignRow>();
  if (error) {
    console.error(`POST /api/designs/${id}/publish failed:`, error.message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
  if (!data) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(rowToDesign(data));
}
