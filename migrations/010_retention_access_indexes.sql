CREATE INDEX idx_generated_requests_supporter ON generated_requests(supporter_id, id);
CREATE INDEX idx_email_verifications_supporter ON email_verifications(supporter_id, id);
CREATE INDEX idx_response_files_response ON submitted_response_files(response_id, id);
CREATE INDEX idx_privacy_tokens_cleanup ON privacy_deletion_tokens(expires_at, used_at, id);
