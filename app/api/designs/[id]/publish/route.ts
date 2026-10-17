import { auth, clerkClient } from "@clerk/nextjs/server";
import { db, rowToDesign } from "@/lib/db";
import { checkRateLimit, ipKey, rateLimitedResponse } from "@/lib/rate-limit";
import { parsePublishBody, publishUpdate } from "@/lib/showcase";

/**
 * Display name stored on publish: first name, else username, else a generic
 * label — never the email. Stored rather than looked up per request so the
 * showcase stays one query.
 */
async function authorName(userId: string): Promise<string> {
  try {
    const user = await (await clerkClient()).users.getUser(userId);
    return user.firstName || user.username || "ArchIt user";
  } catch (e) {
    console.error(
      `author name lookup failed for ${userId}:`,
      e instanceof Error ? e.message : e,
    );
    return "ArchIt user";
  }
}

// Owner-only: the user_id filter makes other users' ids a 404, checked before
// any Clerk lookup. Publishing sets author_name, sets published_at only when
// the design is not already published (moving a pin keeps its date), and
// moves the pin when a location is given. Unpublishing clears both but keeps
// the location/place so re-publishing can pre-fill them. See publishUpdate.
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
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const parsed = parsePublishBody(body);
  if (!parsed.ok) return Response.json({ error: parsed.error }, { status: 400 });

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
    .maybeSingle();
  if (error) {
    console.error(`POST /api/designs/${id}/publish failed:`, error.message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
  if (!data) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(rowToDesign(data));
}
