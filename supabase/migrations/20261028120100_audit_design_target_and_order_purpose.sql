-- Two CHECK constraints. No DML: existing rows are never rewritten.

-- ---------------------------------------------------------------------------
-- 1. admin_audit_log.target_type gains 'design'.
--
--    POST /api/admin/designs/[id] (unpublish a showcase design) had to log
--    against the author as target_type 'user' because the inline CHECK from
--    20261024120000_admin_tools.sql (Postgres named it
--    admin_audit_log_target_type_check) had no 'design'. The new set is a
--    superset of the old one, so validating existing rows cannot fail.
--    Drop + re-add keeps this replayable.
-- ---------------------------------------------------------------------------
ALTER TABLE admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_target_type_check;
ALTER TABLE admin_audit_log
  ADD CONSTRAINT admin_audit_log_target_type_check
  CHECK (target_type IN ('listing', 'report', 'user', 'order', 'design')) NOT VALID;
ALTER TABLE admin_audit_log VALIDATE CONSTRAINT admin_audit_log_target_type_check;

-- ---------------------------------------------------------------------------
-- 2. payment_orders.purpose: only the four FeePurpose values in lib/fees.ts.
--
--    create-order writes it from the fee table, and the reconciler records a
--    purchase from it, so a bad value here would become a bad ledger row.
--    Same shape as purchases_purpose_chk, without 'add_property': that fee was
--    retired before payment_orders existed, so no order can carry it.
--
--    NOT VALID enforces the rule on every new write at once. Validating old
--    rows is best-effort, as for purchases_ref_matches_purpose_chk: if one
--    violates it the migration still applies and the rows are reported for
--    manual review instead of being rewritten here.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'payment_orders_purpose_chk'
  ) THEN
    ALTER TABLE payment_orders
      ADD CONSTRAINT payment_orders_purpose_chk CHECK (
        purpose IN ('contact_owner', 'featured_property', 'builder_unlock', 'template_unlock')
      ) NOT VALID;
    BEGIN
      ALTER TABLE payment_orders VALIDATE CONSTRAINT payment_orders_purpose_chk;
    EXCEPTION WHEN check_violation THEN
      RAISE WARNING 'payment_orders_purpose_chk left NOT VALID: historical rows violate it. Find them with: SELECT * FROM payment_orders WHERE purpose NOT IN (''contact_owner'', ''featured_property'', ''builder_unlock'', ''template_unlock'');';
    END;
  END IF;
END $$;
