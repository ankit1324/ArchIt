-- AI photo requests: a user asks for a photograph of their design; an admin
-- makes it (by hand in an image tool, or with the API key) and attaches the
-- result. Additive only.
--
-- status: pending -> done (result attached) | rejected (admin_note says why).
-- brief:  the validated choices the prompt was built from (style keys, floors,
--         facing, time) — kept so a request can be re-read without parsing the prompt.
-- input_path / result_path: objects in the private ai-photos bucket below.
CREATE TABLE IF NOT EXISTS ai_photo_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  design_name TEXT NOT NULL DEFAULT '' CHECK (char_length(design_name) <= 80),
  place TEXT CHECK (place IS NULL OR char_length(place) <= 80),
  brief JSONB NOT NULL,
  prompt TEXT NOT NULL CHECK (char_length(prompt) BETWEEN 1 AND 4000),
  input_path TEXT NOT NULL CHECK (char_length(input_path) BETWEEN 1 AND 200),
  result_path TEXT CHECK (result_path IS NULL OR char_length(result_path) <= 200),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'rejected')),
  admin_note TEXT CHECK (admin_note IS NULL OR char_length(admin_note) <= 300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  completed_by TEXT
);

-- /admin/ai-photos: pending first, oldest first within it (a queue).
CREATE INDEX IF NOT EXISTS ai_photo_requests_status_created_idx
  ON ai_photo_requests (status, created_at);
-- "my photos" in the designer, and the per-user pending cap.
CREATE INDEX IF NOT EXISTS ai_photo_requests_user_created_idx
  ON ai_photo_requests (user_id, created_at DESC);

-- Server routes use the secret key (bypasses RLS); block anon access.
ALTER TABLE ai_photo_requests ENABLE ROW LEVEL SECURITY;

-- New tables get no automatic grants (see 20261028120000).
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_photo_requests TO service_role;

-- Private bucket: pictures are served only through /api/ai-photos/[id]/image,
-- which checks the owner (or an admin). Not the public `photos` bucket, whose
-- cleanup job deletes anything a listing does not reference.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('ai-photos', 'ai-photos', false, 8388608, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;
