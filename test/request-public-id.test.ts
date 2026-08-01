import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

test("request public IDs are backfilled and database-enforced", () => {
  const db = new DatabaseSync(":memory:");
  try {
    const migrations = [
      "001_schema.sql", "002_seed.sql", "003_social_share.sql", "004_campaign_content.sql",
      "005_response_lifecycle.sql", "006_knesset_recipients.sql", "007_uk_locale.sql",
      "008_privacy_retention.sql", "009_privacy_retention_hardening.sql",
      "010_retention_access_indexes.sql", "011_retention_work_indexes.sql"
    ];
    for (const migration of migrations) db.exec(readFileSync(join(process.cwd(), "migrations", migration), "utf8"));
    db.exec("INSERT INTO generated_requests (recipient_id, locale, selected_demands, created_at) VALUES (1, 'en', '[1]', 'before-012'), (1, 'en', '[1]', 'before-012')");
    db.exec(readFileSync(join(process.cwd(), "migrations", "012_generated_request_public_ids.sql"), "utf8"));
    db.exec(readFileSync(join(process.cwd(), "migrations", "013_generated_request_public_id_invariant.sql"), "utf8"));

    const ids = db.prepare("SELECT public_id FROM generated_requests ORDER BY id").all().map((row) => String(row.public_id));
    assert.equal(ids.length, 2);
    assert.equal(new Set(ids).size, 2);
    for (const id of ids) assert.match(id, /^[A-Za-z0-9_-]{43,64}$/);
    assert.throws(() => db.exec("INSERT INTO generated_requests (recipient_id, locale, selected_demands, created_at) VALUES (1, 'en', '[1]', 'bad-null')"));
    assert.throws(() => db.exec("INSERT INTO generated_requests (public_id, recipient_id, locale, selected_demands, created_at) VALUES ('bad!', 1, 'en', '[1]', 'bad-format')"));
    assert.throws(() => db.exec("UPDATE generated_requests SET public_id = '' WHERE id = 1"));
  } finally {
    db.close();
  }
});
