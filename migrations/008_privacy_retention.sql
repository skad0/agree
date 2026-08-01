CREATE TABLE privacy_deletion_tokens (id INTEGER PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, email_normalized TEXT NOT NULL, expires_at TEXT NOT NULL, used_at TEXT, created_at TEXT NOT NULL);
CREATE INDEX idx_privacy_deletion_tokens_expiry ON privacy_deletion_tokens(expires_at, used_at);
