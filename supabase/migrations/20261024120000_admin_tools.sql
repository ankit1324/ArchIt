-- Admin tools: an audit trail of every admin action, and a terminal status for
-- refunds an admin has paid back. Additive only.

-- ---------------------------------------------------------------------------
-- 1. admin_audit_log: who did what to which record, and why.
--    Written by lib/admin-audit.ts from every /api/admin/* mutation.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  admin_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('listing', 'report', 'user', 'order')),
  target_id TEXT NOT NULL,
  note TEXT CHECK (char_length(note) <= 500),
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- /admin/log: newest first; per-record history on the listing and user pages.
CREATE INDEX IF NOT EXISTS admin_audit_log_created_idx ON admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_log_target_idx
  ON admin_audit_log (target_type, target_id, created_at DESC);

-- Server routes use the secret key (bypasses RLS); block anon access.
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 2. payment_orders.status gains 'refunded': set from /admin once a
--    refund_due payment has been paid back in the gateway.
-- ---------------------------------------------------------------------------
ALTER TABLE payment_orders DROP CONSTRAINT IF EXISTS payment_orders_status_check;
ALTER TABLE payment_orders
  ADD CONSTRAINT payment_orders_status_check CHECK (
    status IN ('open', 'recorded', 'refund_due', 'refunded', 'failed', 'expired', 'cancelled')
  );

-- /admin/users: listing counts per lister.
CREATE INDEX IF NOT EXISTS properties_user_created_idx
  ON properties (user_id, created_at DESC) WHERE user_id IS NOT NULL;
