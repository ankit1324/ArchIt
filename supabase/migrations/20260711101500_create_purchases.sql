-- Ledger of every verified payment (builder unlock, listing fee, contact
-- unlock). payment_id unique = idempotent verify retries.
CREATE TABLE IF NOT EXISTS purchases (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id TEXT NOT NULL,
  purpose TEXT NOT NULL,
  ref TEXT, -- what was paid for, e.g. property id for contact_owner
  order_id TEXT NOT NULL,
  payment_id TEXT NOT NULL UNIQUE,
  amount INTEGER, -- paise, as charged
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- builder unlock is one-time per user
CREATE UNIQUE INDEX IF NOT EXISTS purchases_one_time
  ON purchases (user_id, purpose) WHERE purpose = 'builder_unlock';

-- contact unlock persists per listing — pay once per property
CREATE UNIQUE INDEX IF NOT EXISTS purchases_contact_ref
  ON purchases (user_id, purpose, ref) WHERE purpose = 'contact_owner';

CREATE INDEX IF NOT EXISTS purchases_user_idx ON purchases (user_id, purpose);

-- All reads/writes go through Next.js API routes using the secret key,
-- which bypasses RLS. Enabling RLS with no policies blocks direct
-- anon/publishable-key access to this table.
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
