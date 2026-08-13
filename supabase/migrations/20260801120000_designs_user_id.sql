-- Clerk user who saved the design. Stamped server-side on create; the
-- designs API only reads/writes rows for the signed-in user.
--
-- Pre-ownership rows have no owner and would be invisible to every user, so
-- they are removed. Done as add-nullable → delete-only-ownerless → SET NOT NULL
-- rather than an unconditional `DELETE FROM designs`: replaying this migration
-- (db reset, migration repair) must never destroy rows that DO have an owner.
ALTER TABLE designs ADD COLUMN IF NOT EXISTS user_id TEXT;

DELETE FROM designs WHERE user_id IS NULL;

ALTER TABLE designs ALTER COLUMN user_id SET NOT NULL;
