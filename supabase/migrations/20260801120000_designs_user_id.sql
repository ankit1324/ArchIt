-- Clerk user who saved the design. Stamped server-side on create; the
-- designs API only reads/writes rows for the signed-in user.
-- Pre-ownership rows have no owner — delete them, they would be invisible.
DELETE FROM designs;

ALTER TABLE designs ADD COLUMN IF NOT EXISTS user_id TEXT NOT NULL;
