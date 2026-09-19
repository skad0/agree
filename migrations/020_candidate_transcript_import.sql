-- Candidate transcript import (26th Knesset).
--
-- The CEC publishes each candidate as ONE concatenated Hebrew string, family name
-- first ("השכל שרן מרים"), not as the separate שם משפחה / שם פרטי columns the older
-- candidates-lists XLSX resources carried.  The split is not mechanically derivable
-- -- "השכל שרן מרים" is Haskel / Sharan Miriam, but a last-token split yields
-- "השכל שרן" / "מרים" -- so full_name_raw becomes the authoritative published value
-- and the two split columns become nullable, to be filled only by a reviewed source.
--
-- candidacy_versions is rebuilt because SQLite cannot drop a NOT NULL in place.
-- Existing rows are copied verbatim into full_name_raw as "family given".

PRAGMA foreign_keys = OFF;

CREATE TABLE candidacy_versions_020 (
  id INTEGER PRIMARY KEY,
  candidacy_id INTEGER NOT NULL REFERENCES candidacies(id),
  snapshot_id INTEGER NOT NULL REFERENCES source_snapshots(id),
  list_id INTEGER NOT NULL REFERENCES electoral_lists(id),
  source_record_id INTEGER REFERENCES source_records(id),
  rank INTEGER NOT NULL CHECK (rank > 0),
  full_name_raw TEXT NOT NULL,
  given_name_raw TEXT,
  family_name_raw TEXT,
  via_party_raw TEXT,
  city_published TEXT,
  status TEXT NOT NULL CHECK (status IN ('listed', 'withdrawn', 'replaced')),
  UNIQUE (snapshot_id, list_id, rank),
  UNIQUE (candidacy_id, snapshot_id)
);

INSERT INTO candidacy_versions_020
  (id, candidacy_id, snapshot_id, list_id, source_record_id, rank,
   full_name_raw, given_name_raw, family_name_raw, via_party_raw, city_published, status)
SELECT id, candidacy_id, snapshot_id, list_id, source_record_id, rank,
  TRIM(family_name_raw || ' ' || given_name_raw), given_name_raw, family_name_raw, NULL, city_published, status
FROM candidacy_versions;

DROP TABLE candidacy_versions;
ALTER TABLE candidacy_versions_020 RENAME TO candidacy_versions;

CREATE INDEX idx_candidacy_versions_snapshot_list_rank ON candidacy_versions(snapshot_id, list_id, rank);

PRAGMA foreign_keys = ON;

-- A submitted list may appear in the official index with no roster page of its own.
-- Record that as a fact rather than leaving it indistinguishable from an empty import.
ALTER TABLE electoral_lists ADD COLUMN roster_published INTEGER NOT NULL DEFAULT 1 CHECK (roster_published IN (0, 1));
ALTER TABLE electoral_lists ADD COLUMN submitted_by_raw TEXT;

-- Submitted lists are not approved lists.  The CEC publishes submissions first and
-- approves them later; the directory must be able to say which state it is showing.
ALTER TABLE elections ADD COLUMN approval_state TEXT NOT NULL DEFAULT 'unknown'
  CHECK (approval_state IN ('submitted_not_approved', 'approved', 'unknown'));
