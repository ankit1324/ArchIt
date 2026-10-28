import { db } from "@/lib/db";
import { isCronRequest } from "@/lib/cron-auth";
import { pruneRateLimits } from "@/lib/rate-limit";

export async function GET(request: Request) {
  if (!isCronRequest(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const { data, error } = await db.from("properties").select("id").limit(1);
  if (error) {
    console.error("Keepalive ping failed:", error.message);
    return Response.json({ error: "db unreachable" }, { status: 503 });
  }
  // Housekeeping rides on the daily cron. Best effort: a failed prune is
  // logged and retried tomorrow, never a failed keepalive.
  try {
    const { error: pruneError } = await pruneRateLimits();
    if (pruneError) console.error("Keepalive: rate_limits prune failed:", pruneError);
  } catch (e) {
    console.error("Keepalive: rate_limits prune failed:", e instanceof Error ? e.message : e);
  }
  return Response.json({ ok: true, count: data?.length ?? 0, ts: Date.now() });
}
