import { createHash } from "node:crypto";
import type { Db } from "../../db.js";
import { insertDirectoryPublication, insertElection, insertSourceSnapshot } from "./repository.js";
import type { CandidateSource, CandidateSourceList, CandidateSourceRow, ImportResult } from "./types.js";

export const TRANSCRIPT_PARSER_VERSION = "transcript-2";

/** Validates a manual official transcript. Rejects rather than repairing: a bad transcript must not become data. */
export function parseCandidateSource(raw: unknown): CandidateSource {
  const doc = expectObject(raw, "root");
  if (doc.schemaVersion !== 1) throw new Error("schemaVersion must be 1");
  if (doc.electionNumber !== 26) throw new Error("Expected electionNumber 26");
  const source = expectObject(doc.source, "source");
  for (const field of ["retrievedAt", "publishedAt"]) if (source[field] != null && !Number.isFinite(Date.parse(String(source[field])))) throw new Error(`Invalid source.${field}`);
  officialUrl(source.sourceUrl);
  const approvalState = expectEnum(source.approvalState, ["submitted_not_approved", "approved"], "source.approvalState");
  const lists = expectArray(doc.lists, "lists").map((entry, index) => parseList(entry, index));
  const rows = expectArray(doc.rows, "rows").map((entry, index) => parseRow(entry, index));

  if (!lists.length) throw new Error("lists must not be empty");
  if (new Set(lists.map(listKey)).size !== lists.length) throw new Error("duplicate officialListKey");
  const byKey = new Map(lists.filter((list) => list.officialListKey).map((list) => [list.officialListKey!, list]));
  const seen = new Set<string>();
  for (const row of rows) {
    if (!byKey.has(row.officialListKey)) throw new Error(`rows[${row.rank}] references unknown officialListKey ${row.officialListKey}`);
    const key = `${row.officialListKey}#${row.rank}`;
    if (seen.has(key)) throw new Error(`duplicate rank ${row.rank} in list ${row.officialListKey}`);
    seen.add(key);
  }
  for (const list of lists) {
    const ranks = rows.filter((row) => row.officialListKey === list.officialListKey).map((row) => row.rank).sort((a, b) => a - b);
    if (list.candidateCount != null && list.candidateCount !== ranks.length) throw new Error(`candidateCount mismatch for ${listKey(list)}`);
    if (!list.rosterPublished) {
      if (ranks.length) throw new Error(`list ${list.listTitleHe} has rosterPublished=false but carries rows`);
      continue;
    }
    if (!ranks.length) throw new Error(`list ${list.listTitleHe} has rosterPublished=true but no rows`);
    if (ranks.some((rank, index) => rank !== index + 1)) throw new Error(`list ${list.listTitleHe} ranks are not contiguous from 1`);
  }

  return {
    schemaVersion: expectNumber(doc.schemaVersion, "schemaVersion"),
    electionNumber: expectNumber(doc.electionNumber, "electionNumber"),
    source: {
      publisher: expectString(source.publisher, "source.publisher"),
      title: expectString(source.title, "source.title"),
      retrievedAt: expectString(source.retrievedAt, "source.retrievedAt"),
      publishedAt: optionalString(source.publishedAt),
      sourceUrl: expectString(source.sourceUrl, "source.sourceUrl"),
      artifactKind: expectString(source.artifactKind, "source.artifactKind"),
      approvalState,
      approvalEvidenceUrl: approvalState === "approved" ? officialUrl(source.approvalEvidenceUrl) : null,
      notes: optionalString(source.notes)
    },
    lists,
    rows
  };
}

export type ImportOptions = { now?: string; artifactRef?: string | null };

/**
 * Writes one transcript as a draft publication. Never activates it: the directory keeps
 * serving the previous publication until an operator runs activate.
 */
