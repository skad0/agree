import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { openDatabase } from "../src/db.js";
import { activatePublication, importCandidateSource, nameTextProblem, parseCandidateSource } from "../src/integrations/elections/import.js";
import { diffTranscripts, renderTranscriptDiff } from "../src/integrations/elections/diff.js";
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
  assert.equal(source.source.approvalState, "approved");
  assert.equal(source.source.approvalEvidenceUrl, "https://www.gov.il/he/pages/candidates-lists-26");
  assert.equal(source.lists.length, 38);
  assert.equal(source.lists.filter((list) => list.running).length, 37);
  assert.equal(source.lists.filter((list) => list.rosterPublished).length, 37);
  const withdrawn = source.lists.filter((list) => !list.running);
  assert.deepEqual(withdrawn.map((list) => list.officialListKey), ["kachol-lavan_list30"]);
  assert.equal(withdrawn[0]!.withdrawnEvidenceUrl, "https://www.gov.il/he/pages/kachol-lavan_list30");
  assert.equal(source.rows.length, 1322);
  assert.equal(new Set(source.lists.map((list) => list.ballotLetters)).size, 38);
  assert.ok(source.rows.every((row) => nameTextProblem(row.fullNameHe) === null));
  assert.ok(source.lists.every((list) => list.pageUpdated && /^2026-\d{2}-\d{2}$/.test(list.pageUpdated)));
});

test("transcript-3 keeps a withdrawn list apart from a list without a roster", () => {
  const withdrawn = clone(transcript) as any;
  withdrawn.lists.push({ officialListKey: "list-w", listTitleHe: "רשימה שפרשה", ballotLetters: "כן", submittedByHe: null,
    rosterPublished: false, running: false, withdrawnEvidenceUrl: "https://www.gov.il/he/pages/list-w", pagePublished: "08.09.2026", pageUpdated: "21.10.2026" });
  const parsed = parseCandidateSource(withdrawn);
  const list = parsed.lists.find((entry) => entry.officialListKey === "list-w")!;
  assert.equal(list.running, false);
  assert.equal(list.pagePublished, "2026-09-08");
  assert.equal(list.pageUpdated, "2026-10-21");
  assert.equal(parsed.lists[0]!.running, true, "a transcript-2 list without the field is running");

  const noEvidence = clone(withdrawn);
  noEvidence.lists[2].withdrawnEvidenceUrl = null;
  assert.throws(() => parseCandidateSource(noEvidence), /without withdrawnEvidenceUrl/);
  const unofficialEvidence = clone(withdrawn);
  unofficialEvidence.lists[2].withdrawnEvidenceUrl = "https://example.org/resigned";
  assert.throws(() => parseCandidateSource(unofficialEvidence), /official HTTPS/);
  const withRows = clone(withdrawn);
  withRows.rows.push({ officialListKey: "list-w", rank: 1, fullNameHe: "גנץ בנימין", viaPartyHe: null, cityPublished: null, status: "listed" });
  assert.throws(() => parseCandidateSource(withRows), /not running but carries a roster/);
  const runningWithEvidence = clone(transcript) as any;
  runningWithEvidence.lists[0].withdrawnEvidenceUrl = "https://www.gov.il/he/pages/list-a";
  assert.throws(() => parseCandidateSource(runningWithEvidence), /running but has withdrawnEvidenceUrl/);
  const badDate = clone(withdrawn);
  badDate.lists[2].pageUpdated = "31.02.2026";
  assert.throws(() => parseCandidateSource(badDate), /must be a date/);
  const urls = clone(transcript) as any;
  urls.lists[0].sourceUrl = "https://www.gov.il/he/pages/list-a";
  urls.lists[0].pageUrl = "https://www.gov.il/he/pages/list-b";
  assert.throws(() => parseCandidateSource(urls), /sourceUrl and pageUrl disagree/);
  delete urls.lists[0].sourceUrl;
  assert.equal(parseCandidateSource(urls).lists[0]!.sourceUrl, "https://www.gov.il/he/pages/list-b");

  withDb((db) => {
    const result = importCandidateSource(db, parsed, JSON.stringify(withdrawn));
    assert.ok(result.ok); if (!result.ok) return;
    assert.equal(result.listsWithoutRoster, 1, "only the running list without a roster counts as missing");
    const row = db.prepare("SELECT running, withdrawn_evidence_url AS evidence, page_updated AS updated FROM electoral_list_versions WHERE official_list_key='list-w'").get() as { running: number; evidence: string; updated: string };
    assert.deepEqual({ ...row }, { running: 0, evidence: "https://www.gov.il/he/pages/list-w", updated: "2026-10-21" });
    assert.equal(activatePublication(db, result.publicationId).ok, true);
    const state = directoryElectionState(db);
    assert.equal(state.kind, "submitted");
    if (state.kind === "submitted") assert.equal(state.listsWithoutRoster, 1);
    assert.equal(candidateLists(db, candidatePublication(db)!.snapshotId).find((entry) => entry.title === "רשימה שפרשה")?.running, 0);
  });
});

