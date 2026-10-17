-- Multi-user showcase. Purely additive; no destructive DML.

-- designs: published_at NULL = private, non-NULL = published (and when).
-- author_name is the display name captured at publish time (cleared on
-- unpublish). place is a short human label for the picked spot, which itself
-- is written into the existing plot_lng / plot_lat.
ALTER TABLE designs ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ NULL;
ALTER TABLE designs ADD COLUMN IF NOT EXISTS author_name TEXT NULL;
ALTER TABLE designs ADD COLUMN IF NOT EXISTS place TEXT NULL;

CREATE INDEX IF NOT EXISTS designs_published_idx
  ON designs (published_at DESC)
  WHERE published_at IS NOT NULL;

-- properties: widen the inline type CHECK from create_properties
-- (Postgres named it properties_type_check) to allow showcase listings.
-- Showcase listings store price = 0; the column stays NOT NULL.
ALTER TABLE properties DROP CONSTRAINT IF EXISTS properties_type_check;
ALTER TABLE properties
  ADD CONSTRAINT properties_type_check CHECK (type IN ('sale', 'rent', 'showcase'));

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS design_id TEXT NULL REFERENCES designs(id) ON DELETE SET NULL;

-- ON DELETE SET NULL looks up referencing rows on every design delete
CREATE INDEX IF NOT EXISTS properties_design_idx
  ON properties (design_id)
  WHERE design_id IS NOT NULL;

ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS default_view TEXT NOT NULL DEFAULT 'photos'
  CHECK (default_view IN ('photos', '3d'));
