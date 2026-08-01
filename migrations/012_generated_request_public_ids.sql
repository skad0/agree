ALTER TABLE generated_requests ADD COLUMN public_id TEXT;

-- Existing rows receive independent 256-bit values before uniqueness is enforced.
UPDATE generated_requests SET public_id = lower(hex(randomblob(32))) WHERE public_id IS NULL;

CREATE UNIQUE INDEX idx_generated_requests_public_id ON generated_requests(public_id);
