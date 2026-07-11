CREATE TABLE IF NOT EXISTS properties (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  building_name TEXT,
  owner TEXT,
  address TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT '',
  price NUMERIC NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('sale', 'rent')),
  kind TEXT NOT NULL,
  beds INT NOT NULL DEFAULT 0,
  baths INT NOT NULL DEFAULT 0,
  sqft INT NOT NULL DEFAULT 0,
  rooms INT NOT NULL DEFAULT 1,
  area_m INT NOT NULL DEFAULT 50,
  floors INT NOT NULL DEFAULT 1,
  lng DOUBLE PRECISION NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  photo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- All reads/writes go through Next.js API routes using the secret key,
-- which bypasses RLS. Enabling RLS with no policies blocks direct
-- anon/publishable-key access to this table.
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
