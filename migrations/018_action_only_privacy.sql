-- Public action-only flow: support signup is off by default.
-- Routes remain for admin re-enable; tables stay for historical rows and erasure.
UPDATE campaigns SET support_enabled = 0 WHERE id = 1;
