import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { openDatabase } from "../src/db.js";
import {
  getContactableRecipient,
  listContactableRecipients,
  listDirectoryBrowse,
  listNamedRecipients,
  mention
} from "../src/recipients.js";

const previousRequestSql = `SELECT r.id, r.type, rt.name, r.email, r.whatsapp, r.social_handle AS socialHandle FROM recipients r
    JOIN recipient_translations rt ON rt.recipient_id = r.id AND rt.locale = ?
    WHERE r.is_active = 1 AND (NULLIF(TRIM(r.email), '') IS NOT NULL OR NULLIF(TRIM(r.whatsapp), '') IS NOT NULL) ORDER BY rt.name`;

test("listContactableRecipients matches previous request eligibility on seed data", () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-recipients-dir-"));
  try {
    const db = openDatabase(join(dir, "app.db"));
    const expected = db.prepare(previousRequestSql).all("he");
    const actual = listContactableRecipients(db, "he");
    assert.deepEqual(actual, expected);
    assert.ok(actual.length > 1);
    assert.equal(getContactableRecipient(db, "he", actual[0]!.id)?.id, actual[0]!.id);

    const named = listNamedRecipients(db, "he");
    assert.ok(named.length >= actual.length);

    db.prepare("INSERT INTO recipients (id, type, email, whatsapp, is_active) VALUES (9001, 'politician', NULL, NULL, 1)").run();
    db.prepare("INSERT INTO recipient_translations (recipient_id, locale, name) VALUES (9001, 'he', 'אין ערוץ')").run();
    db.prepare("INSERT INTO recipients (id, type, email, is_active) VALUES (9002, 'politician', 'hidden@example.org', 0)").run();
    db.prepare("INSERT INTO recipient_translations (recipient_id, locale, name) VALUES (9002, 'he', 'לא פעיל')").run();

    const after = listContactableRecipients(db, "he");
    assert.equal(after.find((row) => row.id === 9001), undefined);
    assert.equal(after.find((row) => row.id === 9002), undefined);
    assert.ok(listNamedRecipients(db, "he").some((row) => row.id === 9001));
    assert.equal(listNamedRecipients(db, "he").find((row) => row.id === 9002), undefined);
    assert.equal(getContactableRecipient(db, "he", 9001), undefined);

    const browse = listDirectoryBrowse(db, "he");
    assert.ok(browse.some((row) => row.id === 9001 && row.contactable === false));
    assert.ok(browse.some((row) => row.id === actual[0]!.id && row.contactable === true));

    assert.equal(mention({ type: "politician", name: "MK Number 3", socialHandle: null }, "en"), "MK Number 3");
    assert.equal(mention({ type: "politician", name: "MK Number 2", socialHandle: "@mk_handle" }, "en"), "@mk_handle");
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
