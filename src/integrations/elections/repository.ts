import type { Db } from "../../db.js";
import type { DirectoryPublicationRow, ElectionCoverage, ElectionRow, SourceSnapshotRow } from "./types.js";

export function insertSourceSnapshot(db: Db, row: {
  source: string;
  resourceId?: string | null;
  url: string;
  fetchedAt: string;
  publishedAt?: string | null;
  contentHash: string;
  parserVersion: string;
  mediaType?: string | null;
  artifactRef?: string | null;
  extractionState: "pending" | "complete" | "incomplete" | "failed" | "blocked";
}): number {
  const inserted = db.prepare(`INSERT INTO source_snapshots
    (source, resource_id, url, fetched_at, published_at, content_hash, parser_version, media_type, artifact_ref, extraction_state)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`).get(
    row.source, row.resourceId ?? null, row.url, row.fetchedAt, row.publishedAt ?? null, row.contentHash,
    row.parserVersion, row.mediaType ?? null, row.artifactRef ?? null, row.extractionState
  ) as { id: number };
  return inserted.id;
}

export function getSourceSnapshot(db: Db, id: number): SourceSnapshotRow | undefined {
  return db.prepare(`SELECT id, source, resource_id, url, fetched_at, published_at, content_hash, parser_version, media_type, artifact_ref, extraction_state
    FROM source_snapshots WHERE id = ?`).get(id) as SourceSnapshotRow | undefined;
}

export function insertElection(db: Db, row: {
  number: number;
  titleHe?: string | null;
  publicationStatus: "announced" | "lists_published" | "held" | "historical" | "unknown";
  publishedAt?: string | null;
  snapshotId?: number | null;
}): number {
  const inserted = db.prepare(`INSERT INTO elections (number, title_he, publication_status, published_at, snapshot_id)
    VALUES (?, ?, ?, ?, ?) RETURNING id`).get(
    row.number, row.titleHe ?? null, row.publicationStatus, row.publishedAt ?? null, row.snapshotId ?? null
  ) as { id: number };
  return inserted.id;
}

export function getElectionByNumber(db: Db, number: number): ElectionRow | undefined {
  return db.prepare(`SELECT id, number, title_he, publication_status, published_at, snapshot_id FROM elections WHERE number = ?`)
    .get(number) as ElectionRow | undefined;
}

export function insertDirectoryPublication(db: Db, row: {
  electionId: number;
  version: number;
  status: "draft" | "accepted" | "active" | "rolled_back";
  previousPublicationId?: number | null;
  snapshotId?: number | null;
  activatedAt?: string | null;
}): number {
  const inserted = db.prepare(`INSERT INTO directory_publications
    (election_id, version, status, previous_publication_id, snapshot_id, activated_at)
    VALUES (?, ?, ?, ?, ?, ?) RETURNING id`).get(
    row.electionId, row.version, row.status, row.previousPublicationId ?? null, row.snapshotId ?? null, row.activatedAt ?? null
  ) as { id: number };
  return inserted.id;
}

export function getDirectoryPublication(db: Db, id: number): DirectoryPublicationRow | undefined {
  return db.prepare(`SELECT id, election_id, version, status, previous_publication_id, snapshot_id, activated_at
    FROM directory_publications WHERE id = ?`).get(id) as DirectoryPublicationRow | undefined;
}

export function electionCoverage(db: Db): ElectionCoverage {
  const count = (sql: string) => Number((db.prepare(sql).get() as { n: number }).n);
  return {
    elections: count("SELECT count(*) n FROM elections"),
    electoralLists: count("SELECT count(*) n FROM electoral_lists"),
    people: count("SELECT count(*) n FROM people"),
    candidacies: count("SELECT count(*) n FROM candidacies"),
    activePublications: count("SELECT count(*) n FROM directory_publications WHERE status = 'active'")
  };
}
