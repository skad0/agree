-- Election directory identity, provenance, jobs, and publication scaffolding.
-- Finance tables are intentionally omitted until that source contract is verified.

CREATE TABLE source_snapshots (
  id INTEGER PRIMARY KEY,
  source TEXT NOT NULL,
  resource_id TEXT,
  url TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  published_at TEXT,
  content_hash TEXT NOT NULL,
  parser_version TEXT NOT NULL,
  media_type TEXT,
  artifact_ref TEXT,
  extraction_state TEXT NOT NULL CHECK (extraction_state IN ('pending', 'complete', 'incomplete', 'failed', 'blocked')),
  completeness_json TEXT CHECK (completeness_json IS NULL OR json_valid(completeness_json)),
  payload_schema_version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE source_records (
  id INTEGER PRIMARY KEY,
  snapshot_id INTEGER NOT NULL REFERENCES source_snapshots(id),
  record_key TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  payload_schema_version INTEGER NOT NULL DEFAULT 1,
  UNIQUE (snapshot_id, record_key)
);

CREATE TABLE elections (
  id INTEGER PRIMARY KEY,
  number INTEGER NOT NULL UNIQUE CHECK (number > 0),
  title_he TEXT,
  publication_status TEXT NOT NULL CHECK (publication_status IN ('announced', 'lists_published', 'held', 'historical', 'unknown')),
  published_at TEXT,
  snapshot_id INTEGER REFERENCES source_snapshots(id)
);

CREATE TABLE electoral_lists (
  id INTEGER PRIMARY KEY,
  election_id INTEGER NOT NULL REFERENCES elections(id),
  official_list_key TEXT,
  ballot_letters TEXT,
  title_he TEXT NOT NULL,
  source_revision TEXT,
  snapshot_id INTEGER REFERENCES source_snapshots(id),
  UNIQUE (election_id, official_list_key)
);

CREATE TABLE people (
  id INTEGER PRIMARY KEY,
  knesset_person_id TEXT UNIQUE,
  given_name TEXT,
  family_name TEXT,
  display_name TEXT,
  photo_url TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE parties (
  id INTEGER PRIMARY KEY,
  registrar_number TEXT UNIQUE,
  name_he TEXT NOT NULL,
  email TEXT,
  address TEXT,
  registered_at TEXT
);

CREATE TABLE factions (
  id INTEGER PRIMARY KEY,
  knesset_faction_id TEXT UNIQUE,
  name_he TEXT NOT NULL,
  knesset_num INTEGER,
  start_at TEXT,
  end_at TEXT
);

CREATE TABLE committees (
  id INTEGER PRIMARY KEY,
  knesset_committee_id TEXT UNIQUE,
  name_he TEXT NOT NULL,
  email TEXT,
  knesset_num INTEGER
);

CREATE TABLE candidacies (
  id INTEGER PRIMARY KEY,
  election_id INTEGER NOT NULL REFERENCES elections(id),
  list_id INTEGER NOT NULL REFERENCES electoral_lists(id),
  person_id INTEGER REFERENCES people(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'withdrawn', 'replaced', 'historical')),
  UNIQUE (election_id, list_id, person_id)
);

CREATE TABLE candidacy_versions (
  id INTEGER PRIMARY KEY,
  candidacy_id INTEGER NOT NULL REFERENCES candidacies(id),
  snapshot_id INTEGER NOT NULL REFERENCES source_snapshots(id),
  list_id INTEGER NOT NULL REFERENCES electoral_lists(id),
  source_record_id INTEGER REFERENCES source_records(id),
  rank INTEGER NOT NULL CHECK (rank > 0),
  given_name_raw TEXT NOT NULL,
  family_name_raw TEXT NOT NULL,
  city_published TEXT,
  status TEXT NOT NULL CHECK (status IN ('listed', 'withdrawn', 'replaced')),
  UNIQUE (snapshot_id, list_id, rank),
  UNIQUE (candidacy_id, snapshot_id)
);

CREATE TABLE candidacy_party_memberships (
  id INTEGER PRIMARY KEY,
  candidacy_id INTEGER NOT NULL REFERENCES candidacies(id),
  party_id INTEGER NOT NULL REFERENCES parties(id),
  source_record_id INTEGER REFERENCES source_records(id),
  review_state TEXT NOT NULL CHECK (review_state IN ('pending', 'accepted', 'rejected')),
  effective_from TEXT,
  effective_to TEXT,
  UNIQUE (candidacy_id, party_id, effective_from)
);

CREATE TABLE electoral_list_parties (
  id INTEGER PRIMARY KEY,
  list_id INTEGER NOT NULL REFERENCES electoral_lists(id),
  party_id INTEGER NOT NULL REFERENCES parties(id),
  review_state TEXT NOT NULL CHECK (review_state IN ('pending', 'accepted', 'rejected')),
  evidence_snapshot_id INTEGER REFERENCES source_snapshots(id),
  UNIQUE (list_id, party_id)
);

CREATE TABLE faction_parties (
  id INTEGER PRIMARY KEY,
  faction_id INTEGER NOT NULL REFERENCES factions(id),
  party_id INTEGER NOT NULL REFERENCES parties(id),
  review_state TEXT NOT NULL CHECK (review_state IN ('pending', 'accepted', 'rejected')),
  effective_from TEXT,
  effective_to TEXT,
  UNIQUE (faction_id, party_id, effective_from)
);

CREATE TABLE parliamentary_positions (
  id INTEGER PRIMARY KEY,
  source_position_id TEXT NOT NULL UNIQUE,
  person_id INTEGER NOT NULL REFERENCES people(id),
  role TEXT NOT NULL,
  knesset_num INTEGER NOT NULL CHECK (knesset_num > 0),
  faction_id INTEGER REFERENCES factions(id),
  committee_id INTEGER REFERENCES committees(id),
  start_at TEXT,
  end_at TEXT,
  is_current INTEGER NOT NULL DEFAULT 0 CHECK (is_current IN (0, 1))
);

CREATE TABLE contact_points (
  id INTEGER PRIMARY KEY,
  person_id INTEGER REFERENCES people(id),
  party_id INTEGER REFERENCES parties(id),
  faction_id INTEGER REFERENCES factions(id),
  channel TEXT NOT NULL CHECK (channel IN ('email', 'whatsapp', 'phone', 'url')),
  value_normalized TEXT NOT NULL,
  source_record_id INTEGER REFERENCES source_records(id),
  observed_at TEXT,
  verified_at TEXT,
  expires_at TEXT,
  CHECK (
    (CASE WHEN person_id IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN party_id IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN faction_id IS NOT NULL THEN 1 ELSE 0 END) = 1
  )
);

CREATE TABLE candidate_contact_resolutions (
  id INTEGER PRIMARY KEY,
  candidacy_id INTEGER NOT NULL REFERENCES candidacies(id),
  contact_point_id INTEGER REFERENCES contact_points(id),
  contact_level TEXT NOT NULL CHECK (contact_level IN ('individual', 'party_fallback', 'unresolved')),
  contact_owner_kind TEXT CHECK (contact_owner_kind IN ('person', 'party', 'faction')),
  status TEXT NOT NULL CHECK (status IN ('verified', 'stale', 'missing', 'needs_review')),
  resolved_at TEXT NOT NULL,
  CHECK (
    (contact_level = 'unresolved' AND contact_point_id IS NULL AND contact_owner_kind IS NULL)
    OR (contact_level = 'individual' AND contact_point_id IS NOT NULL AND contact_owner_kind = 'person')
    OR (contact_level = 'party_fallback' AND contact_point_id IS NOT NULL AND contact_owner_kind IN ('party', 'faction'))
  )
);

CREATE TABLE identity_matches (
  id INTEGER PRIMARY KEY,
  person_id INTEGER REFERENCES people(id),
  proposed_knesset_person_id TEXT,
  normalized_key TEXT,
  algorithm_version TEXT NOT NULL,
  score REAL,
  features_json TEXT CHECK (features_json IS NULL OR json_valid(features_json)),
  payload_schema_version INTEGER NOT NULL DEFAULT 1,
  state TEXT NOT NULL CHECK (state IN ('pending', 'accepted', 'rejected')),
  created_at TEXT NOT NULL
);

CREATE TABLE entity_aliases (
  id INTEGER PRIMARY KEY,
  person_id INTEGER REFERENCES people(id),
  party_id INTEGER REFERENCES parties(id),
  faction_id INTEGER REFERENCES factions(id),
  list_id INTEGER REFERENCES electoral_lists(id),
  locale TEXT NOT NULL CHECK (locale IN ('he','ar','yi','ru','en','am','uk')),
  alias TEXT NOT NULL,
  normalized_key TEXT,
  review_state TEXT NOT NULL CHECK (review_state IN ('pending', 'accepted', 'rejected')),
  CHECK (
    (CASE WHEN person_id IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN party_id IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN faction_id IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN list_id IS NOT NULL THEN 1 ELSE 0 END) = 1
  )
);

CREATE TABLE review_decisions (
  id INTEGER PRIMARY KEY,
  identity_match_id INTEGER REFERENCES identity_matches(id),
  entity_alias_id INTEGER REFERENCES entity_aliases(id),
  decision TEXT NOT NULL CHECK (decision IN ('accepted', 'rejected', 'needs_review')),
  reviewer TEXT NOT NULL,
  reason TEXT,
  created_at TEXT NOT NULL,
  CHECK (
    (CASE WHEN identity_match_id IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN entity_alias_id IS NOT NULL THEN 1 ELSE 0 END) = 1
  )
);

CREATE TABLE entity_translations (
  id INTEGER PRIMARY KEY,
  person_id INTEGER REFERENCES people(id),
  party_id INTEGER REFERENCES parties(id),
  faction_id INTEGER REFERENCES factions(id),
  committee_id INTEGER REFERENCES committees(id),
  locale TEXT NOT NULL CHECK (locale IN ('he','ar','yi','ru','en','am','uk')),
  label TEXT NOT NULL,
  review_state TEXT NOT NULL CHECK (review_state IN ('pending', 'accepted', 'rejected')),
  source TEXT,
  CHECK (
    (CASE WHEN person_id IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN party_id IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN faction_id IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN committee_id IS NOT NULL THEN 1 ELSE 0 END) = 1
  )
);

CREATE TABLE recipient_field_overrides (
  id INTEGER PRIMARY KEY,
  recipient_id INTEGER NOT NULL REFERENCES recipients(id),
  field TEXT NOT NULL CHECK (field IN ('email', 'whatsapp', 'website', 'social_handle', 'name', 'is_active')),
  value TEXT,
  cleared INTEGER NOT NULL DEFAULT 0 CHECK (cleared IN (0, 1)),
  reviewer TEXT NOT NULL,
  source TEXT,
  created_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE TABLE etl_jobs (
  id INTEGER PRIMARY KEY,
  dedupe_key TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL,
  election_id INTEGER REFERENCES elections(id),
  stage TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('pending', 'running', 'retry', 'succeeded', 'failed', 'blocked')),
  attempt_budget INTEGER NOT NULL CHECK (attempt_budget > 0),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at TEXT,
  lease_token TEXT,
  lease_expires_at TEXT,
  error_code TEXT
);

CREATE TABLE directory_publications (
  id INTEGER PRIMARY KEY,
  election_id INTEGER NOT NULL REFERENCES elections(id),
  version INTEGER NOT NULL CHECK (version > 0),
  status TEXT NOT NULL CHECK (status IN ('draft', 'accepted', 'active', 'rolled_back')),
  previous_publication_id INTEGER REFERENCES directory_publications(id),
  snapshot_id INTEGER REFERENCES source_snapshots(id),
  activated_at TEXT,
  UNIQUE (election_id, version)
);

CREATE TABLE etl_runs (
  id INTEGER PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES etl_jobs(id),
  started_at TEXT NOT NULL,
  finished_at TEXT,
  row_count INTEGER,
  missing_field_count INTEGER,
  review_count INTEGER,
  publication_id INTEGER REFERENCES directory_publications(id),
  status TEXT NOT NULL CHECK (status IN ('running', 'succeeded', 'failed', 'blocked'))
);

CREATE TABLE etl_checkpoints (
  id INTEGER PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES etl_jobs(id),
  stage TEXT NOT NULL,
  lease_token TEXT,
  cursor_json TEXT CHECK (cursor_json IS NULL OR json_valid(cursor_json)),
  payload_schema_version INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  UNIQUE (job_id, stage)
);

CREATE TABLE recipient_entity_links (
  id INTEGER PRIMARY KEY,
  recipient_id INTEGER NOT NULL REFERENCES recipients(id),
  person_id INTEGER REFERENCES people(id),
  party_id INTEGER REFERENCES parties(id),
  review_state TEXT NOT NULL CHECK (review_state IN ('pending', 'accepted', 'rejected')),
  created_at TEXT NOT NULL,
  UNIQUE (recipient_id),
  CHECK (
    (CASE WHEN person_id IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN party_id IS NOT NULL THEN 1 ELSE 0 END) = 1
  )
);

CREATE TABLE program_question_versions (
  id INTEGER PRIMARY KEY,
  demand_id INTEGER NOT NULL REFERENCES demands(id),
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id),
  semantic_version TEXT NOT NULL,
  canonical_text_hash TEXT NOT NULL,
  reviewed_at TEXT,
  UNIQUE (demand_id, semantic_version)
);