test("approved transcripts need final, unique ballot letters", () => {
  const approved = clone(transcript) as any;
  approved.source.approvalState = "approved";
  approved.source.approvalEvidenceUrl = "https://www.gov.il/he/pages/candidates-lists-26";
  assert.ok(parseCandidateSource(approved));
  const duplicate = clone(approved);
  duplicate.lists[1].ballotLetters = "אמת";
  assert.throws(() => parseCandidateSource(duplicate), /must be unique/);
  const missing = clone(approved);
  missing.lists[1].ballotLetters = null;
  assert.throws(() => parseCandidateSource(missing), /must all carry ballot letters/);
  const submitted = clone(transcript) as any;
  submitted.lists[1].ballotLetters = "אמת";
  assert.ok(parseCandidateSource(submitted), "submitted letters may still collide");
});

test("damaged name text and disagreeing row labels are refused, not repaired", () => {
  for (const [name, problem] of [
    ["גרוסמן ידידיה-", /punctuation/],
    ["אלקרינאוי ,טלאל", /space before a comma/],
    ["בר -שלום יוסף", /one side only/],
    ["כהן  ישראל", /repeated whitespace/],
    ["Cohen ישראל", /Latin/],
    ["כהן", /single token/]
  ] as const) {
    const damaged = clone(transcript);
    damaged.rows[0]!.fullNameHe = name;
    assert.throws(() => parseCandidateSource(damaged), problem, name);
  }
  for (const name of ["אלקרינאוי, טלאל", "בר - שלום יוסף", "גרוסמן ידידיה-חיים", "חאג' יחיא מטאנע"]) assert.equal(nameTextProblem(name), null, name);

  const reflowed = clone(transcript) as any;
  reflowed.lists[0].submittedByHe = "מטעם מפלגת יש עתיד -בראשות יאיר לפיד";
  assert.throws(() => parseCandidateSource(reflowed), /submittedByHe looks damaged/);
  reflowed.lists[0].submittedByHe = "מטעם מפלגת יש עתיד - בראשות יאיר לפיד";
  assert.ok(parseCandidateSource(reflowed));
  reflowed.lists[0].listTitleHe = "הליכוד ,תנועה לאומית";
  assert.throws(() => parseCandidateSource(reflowed), /listTitleHe looks damaged/);

  const labelled = clone(transcript) as any;
  labelled.rows[0].listTitleHe = "רשימה א";
  labelled.rows[0].ballotLetters = "אמת";
  assert.ok(parseCandidateSource(labelled));
  labelled.rows[0].listTitleHe = "רשימה אחרת";
  assert.throws(() => parseCandidateSource(labelled), /listTitleHe disagrees/);
});

test("transcript diff classifies truncation, punctuation, spelling, removal and list changes", () => {
  const before = clone(transcript) as any;
  before.rows.push(
    { officialListKey: "list-a", rank: 3, fullNameHe: "גרוסמן ידידיה-חיים", viaPartyHe: null, cityPublished: null, status: "listed" },
    { officialListKey: "list-a", rank: 4, fullNameHe: "מזלתרים מאיר", viaPartyHe: null, cityPublished: null, status: "listed" },
    { officialListKey: "list-a", rank: 5, fullNameHe: "יוגב מוטי", viaPartyHe: null, cityPublished: null, status: "listed" }
  );
  const after = clone(before);
  after.lists[0].ballotLetters = "א";
  after.rows = [
    after.rows[0],
    { ...after.rows[2], rank: 2, fullNameHe: "גרוסמן ידידיה-" },
    { ...after.rows[3], rank: 3, fullNameHe: "מזל תרים מאיר" },
    { ...after.rows[4], rank: 4, fullNameHe: "יוגב מטי" }
  ];
  const diff = diffTranscripts(before, after);
  const kinds = Object.fromEntries(diff.names.map((change) => [change.oldName ?? change.newName, change.kind]));
  assert.deepEqual(kinds, { "גרוסמן ידידיה-חיים": "truncated", "מזלתרים מאיר": "punctuation", "יוגב מוטי": "spelling", "השכל שרן מרים": "removed" });
  assert.equal(diff.lists.length, 1);
  assert.equal(diff.lists[0]!.oldLetters, "אמת");
  const rendered = renderTranscriptDiff(diff);
  assert.match(rendered, /Rows: 5 → 4\./);
  assert.match(rendered, /truncated 1, punctuation 1, spelling 1, removed 1, added 0/);
});
