CREATE TABLE IF NOT EXISTS designs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL DEFAULT 'My home',
  plot_lng DOUBLE PRECISION NOT NULL,
  plot_lat DOUBLE PRECISION NOT NULL,
  plot_w DOUBLE PRECISION NOT NULL,
  plot_d DOUBLE PRECISION NOT NULL,
  design JSONB NOT NULL,
  snapshot TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- All reads/writes go through Next.js API routes using the secret key,
-- which bypasses RLS. Enabling RLS with no policies blocks direct
-- anon/publishable-key access to this table.
ALTER TABLE designs ENABLE ROW LEVEL SECURITY;
