import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { openDatabase } from "../src/db.js";
import {
  DIRECTORY_MAX_QUERY,
  DIRECTORY_MAX_SUGGESTIONS,
  DIRECTORY_PAGE_SIZE,
  getContactableRecipient,
  listContactableRecipients,
  listDirectoryBrowse,
  listNamedRecipients,
  mention,
  parseDirectoryQuery,
  searchDirectory,
  suggestDirectory,
  type DirectoryBrowseItem
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
    assert.ok(browse.some((row) => row.id === 9001 && row.contactable === false && row.list === null && row.party === null));
    assert.ok(browse.some((row) => row.id === actual[0]!.id && row.contactable === true));

    const electionId = Number((db.prepare(`INSERT INTO elections (number, publication_status) VALUES (24, 'historical') RETURNING id`).get() as { id: number }).id);
    db.prepare(`INSERT INTO directory_publications (election_id, version, status, activated_at) VALUES (?, 1, 'active', ?)`).run(electionId, new Date().toISOString());
    assert.ok(listDirectoryBrowse(db, "he").some((row) => row.id === actual[0]!.id));

    assert.equal(mention({ name: "MK Number 3", socialHandle: null }), "MK Number 3");
    assert.equal(mention({ name: "MK Number 2", socialHandle: "@mk_handle" }), "@mk_handle");
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

const fixtureItems: DirectoryBrowseItem[] = [
  { id: 1, name: "Ada Example", type: "politician", contactable: true, list: { id: 10, label: "Blue List", ballotLetters: "ב" }, party: { id: 20, label: "Blue Party" } },
  { id: 2, name: "Bo Other", type: "politician", contactable: false, list: { id: 10, label: "Blue List", ballotLetters: "ב" }, party: null },
  { id: 3, name: "Cal Office", type: "party", contactable: true, list: { id: 11, label: "Other List", ballotLetters: "א" }, party: { id: 21, label: "Other Party" } },
  { id: 4, name: "Ada Twin", type: "politician", contactable: true, list: { id: 11, label: "Other List", ballotLetters: "א" }, party: { id: 20, label: "Blue Party" } }
];

test("parseDirectoryQuery bounds query text and treats clear as empty", () => {
  assert.equal(parseDirectoryQuery({ q: "  x".repeat(80) }).q.length, DIRECTORY_MAX_QUERY);
  assert.deepEqual(parseDirectoryQuery({ q: "Ada", listId: "10", partyId: "20", personId: "1", page: "3", clear: "1" }), {
    q: "", listId: null, partyId: null, personId: null, page: 1, questionVersionId: null
  });
  assert.equal(parseDirectoryQuery({ clear: "1", questionVersionId: "9" }).questionVersionId, 9);
  assert.equal(parseDirectoryQuery({ page: "0" }).page, 1);
  assert.equal(parseDirectoryQuery({ listId: "-2" }).listId, null);
});

test("searchDirectory ranks names, intersects filters, and stays truthful when a filter is missing", () => {
  const byName = searchDirectory(fixtureItems, parseDirectoryQuery({ q: "Ada" }));
  assert.deepEqual(byName.rows.map((row) => row.id), [1, 4]);
  assert.equal(byName.filters.lists.length, 2);
  assert.equal(byName.filters.parties.length, 2);

  const partyAndList = searchDirectory(fixtureItems, parseDirectoryQuery({ q: "", listId: "10", partyId: "20" }));
  assert.deepEqual(partyAndList.rows.map((row) => row.id), [1]);

  const missingParty = searchDirectory(fixtureItems, parseDirectoryQuery({ partyId: "99" }));
  assert.equal(missingParty.total, 0);
  assert.equal(missingParty.rows.length, 0);

  const acrossFields = searchDirectory(fixtureItems, parseDirectoryQuery({ q: "Blue Ada" }));
  assert.deepEqual(acrossFields.rows.map((row) => row.id), [1, 4]);

  const person = searchDirectory(fixtureItems, parseDirectoryQuery({ personId: "2", q: "Bo" }));
  assert.deepEqual(person.rows.map((row) => row.id), [2]);
  assert.equal(person.rows[0]?.contactable, false);
});

test("searchDirectory paginates at 20 and keeps uncontactable rows discoverable", () => {
  const items = Array.from({ length: 21 }, (_, index) => ({
    id: index + 1,
    name: `Person ${String(index + 1).padStart(2, "0")}`,
    type: "politician" as const,
    contactable: index !== 0,
    list: null,
    party: null
  }));
  const first = searchDirectory(items, parseDirectoryQuery({}));
  assert.equal(first.total, 21);
  assert.equal(first.pageCount, 2);
  assert.equal(first.rows.length, DIRECTORY_PAGE_SIZE);
  assert.equal(first.rows[0]?.contactable, false);
  const second = searchDirectory(items, parseDirectoryQuery({ page: "2" }));
  assert.equal(second.page, 2);
  assert.equal(second.rows.length, 1);
});

test("suggestDirectory bounds typed options and never infers missing lists from one letter of a name", () => {
  assert.deepEqual(suggestDirectory(fixtureItems, { q: "", listId: null, partyId: null }), []);
  assert.deepEqual(suggestDirectory(fixtureItems, { q: "A", listId: null, partyId: null }), []);
  const ballot = suggestDirectory(fixtureItems, { q: "ב", listId: null, partyId: null });
  assert.deepEqual(ballot, [{ kind: "list", id: 10, label: "Blue List", context: "ב" }]);

  const typed = suggestDirectory(fixtureItems, { q: "Ada", listId: null, partyId: null });
  assert.ok(typed.some((row) => row.kind === "person" && row.id === 1));
  assert.ok(typed.some((row) => row.kind === "person" && row.id === 4));
  assert.equal(typed.some((row) => row.kind === "person" && row.id === 2), false);
  assert.equal(typed.some((row) => row.kind === "party"), false);

  const partyQuery = suggestDirectory(fixtureItems, { q: "Blue", listId: null, partyId: null });
  assert.ok(partyQuery.some((row) => row.kind === "party" && row.id === 20));
  assert.ok(partyQuery.some((row) => row.kind === "list" && row.id === 10));

  const many = Array.from({ length: 12 }, (_, index) => ({
    id: index + 1,
    name: `Ada ${index}`,
    type: "politician" as const,
    contactable: true,
    list: null,
    party: null
  }));
  assert.equal(suggestDirectory(many, { q: "Ada", listId: null, partyId: null }).length, DIRECTORY_MAX_SUGGESTIONS);
});