CREATE TABLE public_stances (
  id INTEGER PRIMARY KEY,
  person_id INTEGER REFERENCES people(id),
  party_id INTEGER REFERENCES parties(id),
  list_id INTEGER REFERENCES electoral_lists(id),
  question_version_id INTEGER NOT NULL REFERENCES program_question_versions(id),
  election_id INTEGER REFERENCES elections(id),
  classification TEXT NOT NULL CHECK (classification IN (
    'supports', 'supports_with_reservations', 'opposes', 'statement_available',
    'unknown', 'under_review', 'multiple'
  )),
  publication_state TEXT NOT NULL CHECK (publication_state IN ('draft', 'published', 'retracted', 'under_review')),
  summary TEXT,
  excerpt TEXT,
  source_url TEXT,
  statement_at TEXT,
  verified_at TEXT,
  reviewer TEXT,
  supersedes_id INTEGER REFERENCES public_stances(id),
  CHECK (
    (CASE WHEN person_id IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN party_id IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN list_id IS NOT NULL THEN 1 ELSE 0 END) = 1
  )
);

CREATE TABLE public_stance_evidence (
  id INTEGER PRIMARY KEY,
  stance_id INTEGER NOT NULL REFERENCES public_stances(id),
  source_url TEXT NOT NULL,
  excerpt TEXT,
  observed_at TEXT
);

