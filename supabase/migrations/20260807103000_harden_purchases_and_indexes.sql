-- Hardening pass on the purchases ledger + the indexes the query code actually
-- needs. Purely additive: no DML, no column drops, no data loss.

-- ---------------------------------------------------------------------------
-- 1. featured_property was the only paid purpose without a uniqueness guard,
--    so a user could be charged twice for boosting the same listing and both
--    rows would persist. The other two purposes already have this.
--    Also lets lib/purchases.ts tell "same payment retried" (payment_id
--    conflict = idempotent success) apart from "second distinct charge for
--    something already owned" (this index = refund owed, logged loudly).
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS purchases_featured_ref
  ON purchases (user_id, purpose, ref) WHERE purpose = 'featured_property';

-- Same guard for per-template unlocks (ref = template key, e.g. 'off_law'):
-- pay once per template, and a second charge for one already owned is caught
-- as a duplicate rather than silently stored.
CREATE UNIQUE INDEX IF NOT EXISTS purchases_template_ref
  ON purchases (user_id, purpose, ref) WHERE purpose = 'template_unlock';

-- ---------------------------------------------------------------------------
-- 2. purpose is written from Razorpay order notes. The app validates it against
--    the fee table now, but the DB is the layer that cannot be bypassed.
--
--    The allowed set is the three current FeePurpose values in lib/fees.ts PLUS
--    'add_property' — the retired ₹100 listing fee (commit 5e9127d). Two real
--    captured payments from Jul 2026 still carry it. They are financial records
--    and are kept: the constraint exists to stop bad NEW writes, not to rewrite
--    settled history. No new 'add_property' row can be created, because
--    recordPurchaseFromOrder rejects any purpose absent from FEES.
--
--    Add retired purposes here rather than deleting the rows they belong to.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'purchases_purpose_chk'
  ) THEN
    ALTER TABLE purchases
      ADD CONSTRAINT purchases_purpose_chk CHECK (
        purpose IN (
          'contact_owner', 'featured_property', 'builder_unlock',
          'template_unlock',
          'add_property' -- retired, historical rows only
        )
      ) NOT VALID;
    -- VALIDATE takes only a SHARE UPDATE EXCLUSIVE lock. It passes because the
    -- retired purpose is included above; if a future purpose is retired and
    -- omitted here, this is where the migration will (correctly) refuse.
    ALTER TABLE purchases VALIDATE CONSTRAINT purchases_purpose_chk;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. Indexes for the filters/sorts the code already issues.
--    (No CONCURRENTLY: supabase migrations run inside a transaction. These
--    tables are small today; revisit if they grow before this is applied.)
-- ---------------------------------------------------------------------------

-- GET /api/designs: .eq("user_id", …).order("created_at") — currently a seq
-- scan across every user's designs, each row carrying TOASTed design JSONB.
CREATE INDEX IF NOT EXISTS designs_user_created_idx
  ON designs (user_id, created_at DESC);

-- GET /api/properties: .order("created_at") on every page load.
CREATE INDEX IF NOT EXISTS properties_created_idx
  ON properties (created_at DESC);

-- Owner lookups ("my listings"), and auditing rows with no lister.
CREATE INDEX IF NOT EXISTS properties_user_idx
  ON properties (user_id) WHERE user_id IS NOT NULL;

-- Reconciling a Razorpay settlement report against the ledger.
CREATE INDEX IF NOT EXISTS purchases_order_idx
  ON purchases (order_id);
