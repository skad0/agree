-- Public sharing: the appeal can also be posted publicly, mentioning the recipient.
ALTER TABLE recipients ADD COLUMN social_handle TEXT;

-- SQLite cannot alter a CHECK constraint, so both tables are rebuilt to widen it.
CREATE TABLE message_templates_new (
  id INTEGER PRIMARY KEY,
  locale TEXT NOT NULL CHECK (locale IN ('he','ar','yi','ru','en','am')),
  channel TEXT NOT NULL CHECK (channel IN ('email','whatsapp','social')),
  subject TEXT,
  body TEXT NOT NULL,
  UNIQUE (locale, channel)
);
INSERT INTO message_templates_new (id, locale, channel, subject, body)
  SELECT id, locale, channel, subject, body FROM message_templates;
DROP TABLE message_templates;
ALTER TABLE message_templates_new RENAME TO message_templates;

CREATE TABLE request_actions_new (
  id INTEGER PRIMARY KEY,
  generated_request_id INTEGER NOT NULL REFERENCES generated_requests(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN (
    'email_opened','whatsapp_opened','text_copied','reported_sent',
    'shared_x','shared_facebook','shared_whatsapp','shared_telegram')),
  created_at TEXT NOT NULL
);
INSERT INTO request_actions_new (id, generated_request_id, action_type, created_at)
  SELECT id, generated_request_id, action_type, created_at FROM request_actions;
DROP TABLE request_actions;
ALTER TABLE request_actions_new RENAME TO request_actions;
CREATE INDEX idx_actions_type ON request_actions(action_type);

INSERT INTO message_templates (locale, channel, subject, body) VALUES
  ('en', 'social', NULL, '{handle}\n\nI am asking publicly:\n{demands}\n\nJoin the campaign: {link}'),
  ('he', 'social', NULL, '{handle}\n\nאני פונה בפומבי בבקשה:\n{demands}\n\nהצטרפו לקמפיין: {link}'),
  ('ar', 'social', NULL, '{handle}\n\nأطالب علناً بما يلي:\n{demands}\n\nانضموا إلى الحملة: {link}'),
  ('yi', 'social', NULL, '{handle}\n\nאיך בעט עפֿנטלעך:\n{demands}\n\nשליסט זיך אָן אין דער קאַמפּיין: {link}'),
  ('ru', 'social', NULL, '{handle}\n\nПублично прошу:\n{demands}\n\nПрисоединяйтесь к кампании: {link}'),
  ('am', 'social', NULL, '{handle}\n\nበይፋ እጠይቃለሁ፦\n{demands}\n\nዘመቻውን ይቀላቀሉ፦ {link}');

-- SQLite stores '\n' in a string literal as a literal backslash-n, so every template
-- seeded by 002 (and the rows just inserted above) carries visible escape markers.
-- ponytail: one pass over the whole table repairs old and new rows together.
UPDATE message_templates
  SET body = replace(body, '\n', char(10)),
      subject = replace(subject, '\n', char(10));
