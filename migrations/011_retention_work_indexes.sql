CREATE INDEX idx_response_work_stale ON response_object_work(state, created_at, object_key);
CREATE INDEX idx_response_work_pending ON response_object_work(state, next_attempt_at, object_key);
CREATE INDEX idx_privacy_tokens_used_cleanup ON privacy_deletion_tokens(used_at, id);
CREATE INDEX idx_privacy_tokens_expiry_cleanup ON privacy_deletion_tokens(expires_at, id);
