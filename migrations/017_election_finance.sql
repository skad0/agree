-- Election finance reports, line items, and versioned summaries.
-- Amounts are integer minor units. Subject is exactly one of person or party.

CREATE TABLE finance_reports (
  id INTEGER PRIMARY KEY,
  person_id INTEGER REFERENCES people(id),
  party_id INTEGER REFERENCES parties(id),
  election_id INTEGER REFERENCES elections(id),
  contest_key TEXT,
  period_start TEXT,
  period_end TEXT,
  source_report_key TEXT NOT NULL,
  source_revision TEXT,
  report_status TEXT NOT NULL CHECK (report_status IN ('reported', 'audited')),
  snapshot_id INTEGER REFERENCES source_snapshots(id),
  published_at TEXT,
  CHECK (
    (CASE WHEN person_id IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN party_id IS NOT NULL THEN 1 ELSE 0 END) = 1
  ),
  UNIQUE (source_report_key, source_revision)
);

CREATE TABLE finance_entries (
  id INTEGER PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES finance_reports(id),
  source_entry_key TEXT NOT NULL,
  entry_kind TEXT NOT NULL CHECK (entry_kind IN ('donation', 'refund', 'loan', 'guarantee')),
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  donor_or_guarantor_name TEXT,
  city_published TEXT,
  country_code TEXT,
  is_foreign INTEGER CHECK (is_foreign IS NULL OR is_foreign IN (0, 1)),
  UNIQUE (report_id, source_entry_key)
);

CREATE TABLE finance_summaries (
  id INTEGER PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES finance_reports(id),
  calculation_version TEXT NOT NULL,
  coverage TEXT NOT NULL CHECK (coverage IN ('missing', 'not_applicable', 'not_yet_published', 'failed', 'present')),
  gross_donations_minor INTEGER,
  refunds_minor INTEGER,
  net_donations_minor INTEGER,
  loans_minor INTEGER,
  guarantees_minor INTEGER,
  foreign_share_numerator_minor INTEGER,
  foreign_share_denominator_minor INTEGER,
  audit_json TEXT CHECK (audit_json IS NULL OR json_valid(audit_json)),
  payload_schema_version INTEGER NOT NULL DEFAULT 1,
  computed_at TEXT NOT NULL,
  UNIQUE (report_id, calculation_version)
);

CREATE INDEX idx_finance_entries_report_key ON finance_entries(report_id, source_entry_key);
CREATE INDEX idx_finance_reports_election ON finance_reports(election_id);
CREATE INDEX idx_finance_reports_person ON finance_reports(person_id);
CREATE INDEX idx_finance_reports_party ON finance_reports(party_id);
