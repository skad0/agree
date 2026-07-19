CREATE TABLE campaigns (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'archived')),
  support_enabled INTEGER NOT NULL DEFAULT 1,
  requests_enabled INTEGER NOT NULL DEFAULT 1,
  responses_enabled INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE demands (
  id INTEGER PRIMARY KEY,
  campaign_id INTEGER NOT NULL REFERENCES campaigns(id),
  sort_order INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE demand_translations (
  demand_id INTEGER NOT NULL REFERENCES demands(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('he','ar','yi','ru','en','am')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  PRIMARY KEY (demand_id, locale)
);

CREATE TABLE message_templates (
  id INTEGER PRIMARY KEY,
  locale TEXT NOT NULL CHECK (locale IN ('he','ar','yi','ru','en','am')),
  channel TEXT NOT NULL CHECK (channel IN ('email','whatsapp')),
  subject TEXT,
  body TEXT NOT NULL,
  UNIQUE (locale, channel)
);

CREATE TABLE recipients (
  id INTEGER PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('party','politician')),
  email TEXT,
  whatsapp TEXT,
  website TEXT,
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE recipient_translations (
  recipient_id INTEGER NOT NULL REFERENCES recipients(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK (locale IN ('he','ar','yi','ru','en','am')),
  name TEXT NOT NULL,
  PRIMARY KEY (recipient_id, locale)
);

CREATE TABLE supporters (
  id INTEGER PRIMARY KEY,
  email_normalized TEXT NOT NULL UNIQUE,
  name TEXT,
  city TEXT,
  profession TEXT,
  locale TEXT NOT NULL,
  public_name_allowed INTEGER NOT NULL DEFAULT 0,
  privacy_consent_at TEXT NOT NULL,
  email_verified_at TEXT,
  created_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE email_verifications (
  id INTEGER PRIMARY KEY,
  supporter_id INTEGER NOT NULL REFERENCES supporters(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE TABLE generated_requests (
  id INTEGER PRIMARY KEY,
  recipient_id INTEGER NOT NULL REFERENCES recipients(id),
  locale TEXT NOT NULL,
  selected_demands TEXT NOT NULL,
  created_at TEXT NOT NULL,
  supporter_id INTEGER REFERENCES supporters(id)
);

CREATE TABLE request_actions (
  id INTEGER PRIMARY KEY,
  generated_request_id INTEGER NOT NULL REFERENCES generated_requests(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('email_opened','whatsapp_opened','text_copied','reported_sent')),
  created_at TEXT NOT NULL
);

CREATE TABLE submitted_responses (
  id INTEGER PRIMARY KEY,
  recipient_id INTEGER NOT NULL REFERENCES recipients(id),
  received_at TEXT NOT NULL,
  channel TEXT NOT NULL,
  response_text TEXT NOT NULL,
  submitter_email TEXT NOT NULL,
  consent_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','under_review','confirmed','insufficient_data','duplicate','rejected')),
  reviewed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE submitted_response_files (
  id INTEGER PRIMARY KEY,
  response_id INTEGER NOT NULL REFERENCES submitted_responses(id) ON DELETE CASCADE,
  object_key TEXT NOT NULL,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL CHECK (size <= 10485760),
  uploaded_at TEXT NOT NULL
);

CREATE TABLE admins (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('admin','moderator')),
  is_active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE admin_audit_events (
  id INTEGER PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES admins(id),
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_supporters_verified ON supporters(email_verified_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_actions_type ON request_actions(action_type);
CREATE INDEX idx_responses_status ON submitted_responses(status, created_at);

