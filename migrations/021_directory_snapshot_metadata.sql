-- Public metadata belongs to a snapshot, never to mutable identity rows.
-- Historical metadata cannot be reconstructed reliably; re-import its source.
CREATE TABLE election_snapshot_metadata (
  snapshot_id INTEGER PRIMARY KEY REFERENCES source_snapshots(id),
  election_id INTEGER NOT NULL REFERENCES elections(id),
  approval_state TEXT NOT NULL CHECK (approval_state IN ('submitted_not_approved','approved','unknown')),
  approval_evidence_url TEXT,
  parser_version TEXT NOT NULL
);
CREATE TABLE electoral_list_versions (
  snapshot_id INTEGER NOT NULL REFERENCES source_snapshots(id),
  list_id INTEGER NOT NULL REFERENCES electoral_lists(id),
  official_list_key TEXT NOT NULL,
  title_he TEXT NOT NULL,
  ballot_letters TEXT,
  roster_published INTEGER NOT NULL CHECK (roster_published IN (0,1)),
  submitted_by_raw TEXT,
  source_url TEXT,
  candidate_count INTEGER NOT NULL CHECK (candidate_count >= 0),
  PRIMARY KEY (snapshot_id,list_id),
  UNIQUE (snapshot_id,official_list_key)
);
-- If old data violates this invariant, fail the migration for operator review.
CREATE UNIQUE INDEX idx_one_active_directory_per_election ON directory_publications(election_id) WHERE status='active';
