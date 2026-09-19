import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { openDatabase } from "../src/db.js";
import { activatePublication, importCandidateSource, parseCandidateSource } from "../src/integrations/elections/import.js";
import { directoryElectionState, listNamedRecipients } from "../src/recipients.js";

import { candidateLists, candidateRows, candidatePublication } from "../src/candidates.js";

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

  assert.throws(() => parseCandidateSource({...transcript,electionNumber:25}), /electionNumber/);
  assert.throws(() => parseCandidateSource({...transcript,schemaVersion:2}), /schemaVersion/);
  assert.throws(() => parseCandidateSource({...transcript,lists:[...transcript.lists,transcript.lists[0]]}), /duplicate officialListKey/);
  const invalidBoolean=clone(transcript) as any;invalidBoolean.lists[0].rosterPublished="false";
  assert.throws(() => parseCandidateSource(invalidBoolean), /must be boolean/);
  const invalidCount=clone(transcript) as any;invalidCount.lists[0].candidateCount=3;
  assert.throws(() => parseCandidateSource(invalidCount), /candidateCount mismatch/);
  const approved=clone(transcript) as any;approved.source.approvalState="approved";
  assert.throws(() => parseCandidateSource(approved), /official source URL/);
  approved.source.approvalEvidenceUrl="https://example.org/claims-approval";
  assert.throws(() => parseCandidateSource(approved), /official HTTPS/);
  approved.source.approvalEvidenceUrl="https://www.gov.il/he/pages/candidates-lists-26";
  assert.equal(parseCandidateSource(approved).source.approvalState,"approved");
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

test("activation and rollback select immutable snapshots without changing contacts", () => {
  withDb(db => {
    const contacts=JSON.stringify(db.prepare("SELECT * FROM recipients").all());
    const first=importCandidateSource(db,parseCandidateSource(transcript),JSON.stringify(transcript));
    assert.ok(first.ok); if(!first.ok) return;
    assert.equal(activatePublication(db,first.publicationId).ok,true);
    assert.equal(directoryElectionState(db).kind,"submitted");
    const current=candidatePublication(db)!;
    assert.equal(candidateRows(db,current.snapshotId)[0]?.name,"כהן ישראל");
    const changed=clone(transcript);
    changed.lists[0]!.listTitleHe="שם חדש";
    changed.source.title="Changed source title";
    const second=importCandidateSource(db,parseCandidateSource(changed),JSON.stringify(changed));
    assert.ok(second.ok); if(!second.ok) return;
    assert.equal(candidatePublication(db)?.id,first.publicationId,"draft cannot alter published pointer");
    assert.equal(candidateLists(db,current.snapshotId).find(l=>l.roster)?.title,"רשימה א");
    assert.equal(activatePublication(db,second.publicationId).ok,true);
    assert.equal(candidateLists(db,candidatePublication(db)!.snapshotId).find(l=>l.roster)?.title,"שם חדש");
    assert.equal(activatePublication(db,first.publicationId).ok,true);
    assert.equal(candidatePublication(db)?.id,first.publicationId);
    assert.equal(db.prepare("SELECT count(*) n FROM directory_publications WHERE status='active'").get()?.n,1);
    assert.equal(JSON.stringify(db.prepare("SELECT * FROM recipients").all()),contacts);
    assert.equal(db.prepare("SELECT count(*) n FROM recipient_entity_links").get()?.n,0);
    const fetchedAgain=clone(transcript);fetchedAgain.source.retrievedAt="2026-09-19T00:00:00Z";
    fetchedAgain.lists.reverse();fetchedAgain.rows.reverse();
    const duplicate=importCandidateSource(db,parseCandidateSource(fetchedAgain),JSON.stringify(fetchedAgain));
    assert.equal(duplicate.ok,false); if(!duplicate.ok) assert.equal(duplicate.code,"already_imported");
    db.prepare("UPDATE election_snapshot_metadata SET approval_state='unknown' WHERE snapshot_id=?").run(first.snapshotId!);
    assert.equal(directoryElectionState(db).kind,"unknown");
  });
});

test("the shipped 26th Knesset transcript parses and matches its own published counts", () => {
  const raw = readFileSync(join(process.cwd(), "data/elections/knesset-26-lists.json"), "utf8");
  const source = parseCandidateSource(JSON.parse(raw));
  assert.equal(source.electionNumber, 26);
  assert.equal(source.source.approvalState, "submitted_not_approved");
  assert.equal(source.lists.length, 38);
  assert.equal(source.lists.filter((list) => list.rosterPublished).length, 38);
  assert.equal(source.rows.length, 1379);
  assert.ok(source.rows.every((row) => row.fullNameHe.trim().length > 1));
});
