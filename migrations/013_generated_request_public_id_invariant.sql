CREATE TRIGGER generated_requests_public_id_insert
BEFORE INSERT ON generated_requests
WHEN NEW.public_id IS NULL
  OR length(NEW.public_id) < 43
  OR length(NEW.public_id) > 64
  OR NEW.public_id GLOB '*[^A-Za-z0-9_-]*'
BEGIN
  SELECT RAISE(ABORT, 'generated_requests.public_id must be a non-empty high-entropy identifier');
END;

CREATE TRIGGER generated_requests_public_id_update
BEFORE UPDATE OF public_id ON generated_requests
WHEN NEW.public_id IS NULL
  OR length(NEW.public_id) < 43
  OR length(NEW.public_id) > 64
  OR NEW.public_id GLOB '*[^A-Za-z0-9_-]*'
BEGIN
  SELECT RAISE(ABORT, 'generated_requests.public_id must be a non-empty high-entropy identifier');
END;
