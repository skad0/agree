import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { Db } from "../../db.js";
import {
  getElectionByNumber,
  insertDirectoryPublication,
  insertElection,
  insertSourceSnapshot
} from "./repository.js";

export const CEC_ARTIFACT_PARSER_VERSION = "cec-closed-list-artifact/v1";

export type CecArtifactRow = {
  listTitleHe: string;
  ballotLetters: string | null;
  rank: number;
  familyNameHe: string;
  givenNameHe: string;
  officialListKey?: string | null;
  cityPublished?: string | null;
  status?: "listed" | "withdrawn" | "replaced";
};

export type CecClosedListArtifact = {
  schemaVersion: 1;
  electionNumber: number;
  source: {
    publisher: string;
    title: string;
    retrievedAt: string;
    publishedAt?: string | null;
    sourceUrl?: string | null;
    artifactKind: "official-export" | "manual-official-transcript" | "fixture";
    notes?: string | null;
  };
  rows: CecArtifactRow[];
};

export type CecArtifactImportResult = {
  ok: true;
  electionNumber: number;
  electionId: number;
  snapshotId: number;
  publicationId: number;
  publicationStatus: "draft";
  listCount: number;
  candidacyCount: number;
  rowCount: number;
  contentHash: string;
  /** True when an identical draft already existed and nothing was written. */
  unchanged: boolean;
  /** Prior draft publication ids rolled back by this import (never includes active). */
  replacedDraftPublicationIds: number[];
  /** Active publication for this election, if any — left untouched. */
  activePublicationId: number | null;
  listsCreated: number;
  listsUpdated: number;
  peopleCreated: number;
  candidaciesReused: number;
};

export function loadCecClosedListArtifact(path: string): CecClosedListArtifact {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new Error("CEC closed-list artifact is missing or not valid JSON");
  }
  return parseCecClosedListArtifact(raw);
}

export function parseCecClosedListArtifact(raw: unknown): CecClosedListArtifact {
  if (!isRecord(raw)) throw new Error("CEC artifact must be an object");
  if (raw.schemaVersion !== 1) throw new Error("CEC artifact schemaVersion must be 1");
  const electionNumber = asPositiveInt(raw.electionNumber, "electionNumber");
  if (!isRecord(raw.source)) throw new Error("CEC artifact source is required");
  const source = {
    publisher: asNonEmpty(raw.source.publisher, "source.publisher"),
    title: asNonEmpty(raw.source.title, "source.title"),
    retrievedAt: asNonEmpty(raw.source.retrievedAt, "source.retrievedAt"),
    publishedAt: raw.source.publishedAt == null ? null : asNonEmpty(String(raw.source.publishedAt), "source.publishedAt"),
    sourceUrl: raw.source.sourceUrl == null ? null : asNonEmpty(String(raw.source.sourceUrl), "source.sourceUrl"),
    artifactKind: asArtifactKind(raw.source.artifactKind),
    notes: raw.source.notes == null ? null : String(raw.source.notes)
  };
  if (!Array.isArray(raw.rows) || raw.rows.length === 0) throw new Error("CEC artifact rows must be a non-empty array");
  const rows = raw.rows.map((row, index) => parseRow(row, `rows[${index}]`));
  assertNoDuplicateRanks(rows);
  return { schemaVersion: 1, electionNumber, source, rows };
}

/**
 * Stages lists/candidacies and opens a draft publication only. Never activates.
 * By default replaces prior **draft** publications for the same election (idempotent refresh).
 * Active and accepted publications are never modified.
 */
