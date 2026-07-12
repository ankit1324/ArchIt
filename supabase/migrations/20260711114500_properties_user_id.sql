-- Clerk user who listed the property. Stamped server-side on create; only
-- this user may edit or delete the listing. NULL = legacy row (pre-ownership).
ALTER TABLE properties ADD COLUMN IF NOT EXISTS user_id TEXT;
