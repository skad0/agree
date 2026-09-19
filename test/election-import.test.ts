import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { openDatabase } from "../src/db.js";
import { activatePublication, importCandidateSource, parseCandidateSource } from "../src/integrations/elections/import.js";
import { directoryElectionState, listDirectoryBrowse, listNamedRecipients } from "../src/recipients.js";

const transcript = {
  schemaVersion: 1,
  electionNumber: 26,
  source: {
    publisher: "Central Elections Committee",
    title: "Submitted candidate lists",
    retrievedAt: "2026-09-13T00:00:00.000Z",
    publishedAt: "2026-09-10T00:00:00.000Z",
    sourceUrl: "https://www.gov.il/he/pages/candidates-lists-26",
    artifactKind: "manual-official-transcript",
    approvalState: "submitted_not_approved",
    notes: null
  },
  lists: [
    { officialListKey: "list-a", listTitleHe: "רשימה א", ballotLetters: "אמת", submittedByHe: "מפלגת א", rosterPublished: true },
    { officialListKey: null, listTitleHe: "רשימה ללא מועמדים", ballotLetters: "מחל", submittedByHe: null, rosterPublished: false }
  ],
  rows: [
    { officialListKey: "list-a", rank: 1, fullNameHe: "כהן ישראל", viaPartyHe: "מפלגת א", cityPublished: null, status: "listed" },
    { officialListKey: "list-a", rank: 2, fullNameHe: "השכל שרן מרים", viaPartyHe: null, cityPublished: "תל אביב", status: "listed" }
  ]
};

