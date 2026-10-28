-- Indexes shaped to the hot queries as the code issues them today. Additive
-- apart from dropping one redundant index. No CONCURRENTLY: Supabase runs each
-- migration inside a transaction.

-- ---------------------------------------------------------------------------
-- 1. The public listing page (lib/properties.ts listProperties, anonymous
--    viewers via onlyVisible): WHERE status = 'live' [AND id > cursor]
--    [AND lng/lat BETWEEN bbox] ORDER BY id LIMIT n.
--    id leads so the keyset cursor and the sort are one ordered range scan
--    that stops at LIMIT; lng/lat as trailing keys let the bbox be checked
--    inside the index, so rows outside the viewport cost no heap fetch.
--    (A signed-in viewer's own non-live rows come from
--    properties_user_created_idx.)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS properties_live_id_lng_lat_idx
  ON properties (id, lng, lat)
  WHERE status = 'live';

-- ---------------------------------------------------------------------------
-- 2. "More in <city>" (lib/public-listings.ts listMoreInCity):
--    status = 'live' AND city ILIKE '<name>%'. A btree cannot serve a
--    case-insensitive prefix; a trigram GIN index can (for prefixes of three
--    or more characters, which every real city name is).
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS properties_live_city_trgm_idx
  ON properties USING gin (city extensions.gin_trgm_ops)
  WHERE status = 'live';

-- ---------------------------------------------------------------------------
-- 3. The reconciler (app/api/cron/reconcile/route.ts listOpenOrders):
--    status = 'open' AND created_at in a window
--    ORDER BY checked_at NULLS FIRST, created_at LIMIT n.
--    payment_orders_open_idx (created_at) cannot give that order, so every
--    run sorted the whole open set.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS payment_orders_open_checked_idx
  ON payment_orders (checked_at NULLS FIRST, created_at)
  WHERE status = 'open';

-- ---------------------------------------------------------------------------
-- 4. properties_user_idx (user_id) WHERE user_id IS NOT NULL is a prefix of
--    properties_user_created_idx (user_id, created_at DESC) with the same
--    predicate (20261024120000_admin_tools.sql), so it only costs writes.
-- ---------------------------------------------------------------------------
DROP INDEX IF EXISTS properties_user_idx;