export function importCandidateSource(db: Db, source: CandidateSource, raw: string, options: ImportOptions = {}): ImportResult {
  const now = options.now ?? new Date().toISOString();
  source = parseCandidateSource(source);
  const compareKeys = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
  const normalized = {
    ...source,
    source: {...source.source, retrievedAt: undefined},
    lists: [...source.lists].sort((left,right) => compareKeys(listKey(left),listKey(right))),
    rows: [...source.rows].sort((left,right) => compareKeys(left.officialListKey,right.officialListKey) || left.rank-right.rank)
  };
  const contentHash = createHash("sha256").update(JSON.stringify(normalized)).digest("hex");

  const existing = db.prepare(`SELECT id FROM source_snapshots WHERE content_hash = ? AND parser_version = ?`)
    .get(contentHash, TRANSCRIPT_PARSER_VERSION) as { id: number } | undefined;
  if (existing) return { ok: false, code: "already_imported", snapshotId: existing.id };

  db.exec("BEGIN IMMEDIATE");
  try {
    const snapshotId = insertSourceSnapshot(db, {
      source: "cec-transcript",
      resourceId: `knesset-${source.electionNumber}`,
      url: source.source.sourceUrl,
      fetchedAt: source.source.retrievedAt,
      publishedAt: source.source.publishedAt ?? null,
      contentHash,
      parserVersion: TRANSCRIPT_PARSER_VERSION,
      mediaType: "application/json",
      artifactRef: options.artifactRef ?? null,
      extractionState: source.lists.every((list) => list.rosterPublished) ? "complete" : "incomplete"
    });

    const electionId = upsertElection(db, source, snapshotId);
    db.prepare(`INSERT INTO election_snapshot_metadata (snapshot_id,election_id,approval_state,approval_evidence_url,parser_version) VALUES (?,?,?,?,?)`).run(snapshotId,electionId,source.source.approvalState,source.source.approvalEvidenceUrl ?? null,TRANSCRIPT_PARSER_VERSION);
    const listIds = new Map<string, number>();
    for (const list of source.lists) {
      const listId = upsertList(db, electionId, list, snapshotId);
      listIds.set(listKey(list), listId);
      db.prepare(`INSERT INTO electoral_list_versions (snapshot_id,list_id,official_list_key,title_he,ballot_letters,roster_published,submitted_by_raw,source_url,candidate_count) VALUES (?,?,?,?,?,?,?,?,?)`).run(snapshotId,listId,listKey(list),list.listTitleHe,list.ballotLetters,list.rosterPublished ? 1 : 0,list.submittedByHe,list.sourceUrl ?? null,source.rows.filter(row=>row.officialListKey===listKey(list)).length);
    }

    const insertRecord = db.prepare(`INSERT INTO source_records (snapshot_id, record_key, payload_json) VALUES (?, ?, ?) RETURNING id`);
    let candidacies = 0;
    for (const row of source.rows) {
      const listId = listIds.get(row.officialListKey)!;
      const recordId = Number((insertRecord.get(snapshotId, `${row.officialListKey}#${row.rank}`, JSON.stringify(row)) as { id: number }).id);
      const personId = insertPerson(db, row, now);
      const candidacyId = upsertCandidacy(db, electionId, listId, personId);
      db.prepare(`INSERT INTO candidacy_versions
        (candidacy_id, snapshot_id, list_id, source_record_id, rank, full_name_raw, via_party_raw, city_published, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        candidacyId, snapshotId, listId, recordId, row.rank, row.fullNameHe, row.viaPartyHe ?? null, row.cityPublished ?? null, row.status
      );
      candidacies += 1;
    }

    const version = nextPublicationVersion(db, electionId);
    const publicationId = insertDirectoryPublication(db, {
      electionId,
      version,
      status: "draft",
      previousPublicationId: activePublicationId(db, electionId),
      snapshotId
    });

    db.exec("COMMIT");
    return {
      ok: true,
      snapshotId,
      electionId,
      publicationId,
      version,
      lists: listIds.size,
      candidacies,
      listsWithoutRoster: source.lists.filter((list) => !list.rosterPublished).length
    };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

/** Atomically selects a validated snapshot. No contact recipients are created or retired. */
export function activatePublication(db: Db, publicationId: number, options: { now?: string } = {}): ImportResult {
  const now = options.now ?? new Date().toISOString();
  db.exec("BEGIN IMMEDIATE");
  try {
    const row = db.prepare(`SELECT p.id,p.election_id,p.snapshot_id,p.status FROM directory_publications p
      JOIN elections e ON e.id=p.election_id JOIN election_snapshot_metadata m ON m.snapshot_id=p.snapshot_id AND m.election_id=e.id
      WHERE p.id=? AND e.number=26 AND EXISTS (SELECT 1 FROM electoral_list_versions l WHERE l.snapshot_id=p.snapshot_id)`).get(publicationId) as {id:number;election_id:number;snapshot_id:number;status:string}|undefined;
    if (!row) { db.exec("ROLLBACK"); return {ok:false,code:"publication_without_snapshot"}; }
    const invalid = db.prepare(`SELECT count(*) AS n FROM electoral_list_versions l WHERE l.snapshot_id=? AND
      l.candidate_count != (SELECT count(*) FROM candidacy_versions v WHERE v.snapshot_id=l.snapshot_id AND v.list_id=l.list_id)`).get(row.snapshot_id) as {n:number};
    if (invalid.n) throw new Error("Snapshot candidate counts do not match");
    db.prepare("UPDATE directory_publications SET status='rolled_back' WHERE election_id=? AND status='active' AND id<>?").run(row.election_id,row.id);
    db.prepare("UPDATE directory_publications SET status='active',activated_at=? WHERE id=?").run(now,row.id);
    db.exec("COMMIT");
    return {ok:true,publicationId:row.id,electionId:row.election_id,recipientsCreated:0,recipientsReactivated:0};
  } catch (error) { db.exec("ROLLBACK"); throw error; }
}

function listKey(list: CandidateSourceList): string {
  return list.officialListKey ?? `source:${list.sourceUrl ?? list.listTitleHe}`;
}

function upsertElection(db: Db, source: CandidateSource, snapshotId: number): number {
  const existing = db.prepare(`SELECT id FROM elections WHERE number = ?`).get(source.electionNumber) as { id: number } | undefined;
  if (existing) return existing.id;
  const id = insertElection(db, {
    number: source.electionNumber,
    publicationStatus: "announced",
    publishedAt: source.source.publishedAt ?? null,
    snapshotId
  });
  db.prepare(`UPDATE elections SET approval_state = ? WHERE id = ?`).run(source.source.approvalState, id);
  return id;
}

function upsertList(db: Db, electionId: number, list: CandidateSourceList, snapshotId: number): number {
  const key = listKey(list);
  const existing = db.prepare(`SELECT id FROM electoral_lists WHERE election_id = ? AND official_list_key = ?`)
    .get(electionId, key) as { id: number } | undefined;
  if (existing) return existing.id;
  return Number((db.prepare(`INSERT INTO electoral_lists
    (election_id, official_list_key, ballot_letters, title_he, snapshot_id, roster_published, submitted_by_raw)
    VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id`)
    .get(electionId, key, list.ballotLetters, list.listTitleHe, snapshotId, list.rosterPublished ? 1 : 0, list.submittedByHe ?? null) as { id: number }).id);
}

function insertPerson(db: Db, row: CandidateSourceRow, now: string): number {
  return Number((db.prepare(`INSERT INTO people (knesset_person_id, given_name, family_name, display_name, created_at)
    VALUES (NULL, NULL, NULL, ?, ?) RETURNING id`).get(row.fullNameHe, now) as { id: number }).id);
}

function upsertCandidacy(db: Db, electionId: number, listId: number, personId: number): number {
  return Number((db.prepare(`INSERT INTO candidacies (election_id, list_id, person_id, status)
    VALUES (?, ?, ?, 'active') RETURNING id`).get(electionId, listId, personId) as { id: number }).id);
}

function nextPublicationVersion(db: Db, electionId: number): number {
  const row = db.prepare(`SELECT COALESCE(MAX(version), 0) AS version FROM directory_publications WHERE election_id = ?`)
    .get(electionId) as { version: number };
  return Number(row.version) + 1;
}

function activePublicationId(db: Db, electionId: number): number | null {
  const row = db.prepare(`SELECT id FROM directory_publications WHERE election_id = ? AND status = 'active'`)
    .get(electionId) as { id: number } | undefined;
  return row?.id ?? null;
}

function parseList(raw: unknown, index: number): CandidateSourceList {
  const list = expectObject(raw, `lists[${index}]`);
  return {
    officialListKey: optionalString(list.officialListKey),
    listTitleHe: expectString(list.listTitleHe, `lists[${index}].listTitleHe`),
    ballotLetters: optionalString(list.ballotLetters),
    submittedByHe: optionalString(list.submittedByHe),
    sourceUrl: list.sourceUrl == null ? null : officialUrl(list.sourceUrl),
    candidateCount: list.candidateCount == null ? null : expectNumber(list.candidateCount,"candidateCount"),
    rosterPublished: expectBoolean(list.rosterPublished,"rosterPublished")
  };
}

function parseRow(raw: unknown, index: number): CandidateSourceRow {
  const row = expectObject(raw, `rows[${index}]`);
  const rank = expectNumber(row.rank, `rows[${index}].rank`);
  if (!Number.isInteger(rank) || rank < 1) throw new Error(`rows[${index}].rank must be a positive integer`);
  return {
    officialListKey: expectString(row.officialListKey, `rows[${index}].officialListKey`),
    rank,
    fullNameHe: expectString(row.fullNameHe, `rows[${index}].fullNameHe`),
    viaPartyHe: optionalString(row.viaPartyHe),
    cityPublished: optionalString(row.cityPublished),
    status: expectEnum(row.status, ["listed", "withdrawn", "replaced"], `rows[${index}].status`)
  };
}

function expectObject(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  return value as Record<string, unknown>;
}

function expectArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value;
}

function expectString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string`);
  return value.trim();
}

function optionalString(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "string") throw new Error("expected string or null");
  return value.trim() || null;
}

function expectNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be a number`);
  return value;
}

function expectEnum<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) throw new Error(`${label} must be one of ${allowed.join(", ")}`);
  return value as T;
}

function expectBoolean(value: unknown,label:string):boolean { if (typeof value!=="boolean") throw new Error(`${label} must be boolean`); return value; }
function officialUrl(value:unknown):string { const url=new URL(expectString(value,"official source URL")); if(url.protocol!=="https:" || !(url.hostname==="www.gov.il" || url.hostname==="gov.il" || url.hostname==="bechirot.gov.il" || url.hostname.endsWith(".bechirot.gov.il")) || url.username || url.password) throw new Error("Expected official HTTPS source URL"); return url.href; }