function withDb(run: (db: ReturnType<typeof openDatabase>) => void) {
  const dir = mkdtempSync(join(tmpdir(), "agree-election-import-"));
  let handle: ReturnType<typeof openDatabase> | undefined;
  try {
    handle = openDatabase(join(dir, "app.db"));
    run(handle);
  } finally {
    handle?.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

test("parseCandidateSource refuses transcripts that would import as silent half-truths", () => {
  assert.ok(parseCandidateSource(clone(transcript)));

  const gap = clone(transcript);
  gap.rows[1]!.rank = 3;
  assert.throws(() => parseCandidateSource(gap), /contiguous/);

  const unknownList = clone(transcript);
  unknownList.rows[0]!.officialListKey = "list-z";
  assert.throws(() => parseCandidateSource(unknownList), /unknown officialListKey/);

  const emptyRoster = clone(transcript);
  emptyRoster.rows = [];
  assert.throws(() => parseCandidateSource(emptyRoster), /rosterPublished=true but no rows/);

  const claimsNoRoster = clone(transcript);
  claimsNoRoster.lists[0]!.rosterPublished = false;
  assert.throws(() => parseCandidateSource(claimsNoRoster), /rosterPublished=false but carries rows/);

  const approval = clone(transcript);
  (approval.source as { approvalState: string }).approvalState = "probably-fine";
  assert.throws(() => parseCandidateSource(approval), /approvalState/);

  const duplicate = clone(transcript);
  duplicate.rows[1]!.rank = 1;
  assert.throws(() => parseCandidateSource(duplicate), /duplicate rank/);
});

test("import writes a draft that changes nothing on the public directory until it is activated", () => {
  withDb((db) => {
    const raw = JSON.stringify(transcript);
    const source = parseCandidateSource(JSON.parse(raw));
    const before = listNamedRecipients(db, "he").length;

    const result = importCandidateSource(db, source, raw);
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.lists, 2);
    assert.equal(result.candidacies, 2);
    assert.equal(result.listsWithoutRoster, 1);

    assert.equal(db.prepare("SELECT status FROM directory_publications WHERE id = ?").get(result.publicationId)?.status, "draft");
    assert.equal(directoryElectionState(db).kind, "none");
    assert.equal(listNamedRecipients(db, "he").length, before, "no recipient appears before activation");
    assert.equal(db.prepare("SELECT count(*) n FROM source_records").get()?.n, 2);
    assert.equal(
      db.prepare("SELECT full_name_raw AS name FROM candidacy_versions WHERE rank = 2").get()?.name,
      "השכל שרן מרים",
      "the published name is stored whole, not split"
    );
    assert.equal(db.prepare("SELECT given_name_raw AS given FROM candidacy_versions WHERE rank = 2").get()?.given, null);
    assert.equal(db.prepare("SELECT via_party_raw AS via FROM candidacy_versions WHERE rank = 1").get()?.via, "מפלגת א");

    const again = importCandidateSource(db, parseCandidateSource(JSON.parse(raw)), raw);
    assert.equal(again.ok, false);
    if (!again.ok) assert.equal(again.code, "already_imported");
    assert.equal(db.prepare("SELECT count(*) n FROM candidacies").get()?.n, 2, "a repeat import does not duplicate rows");
  });
});

test("activation publishes candidates, labels them unapproved, and keeps Hebrew names readable in other locales", () => {
  withDb((db) => {
    const raw = JSON.stringify(transcript);
    const imported = importCandidateSource(db, parseCandidateSource(JSON.parse(raw)), raw);
    assert.equal(imported.ok, true);
    if (!imported.ok) return;

    const activated = activatePublication(db, imported.publicationId);
    assert.equal(activated.ok, true);
    if (!activated.ok) return;
    assert.equal(activated.recipientsCreated, 2);

    const state = directoryElectionState(db);
    assert.equal(state.kind, "submitted");
    if (state.kind !== "submitted") return;
    assert.equal(state.electionNumber, 26);
    assert.equal(state.listsWithoutRoster, 1, "a submitted list with no roster is reported, not hidden");

    const hebrew = listDirectoryBrowse(db, "he").find((row) => row.name === "כהן ישראל");
    assert.ok(hebrew, "imported candidate is listed in Hebrew");
    assert.equal(hebrew?.list?.label, "רשימה א");
    assert.equal(hebrew?.list?.ballotLetters, "אמת");
    assert.equal(hebrew?.contactable, false, "no channel was imported, so nothing claims to be contactable");

    const english = listDirectoryBrowse(db, "en").find((row) => row.id === hebrew?.id);
    assert.ok(english, "a Hebrew-only name still appears in an English locale");
    assert.equal(english?.nameIsHebrewFallback, true);
    assert.equal(english?.name, "כהן ישראל");

    // Re-activating a second import retires the first set instead of deleting rows that
    // generated_requests and submitted_responses still reference.
    const second = { ...clone(transcript), source: { ...clone(transcript.source), retrievedAt: "2026-09-14T00:00:00.000Z" } };
    const secondRaw = JSON.stringify(second);
    const reimported = importCandidateSource(db, parseCandidateSource(JSON.parse(secondRaw)), secondRaw);
    assert.equal(reimported.ok, true);
    if (!reimported.ok) return;
    const reactivated = activatePublication(db, reimported.publicationId);
    assert.equal(reactivated.ok, true);
    assert.equal(db.prepare("SELECT status FROM directory_publications WHERE id = ?").get(imported.publicationId)?.status, "rolled_back");
    assert.equal(db.prepare("SELECT count(*) n FROM directory_publications WHERE status = 'active'").get()?.n, 1);
    const retired = db.prepare(`SELECT count(*) n FROM recipients r
      JOIN recipient_entity_links l ON l.recipient_id = r.id WHERE r.is_active = 0`).get()?.n;
    assert.equal(retired, 2, "superseded recipients are retired, not deleted");
    assert.equal(db.prepare("SELECT count(*) n FROM recipient_entity_links").get()?.n, 4);
  });
});

test("the shipped 26th Knesset transcript parses and matches its own published counts", () => {
  const raw = readFileSync(join(process.cwd(), "data/elections/knesset-26-lists.json"), "utf8");
  const source = parseCandidateSource(JSON.parse(raw));
  assert.equal(source.electionNumber, 26);
  assert.equal(source.source.approvalState, "submitted_not_approved");
  assert.equal(source.lists.length, 38);
  assert.equal(source.lists.filter((list) => list.rosterPublished).length, 35);
  assert.equal(source.rows.length, 1258);
  assert.ok(source.rows.every((row) => row.fullNameHe.trim().length > 1));
});
