-- Durable, cross-instance rate limiting. The app's in-memory limiter
-- (lib/rate-limit.ts) only bounds a single serverless instance, so on a
-- multi-instance platform the effective limit was limit x instances. This backs
-- the limiter with a shared table + an atomic fixed-window counter so the limit
-- is global. Purely additive: new table + function, no changes to existing data.

-- ---------------------------------------------------------------------------
-- 1. Counter table. One row per (scope:key) bucket, holding the current
--    fixed-window count and when that window opened. Rows are self-healing:
--    a hit whose window has expired resets the row in place, so stale buckets
--    never need a sweeper (an occasional janitor can prune untouched rows).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rate_limits (
  key          text        PRIMARY KEY,
  count        integer     NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now()
);

-- Only the server (service key, which bypasses RLS) ever touches this table.
-- Enable RLS with no policies so anon/authenticated roles get zero access,
-- matching the "never reachable from the client" contract of lib/db.ts.
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 2. Atomic hit. A single INSERT ... ON CONFLICT does the whole read-modify-
--    write under the row lock, so concurrent requests across instances cannot
--    race past the limit. Returns TRUE when the hit is allowed (count within
--    limit), FALSE when it should be rejected (429).
--
--    Fixed window (not sliding): simpler and race-free in one statement. A
--    burst can straddle a window boundary and briefly allow up to ~2x the
--    limit — acceptable for abuse-bounding; tighten to sliding only if needed.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION rate_limit_hit(
  p_key       text,
  p_limit     integer,
  p_window_ms integer
) RETURNS boolean
LANGUAGE plpgsql
AS $$
DECLARE
  now_ts   timestamptz := now();
  win      interval    := make_interval(secs => p_window_ms / 1000.0);
  new_count integer;
BEGIN
  INSERT INTO rate_limits AS r (key, count, window_start)
  VALUES (p_key, 1, now_ts)
  ON CONFLICT (key) DO UPDATE
    SET count = CASE
          WHEN r.window_start < now_ts - win THEN 1        -- window expired: reset
          ELSE r.count + 1                                 -- same window: increment
        END,
        window_start = CASE
          WHEN r.window_start < now_ts - win THEN now_ts
          ELSE r.window_start
        END
  RETURNING count INTO new_count;

  RETURN new_count <= p_limit;
END;
$$;
