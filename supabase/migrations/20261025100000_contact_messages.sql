-- Contact form inbox: messages from /contact land here for the /admin/inbox
-- queue (no third-party email provider needed). Additive only.
--
-- status: open → handled (an admin replied by email and marked it done).
-- user_id is the sender's Clerk id when they were signed in, else NULL.
CREATE TABLE IF NOT EXISTS contact_messages (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  email TEXT NOT NULL CHECK (char_length(email) BETWEEN 3 AND 200),
  topic TEXT NOT NULL CHECK (topic IN ('payment', 'listing', 'account', 'other')),
  message TEXT NOT NULL CHECK (char_length(message) BETWEEN 10 AND 2000),
  user_id TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'handled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  handled_at TIMESTAMPTZ,
  handled_by TEXT
);

-- /admin/inbox: open messages first, newest first within a status.
CREATE INDEX IF NOT EXISTS contact_messages_status_created_idx
  ON contact_messages (status, created_at DESC);

-- Server routes use the secret key (bypasses RLS); block anon access.
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;
