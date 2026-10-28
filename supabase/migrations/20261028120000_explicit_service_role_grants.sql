-- Explicit grants for service_role, the only role the app uses (lib/db.ts
-- holds the secret key). Idempotent: GRANT on an existing privilege is a no-op.
--
-- Until 2026-10-30 Supabase granted every new table in `public` to anon,
-- authenticated and service_role automatically, which is why no earlier
-- migration has a GRANT. From that date new tables get no automatic grants, so
-- a table created without one answers every server query with 42501
-- (permission denied), even through the secret key.
--
-- Rule for every future migration: a CREATE TABLE in public needs its own
-- `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.<t> TO service_role;`
-- (and any new function an EXECUTE grant). tests/migrations.test.mjs fails
-- the build when one is missing.
--
-- Nothing is granted to anon or authenticated: the browser never talks to
-- Postgres, and RLS stays enabled with zero policies on every table.

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.properties,
  public.designs,
  public.purchases,
  public.payment_orders,
  public.rate_limits,
  public.listing_reports,
  public.admin_audit_log,
  public.contact_messages
TO service_role;

-- Identity columns (purchases, listing_reports, admin_audit_log,
-- contact_messages) draw from sequences; inserts need USAGE on them.
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- lib/rate-limit.ts calls this through db.rpc().
GRANT EXECUTE ON FUNCTION public.rate_limit_hit(text, integer, integer) TO service_role;
