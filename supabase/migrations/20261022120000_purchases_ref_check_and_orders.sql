-- Ledger integrity + the order log the reconciler works from.
-- Additive only: no DML on existing rows, no drops.

-- ---------------------------------------------------------------------------
-- 1. Tie `ref` to `purpose` in the schema, not just in lib/purchase-rules.ts.
--
--    The per-ref unique indexes (purchases_contact_ref / _featured_ref /
--    _template_ref) treat NULLs as distinct, so a NULL ref would let the same
--    user buy the same entitlement any number of times without tripping them.
--    Requiring a non-empty ref for those purposes closes that hole; requiring
--    NULL for builder_unlock keeps its one-per-user index meaningful.
--    'add_property' is the retired fee (see purchases_purpose_chk) and is left
--    unconstrained — its historical rows are settled records.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'purchases_ref_matches_purpose_chk'
  ) THEN
    ALTER TABLE purchases
      ADD CONSTRAINT purchases_ref_matches_purpose_chk CHECK (
        CASE purpose
          WHEN 'builder_unlock' THEN ref IS NULL
          WHEN 'add_property' THEN true
          ELSE ref IS NOT NULL AND ref <> ''
        END
      ) NOT VALID;
    -- NOT VALID already enforces the rule on every new write. Validating the
    -- old rows is best-effort: if a historical row breaks it, the migration
    -- still applies and the offending rows are reported for manual review
    -- instead of being rewritten here.
    BEGIN
      ALTER TABLE purchases VALIDATE CONSTRAINT purchases_ref_matches_purpose_chk;
    EXCEPTION WHEN check_violation THEN
      RAISE WARNING 'purchases_ref_matches_purpose_chk left NOT VALID: historical rows violate it. Find them with: SELECT * FROM purchases WHERE NOT (CASE purpose WHEN ''builder_unlock'' THEN ref IS NULL WHEN ''add_property'' THEN true ELSE ref IS NOT NULL AND ref <> '''' END);';
    END;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. payment_orders: every checkout session create-order opens.
--
--    The ledger only holds payments that were recorded. A payment that the
--    gateway settled but neither verify-payment nor the webhook managed to
--    record (tab closed + webhook dropped, a deploy mid-request, a DB blip
--    past the retry) leaves no trace on our side — the user paid and got
--    nothing. This log is what /api/cron/reconcile walks to find them.
--
--    status: open → recorded | refund_due | failed | expired | cancelled
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_orders (
  order_id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  purpose TEXT NOT NULL,
  ref TEXT,
  amount INTEGER NOT NULL, -- paise, as ordered
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'recorded', 'refund_due', 'failed', 'expired', 'cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  checked_at TIMESTAMPTZ
);

-- The reconciler's only query: open orders, oldest first.
CREATE INDEX IF NOT EXISTS payment_orders_open_idx
  ON payment_orders (created_at) WHERE status = 'open';

-- Server routes use the secret key (bypasses RLS); block anon access.
ALTER TABLE payment_orders ENABLE ROW LEVEL SECURITY;
