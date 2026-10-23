-- Trust & safety: listing moderation + user reports.
-- Additive only: one new column (existing rows backfilled to 'live'), one new table.

-- ---------------------------------------------------------------------------
-- 1. properties.status
--
--    pending  → submitted, waiting for an admin (only the lister and admins see it)
--    live     → approved; the only status public queries return
--    rejected → declined or taken down after a report (lister still sees it)
--
--    The column is added with DEFAULT 'live' so every existing listing stays
--    visible, then the default is switched to 'pending' so anything inserted
--    from now on waits for review. POST /api/properties also sets it explicitly.
-- ---------------------------------------------------------------------------
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'live';

ALTER TABLE properties ALTER COLUMN status SET DEFAULT 'pending';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'properties_status_chk'
  ) THEN
    ALTER TABLE properties
      ADD CONSTRAINT properties_status_chk
      CHECK (status IN ('pending', 'live', 'rejected'));
  END IF;
END $$;

-- Who decided, when, and why (the reason is emailed to the lister on reject).
ALTER TABLE properties ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS reviewed_by TEXT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS review_note TEXT;

-- The admin queue: pending listings, oldest first.
CREATE INDEX IF NOT EXISTS properties_pending_idx
  ON properties (created_at) WHERE status = 'pending';

-- ---------------------------------------------------------------------------
-- 2. listing_reports: "Report listing" from the detail panel.
--
--    One open-or-closed report per (listing, reporter) — a second report from
--    the same user is a 409, not a pile-on. Reports vanish with their listing.
--    status: open → dismissed | actioned (listing taken down)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS listing_reports (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties (id) ON DELETE CASCADE,
  reporter_id TEXT NOT NULL,
  reason TEXT NOT NULL
    CHECK (reason IN ('fraud', 'wrong_info', 'duplicate', 'offensive', 'unavailable', 'other')),
  details TEXT CHECK (char_length(details) <= 1000),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'dismissed', 'actioned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  UNIQUE (property_id, reporter_id)
);

-- The admin view: open reports, newest first.
CREATE INDEX IF NOT EXISTS listing_reports_open_idx
  ON listing_reports (created_at DESC) WHERE status = 'open';

-- Server routes use the secret key (bypasses RLS); block anon access.
ALTER TABLE listing_reports ENABLE ROW LEVEL SECURITY;
