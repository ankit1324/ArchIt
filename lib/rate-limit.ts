import "server-only";
import { db } from "./db";

/**
 * Rate limiter backed by a shared Postgres counter (see the rate_limits table
 * and rate_limit_hit() in supabase/migrations), so the limit is enforced
 * globally across serverless instances rather than per-instance.
 *
 * If the DB call fails, we fall back to the in-memory limiter below so a
 * transient database problem degrades to best-effort throttling rather than
 * either failing every request (fail-closed) or removing the limit entirely.
 */

// ---------------------------------------------------------------------------
// In-memory fallback: sliding window, per-instance. Only used when the shared
// counter is unreachable.
// ---------------------------------------------------------------------------
type Bucket = { ts: number[] };

const buckets = new Map<string, Bucket>();
let sweepTimer: ReturnType<typeof setInterval> | undefined;

const SWEEP_MS = 60_000;

function ensureSweeper() {
  if (!sweepTimer) {
    sweepTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, b] of buckets) {
        b.ts = b.ts.filter((t) => now - t < SWEEP_MS * 2);
        if (b.ts.length === 0) buckets.delete(key);
      }
    }, SWEEP_MS);
    if (typeof sweepTimer.unref === "function") sweepTimer.unref();
  }
}

function checkRateLimitLocal(key: string, limit: number, windowMs: number): boolean {
  ensureSweeper();
  const now = Date.now();
  const b = buckets.get(key) ?? { ts: [] };
  b.ts = b.ts.filter((t) => now - t < windowMs);
  if (b.ts.length >= limit) {
    buckets.set(key, b);
    return false;
  }
  b.ts.push(now);
  buckets.set(key, b);
  return true;
}

// ---------------------------------------------------------------------------
// Shared, cross-instance limiter.
// ---------------------------------------------------------------------------
/** True when within the limit (records the hit); false when rate-limited. */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<boolean> {
  try {
    const { data, error } = await db.rpc("rate_limit_hit", {
      p_key: key,
      p_limit: limit,
      p_window_ms: windowMs,
    });
    if (error) throw new Error(error.message);
    // rate_limit_hit returns a boolean: true = allowed.
    return data !== false;
  } catch (e) {
    console.error(
      "rate limiter DB call failed, falling back to in-memory:",
      e instanceof Error ? e.message : e,
    );
    return checkRateLimitLocal(key, limit, windowMs);
  }
}

export function ipKey(request: Request, scope: string, userId?: string | null): string {
  const xf = request.headers.get("x-forwarded-for");
  const ip = (xf?.split(",")[0] ?? "anonymous").trim();
  return `${scope}:${userId ?? ip}`;
}

export function rateLimitedResponse(): Response {
  return Response.json({ error: "too many requests" }, { status: 429 });
}
