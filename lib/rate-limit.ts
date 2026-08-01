/**
 * Minimal in-memory sliding-window rate limiter. Per serverless instance only —
 * upgrade to Upstash/SQL when running more than one instance.
 */

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

/** True when within the limit (records the hit); false when rate-limited. */
export function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
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

export function ipKey(request: Request, scope: string, userId?: string | null): string {
  const xf = request.headers.get("x-forwarded-for");
  const ip = (xf?.split(",")[0] ?? "anonymous").trim();
  return `${scope}:${userId ?? ip}`;
}

export function rateLimitedResponse(): Response {
  return Response.json({ error: "too many requests" }, { status: 429 });
}
