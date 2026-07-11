-- Extra setup answers (unit, facing, budget, notes) captured before the
-- builder opens. JSONB so future setup questions need no migration.
ALTER TABLE designs ADD COLUMN IF NOT EXISTS meta JSONB;
