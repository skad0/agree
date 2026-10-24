-- A list that withdrew after filing is a different fact from a list that never published a roster.
ALTER TABLE electoral_list_versions ADD COLUMN running INTEGER NOT NULL DEFAULT 1 CHECK (running IN (0,1));
ALTER TABLE electoral_list_versions ADD COLUMN withdrawn_evidence_url TEXT;
ALTER TABLE electoral_list_versions ADD COLUMN page_published TEXT;
ALTER TABLE electoral_list_versions ADD COLUMN page_updated TEXT;