CREATE TABLE public_stance_translations (
  stance_id INTEGER NOT NULL REFERENCES public_stances(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('he','ar','yi','ru','en','am','uk')),
  summary TEXT,
  excerpt TEXT,
  PRIMARY KEY (stance_id, locale)
);

CREATE INDEX idx_etl_jobs_state_next ON etl_jobs(state, next_attempt_at);
CREATE INDEX idx_etl_jobs_lease_expires ON etl_jobs(lease_expires_at);
CREATE INDEX idx_candidacies_election_list ON candidacies(election_id, list_id);
CREATE INDEX idx_candidacy_versions_snapshot_list_rank ON candidacy_versions(snapshot_id, list_id, rank);
CREATE INDEX idx_parliamentary_positions_person_knesset ON parliamentary_positions(person_id, knesset_num);
CREATE INDEX idx_contact_resolutions_candidacy ON candidate_contact_resolutions(candidacy_id);
CREATE INDEX idx_identity_matches_state_created ON identity_matches(state, created_at);
CREATE INDEX idx_entity_translations_person_locale ON entity_translations(person_id, locale);
CREATE INDEX idx_entity_translations_party_locale ON entity_translations(party_id, locale);
CREATE INDEX idx_entity_translations_faction_locale ON entity_translations(faction_id, locale);
CREATE INDEX idx_entity_translations_committee_locale ON entity_translations(committee_id, locale);
CREATE INDEX idx_public_stances_subject_question ON public_stances(question_version_id, publication_state);
CREATE UNIQUE INDEX idx_directory_publications_one_active ON directory_publications(election_id) WHERE status = 'active';
CREATE UNIQUE INDEX idx_recipient_field_overrides_active ON recipient_field_overrides(recipient_id, field) WHERE revoked_at IS NULL;
