import { auth, clerkClient } from "@clerk/nextjs/server";
import { db, rowToDesign } from "@/lib/db";
import { checkRateLimit, ipKey, rateLimitedResponse } from "@/lib/rate-limit";
import { parsePublishBody } from "@/lib/showcase";

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

// Owner-only: the user_id filter makes other users' ids a 404.
// Publishing sets published_at = now() and author_name, and moves the pin when
// a location is given. Unpublishing clears both but keeps the location/place
// so re-publishing can pre-fill them.
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

  const update: Record<string, string | number | null> = parsed.published
    ? { published_at: new Date().toISOString(), author_name: await authorName(userId) }
    : { published_at: null, author_name: null };
  if (parsed.location) {
    update.plot_lng = parsed.location.lng;
    update.plot_lat = parsed.location.lat;
    update.place = parsed.location.place;
  }

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