export function importCecClosedListArtifact(db: Db, artifact: CecClosedListArtifact, options: {
  targetElectionNumber: number;
  artifactRef: string;
  /** When true (default), roll back existing drafts for this election before inserting a new draft. */
  replaceDraft?: boolean;
}): CecArtifactImportResult {
  if (artifact.electionNumber !== options.targetElectionNumber) {
    throw new Error(`Artifact election ${artifact.electionNumber} does not match configured target ${options.targetElectionNumber}`);
  }
  const replaceDraft = options.replaceDraft !== false;
  const payload = Buffer.from(JSON.stringify(artifact), "utf8");
  const contentHash = createHash("sha256").update(payload).digest("hex");
  const url = artifact.source.sourceUrl?.trim() || `artifact://${options.artifactRef}`;

  db.exec("BEGIN IMMEDIATE");
  try {
    let electionId = getElectionByNumber(db, artifact.electionNumber)?.id;
    const active = electionId
      ? db.prepare(`SELECT id FROM directory_publications WHERE election_id = ? AND status = 'active'`)
        .get(electionId) as { id: number } | undefined
      : undefined;

    if (replaceDraft && electionId) {
      const sameDraft = db.prepare(`SELECT p.id AS publicationId, p.snapshot_id AS snapshotId
        FROM directory_publications p
        JOIN source_snapshots s ON s.id = p.snapshot_id
        WHERE p.election_id = ? AND p.status = 'draft' AND s.content_hash = ?
        ORDER BY p.version DESC LIMIT 1`).get(electionId, contentHash) as
        { publicationId: number; snapshotId: number } | undefined;
      if (sameDraft) {
        const listCount = Number((db.prepare(`SELECT count(*) AS n FROM electoral_lists WHERE election_id = ?`).get(electionId) as { n: number }).n);
        const candidacyCount = Number((db.prepare(`SELECT count(*) AS n FROM candidacy_versions WHERE snapshot_id = ?`).get(sameDraft.snapshotId) as { n: number }).n);
        db.exec("COMMIT");
        return {
          ok: true,
          electionNumber: artifact.electionNumber,
          electionId,
          snapshotId: sameDraft.snapshotId,
          publicationId: sameDraft.publicationId,
          publicationStatus: "draft",
          listCount,
          candidacyCount,
          rowCount: artifact.rows.length,
          contentHash,
          unchanged: true,
          replacedDraftPublicationIds: [],
          activePublicationId: active?.id ?? null,
          listsCreated: 0,
          listsUpdated: 0,
          peopleCreated: 0,
          candidaciesReused: 0
        };
      }
    }

    const snapshotId = insertSourceSnapshot(db, {
      source: "cec-closed-list-artifact",
      resourceId: `election-${artifact.electionNumber}`,
      url,
      fetchedAt: artifact.source.retrievedAt,
      publishedAt: artifact.source.publishedAt,
      contentHash,
      parserVersion: CEC_ARTIFACT_PARSER_VERSION,
      mediaType: "application/json",
      artifactRef: options.artifactRef,
      extractionState: "complete"
    });

    if (!electionId) {
      electionId = insertElection(db, {
        number: artifact.electionNumber,
        titleHe: `בחירות לכנסת ה-${artifact.electionNumber}`,
        publicationStatus: "lists_published",
        publishedAt: artifact.source.publishedAt,
        snapshotId
      });
    } else {
      db.prepare(`UPDATE elections SET publication_status = 'lists_published', published_at = COALESCE(?, published_at), snapshot_id = ? WHERE id = ?`)
        .run(artifact.source.publishedAt ?? null, snapshotId, electionId);
    }

    const replacedDraftPublicationIds: number[] = [];
    let previousDraftSnapshotId: number | null = null;
    if (replaceDraft) {
      const drafts = db.prepare(`SELECT id, snapshot_id AS snapshotId FROM directory_publications
        WHERE election_id = ? AND status = 'draft' ORDER BY version ASC`).all(electionId) as { id: number; snapshotId: number | null }[];
      for (const draft of drafts) {
        previousDraftSnapshotId = draft.snapshotId;
        db.prepare(`UPDATE directory_publications SET status = 'rolled_back' WHERE id = ? AND status = 'draft'`).run(draft.id);
        replacedDraftPublicationIds.push(draft.id);
      }
    }

    const listIds = new Map<string, number>();
    let candidacyCount = 0;
    let listsCreated = 0;
    let listsUpdated = 0;
    let peopleCreated = 0;
    let candidaciesReused = 0;

    for (const row of artifact.rows) {
      const listKey = (row.officialListKey?.trim() || `${row.ballotLetters ?? ""}|${row.listTitleHe}`).trim();
      let listId = listIds.get(listKey);
      if (!listId) {
        const existing = db.prepare(`SELECT id FROM electoral_lists WHERE election_id = ? AND official_list_key = ?`)
          .get(electionId, listKey) as { id: number } | undefined;
        if (existing) {
          listId = existing.id;
          db.prepare(`UPDATE electoral_lists SET ballot_letters = ?, title_he = ?, source_revision = ?, snapshot_id = ? WHERE id = ?`)
            .run(row.ballotLetters, row.listTitleHe, contentHash.slice(0, 16), snapshotId, listId);
          listsUpdated += 1;
        } else {
          listId = Number((db.prepare(`INSERT INTO electoral_lists
            (election_id, official_list_key, ballot_letters, title_he, source_revision, snapshot_id)
            VALUES (?, ?, ?, ?, ?, ?) RETURNING id`).get(
            electionId, listKey, row.ballotLetters, row.listTitleHe, contentHash.slice(0, 16), snapshotId
          ) as { id: number }).id);
          listsCreated += 1;
        }
        listIds.set(listKey, listId);
      }

      const prior = db.prepare(`SELECT cv.candidacy_id AS candidacyId, c.person_id AS personId
        FROM candidacy_versions cv
        JOIN candidacies c ON c.id = cv.candidacy_id
        WHERE cv.list_id = ? AND cv.rank = ? AND c.election_id = ?
        ORDER BY cv.snapshot_id DESC LIMIT 1`).get(listId, row.rank, electionId) as
        { candidacyId: number; personId: number } | undefined;

      let candidacyId: number;
      let personId: number;
      if (prior) {
        candidacyId = prior.candidacyId;
        personId = prior.personId;
        candidaciesReused += 1;
        db.prepare(`UPDATE people SET given_name = ?, family_name = ?, display_name = ? WHERE id = ?`)
          .run(row.givenNameHe, row.familyNameHe, `${row.givenNameHe} ${row.familyNameHe}`.trim(), personId);
        db.prepare(`UPDATE candidacies SET status = 'active', list_id = ? WHERE id = ?`).run(listId, candidacyId);
      } else {
        const displayName = `${row.givenNameHe} ${row.familyNameHe}`.trim();
        personId = Number((db.prepare(`INSERT INTO people (given_name, family_name, display_name, created_at)
          VALUES (?, ?, ?, ?) RETURNING id`).get(row.givenNameHe, row.familyNameHe, displayName, artifact.source.retrievedAt) as { id: number }).id);
        peopleCreated += 1;
        candidacyId = Number((db.prepare(`INSERT INTO candidacies (election_id, list_id, person_id, status)
          VALUES (?, ?, ?, 'active') RETURNING id`).get(electionId, listId, personId) as { id: number }).id);
      }

      const recordKey = `${listKey}#${row.rank}`;
      const sourceRecordId = Number((db.prepare(`INSERT INTO source_records (snapshot_id, record_key, payload_json, payload_schema_version)
        VALUES (?, ?, ?, 1) RETURNING id`).get(snapshotId, recordKey, JSON.stringify(row)) as { id: number }).id);

      db.prepare(`INSERT INTO candidacy_versions
        (candidacy_id, snapshot_id, list_id, source_record_id, rank, given_name_raw, family_name_raw, city_published, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        candidacyId, snapshotId, listId, sourceRecordId, row.rank, row.givenNameHe, row.familyNameHe,
        row.cityPublished ?? null, row.status ?? "listed"
      );
      candidacyCount += 1;
    }

    if (previousDraftSnapshotId != null) {
      const activeSnapshotId = active
        ? (db.prepare(`SELECT snapshot_id AS snapshotId FROM directory_publications WHERE id = ?`).get(active.id) as { snapshotId: number | null } | undefined)?.snapshotId ?? null
        : null;
      const stale = db.prepare(`SELECT DISTINCT c.id AS candidacyId
        FROM candidacy_versions cv
        JOIN candidacies c ON c.id = cv.candidacy_id
        WHERE cv.snapshot_id = ? AND c.election_id = ?
          AND NOT EXISTS (
            SELECT 1 FROM candidacy_versions nv WHERE nv.candidacy_id = c.id AND nv.snapshot_id = ?
          )
          AND (? IS NULL OR NOT EXISTS (
            SELECT 1 FROM candidacy_versions av WHERE av.candidacy_id = c.id AND av.snapshot_id = ?
          ))`).all(
        previousDraftSnapshotId, electionId, snapshotId, activeSnapshotId, activeSnapshotId
      ) as { candidacyId: number }[];
      for (const row of stale) {
        db.prepare(`UPDATE candidacies SET status = 'withdrawn' WHERE id = ?`).run(row.candidacyId);
      }
    }

    const version = Number((db.prepare(`SELECT COALESCE(MAX(version), 0) + 1 AS version FROM directory_publications WHERE election_id = ?`)
      .get(electionId) as { version: number }).version);
    const publicationId = insertDirectoryPublication(db, {
      electionId,
      version,
      status: "draft",
      snapshotId
    });

    db.exec("COMMIT");
    return {
      ok: true,
      electionNumber: artifact.electionNumber,
      electionId,
      snapshotId,
      publicationId,
      publicationStatus: "draft",
      listCount: listIds.size,
      candidacyCount,
      rowCount: artifact.rows.length,
      contentHash,
      unchanged: false,
      replacedDraftPublicationIds,
      activePublicationId: active?.id ?? null,
      listsCreated,
      listsUpdated,
      peopleCreated,
      candidaciesReused
    };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function parseRow(raw: unknown, path: string): CecArtifactRow {
  if (!isRecord(raw)) throw new Error(`${path} must be an object`);
  return {
    listTitleHe: asNonEmpty(raw.listTitleHe, `${path}.listTitleHe`),
    ballotLetters: raw.ballotLetters == null || raw.ballotLetters === "" ? null : asNonEmpty(String(raw.ballotLetters), `${path}.ballotLetters`),
    rank: asPositiveInt(raw.rank, `${path}.rank`),
    familyNameHe: asNonEmpty(raw.familyNameHe, `${path}.familyNameHe`),
    givenNameHe: asNonEmpty(raw.givenNameHe, `${path}.givenNameHe`),
    officialListKey: raw.officialListKey == null ? null : asNonEmpty(String(raw.officialListKey), `${path}.officialListKey`),
    cityPublished: raw.cityPublished == null || raw.cityPublished === "" ? null : String(raw.cityPublished),
    status: raw.status === undefined ? "listed" : asStatus(raw.status, `${path}.status`)
  };
}

function assertNoDuplicateRanks(rows: CecArtifactRow[]): void {
  const seen = new Set<string>();
  for (const row of rows) {
    const key = `${row.officialListKey ?? row.ballotLetters ?? ""}|${row.listTitleHe}|${row.rank}`;
    if (seen.has(key)) throw new Error(`Duplicate rank ${row.rank} for list ${row.listTitleHe}`);
    seen.add(key);
  }
}

function asArtifactKind(raw: unknown): CecClosedListArtifact["source"]["artifactKind"] {
  if (raw === "official-export" || raw === "manual-official-transcript" || raw === "fixture") return raw;
  throw new Error("source.artifactKind must be official-export, manual-official-transcript, or fixture");
}

function asStatus(raw: unknown, path: string): "listed" | "withdrawn" | "replaced" {
  if (raw === "listed" || raw === "withdrawn" || raw === "replaced") return raw;
  throw new Error(`${path} must be listed, withdrawn, or replaced`);
}

function asNonEmpty(raw: unknown, path: string): string {
  if (typeof raw !== "string" || !raw.trim()) throw new Error(`${path} must be a non-empty string`);
  return raw.trim();
}

function asPositiveInt(raw: unknown, path: string): number {
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw <= 0) throw new Error(`${path} must be a positive integer`);
  return raw;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
