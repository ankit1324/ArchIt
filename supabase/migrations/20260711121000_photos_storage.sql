-- Public bucket for listing photos. Reads are public URLs; writes happen
-- only through the Next.js upload route using the secret key (storage RLS
-- has no policies, so anon/publishable clients cannot write).
INSERT INTO storage.buckets (id, name, public)
VALUES ('photos', 'photos', true)
ON CONFLICT (id) DO NOTHING;

-- Up to 5 photos per listing; legacy single "photo" column stays and mirrors
-- photos[1] for back-compat.
ALTER TABLE properties ADD COLUMN IF NOT EXISTS photos TEXT[] NOT NULL DEFAULT '{}';
