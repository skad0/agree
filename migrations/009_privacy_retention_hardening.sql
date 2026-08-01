ALTER TABLE supporters ADD COLUMN last_active_at TEXT;
UPDATE supporters SET last_active_at = COALESCE(last_active_at, created_at);
CREATE INDEX idx_supporters_retention ON supporters(deleted_at, last_active_at, id);
CREATE INDEX idx_submitted_responses_retention ON submitted_responses(created_at, id);
CREATE INDEX idx_admin_audit_retention ON admin_audit_events(created_at, id);

-- Historical payloads were written before the audit allowlist existed. Keep the
-- event's useful action/entity/actor/timestamp, but remove every old payload.
UPDATE admin_audit_events SET payload = '{}';

CREATE TRIGGER supporters_activity_on_request
AFTER UPDATE OF supporter_id ON generated_requests
WHEN NEW.supporter_id IS NOT NULL
BEGIN
  UPDATE supporters SET last_active_at = CASE WHEN last_active_at > NEW.created_at THEN last_active_at ELSE NEW.created_at END WHERE id = NEW.supporter_id;
END;
CREATE TRIGGER supporters_activity_on_action
AFTER INSERT ON request_actions
BEGIN
  UPDATE supporters SET last_active_at = CASE WHEN last_active_at > NEW.created_at THEN last_active_at ELSE NEW.created_at END
  WHERE id = (SELECT supporter_id FROM generated_requests WHERE id = NEW.generated_request_id);
END;
