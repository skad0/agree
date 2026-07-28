CREATE TABLE response_submission_nonces (
  token_hash TEXT PRIMARY KEY,
  response_id INTEGER UNIQUE REFERENCES submitted_responses(id) ON DELETE SET NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('completed', 'erased')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE response_object_work (
  object_key TEXT PRIMARY KEY,
  token_hash TEXT,
  state TEXT NOT NULL CHECK (state IN ('upload_pending', 'delete_pending')),
  mime TEXT,
  size INTEGER,
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX idx_submitted_response_files_object_key ON submitted_response_files(object_key);
