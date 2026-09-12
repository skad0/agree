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

/** Stages lists/candidacies and opens a draft publication only. Never activates. */
export function importCecClosedListArtifact(db: Db, artifact: CecClosedListArtifact, options: {
  targetElectionNumber: number;
  artifactRef: string;
}): CecArtifactImportResult {
  if (artifact.electionNumber !== options.targetElectionNumber) {
    throw new Error(`Artifact election ${artifact.electionNumber} does not match configured target ${options.targetElectionNumber}`);
  }
  const payload = Buffer.from(JSON.stringify(artifact), "utf8");
  const contentHash = createHash("sha256").update(payload).digest("hex");
  const url = artifact.source.sourceUrl?.trim() || `artifact://${options.artifactRef}`;

  db.exec("BEGIN IMMEDIATE");
  try {
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

    let electionId = getElectionByNumber(db, artifact.electionNumber)?.id;
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

    const listIds = new Map<string, number>();
    let candidacyCount = 0;
    for (const row of artifact.rows) {
      const listKey = (row.officialListKey?.trim() || `${row.ballotLetters ?? ""}|${row.listTitleHe}`).trim();
      let listId = listIds.get(listKey);
      if (!listId) {
        const existing = db.prepare(`SELECT id FROM electoral_lists WHERE election_id = ? AND official_list_key = ?`)
          .get(electionId, listKey) as { id: number } | undefined;
        listId = existing?.id ?? Number((db.prepare(`INSERT INTO electoral_lists
          (election_id, official_list_key, ballot_letters, title_he, source_revision, snapshot_id)
          VALUES (?, ?, ?, ?, ?, ?) RETURNING id`).get(
          electionId, listKey, row.ballotLetters, row.listTitleHe, contentHash.slice(0, 16), snapshotId
        ) as { id: number }).id);
        listIds.set(listKey, listId);
      }

      const displayName = `${row.givenNameHe} ${row.familyNameHe}`.trim();
      const personId = Number((db.prepare(`INSERT INTO people (given_name, family_name, display_name, created_at)
        VALUES (?, ?, ?, ?) RETURNING id`).get(row.givenNameHe, row.familyNameHe, displayName, artifact.source.retrievedAt) as { id: number }).id);

      const recordKey = `${listKey}#${row.rank}`;
      const sourceRecordId = Number((db.prepare(`INSERT INTO source_records (snapshot_id, record_key, payload_json, payload_schema_version)
        VALUES (?, ?, ?, 1) RETURNING id`).get(snapshotId, recordKey, JSON.stringify(row)) as { id: number }).id);

      const candidacyId = Number((db.prepare(`INSERT INTO candidacies (election_id, list_id, person_id, status)
        VALUES (?, ?, ?, 'active') RETURNING id`).get(electionId, listId, personId) as { id: number }).id);

      db.prepare(`INSERT INTO candidacy_versions
        (candidacy_id, snapshot_id, list_id, source_record_id, rank, given_name_raw, family_name_raw, city_published, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        candidacyId, snapshotId, listId, sourceRecordId, row.rank, row.givenNameHe, row.familyNameHe,
        row.cityPublished ?? null, row.status ?? "listed"
      );
      candidacyCount += 1;
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
      contentHash
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
