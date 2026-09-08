import { randomUUID } from "node:crypto";
import type { Db } from "../../db.js";
import type { JobLease } from "./types.js";

const DEFAULT_LEASE_MS = 60_000;

export function ensureEtlJob(db: Db, row: {
  dedupeKey: string;
  source: string;
  stage: string;
  electionId?: number | null;
  attemptBudget?: number;
  nextAttemptAt?: string | null;
}): number {
  const existing = db.prepare("SELECT id FROM etl_jobs WHERE dedupe_key = ?").get(row.dedupeKey) as { id: number } | undefined;
  if (existing) return existing.id;
  const inserted = db.prepare(`INSERT INTO etl_jobs
    (dedupe_key, source, election_id, stage, state, attempt_budget, attempts, next_attempt_at)
    VALUES (?, ?, ?, ?, 'pending', ?, 0, ?) RETURNING id`).get(
    row.dedupeKey,
    row.source,
    row.electionId ?? null,
    row.stage,
    row.attemptBudget ?? 5,
    row.nextAttemptAt ?? null
  ) as { id: number };
  return inserted.id;
}

export function acquireJobLease(db: Db, jobId: number, now = new Date(), leaseMs = DEFAULT_LEASE_MS): JobLease | undefined {
  const token = randomUUID();
  const nowIso = now.toISOString();
  const expiresAt = new Date(now.getTime() + leaseMs).toISOString();
  const result = db.prepare(`UPDATE etl_jobs
    SET state = 'running', lease_token = ?, lease_expires_at = ?, attempts = attempts + 1
    WHERE id = ?
      AND attempts < attempt_budget
      AND (lease_token IS NULL OR lease_expires_at IS NULL OR lease_expires_at < ?)
      AND state IN ('pending', 'retry', 'running')`).run(token, expiresAt, jobId, nowIso);
  if (result.changes !== 1) return undefined;
  return { jobId, token, expiresAt };
}

export function checkpointJob(db: Db, lease: JobLease, stage: string, cursor?: Record<string, unknown>, now = new Date()): boolean {
  if (!verifyLeaseToken(db, lease, now)) return false;
  const cursorJson = cursor ? JSON.stringify(cursor) : null;
  db.prepare(`INSERT INTO etl_checkpoints (job_id, stage, lease_token, cursor_json, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(job_id, stage) DO UPDATE SET
      lease_token = excluded.lease_token,
      cursor_json = excluded.cursor_json,
      updated_at = excluded.updated_at`).run(lease.jobId, stage, lease.token, cursorJson, now.toISOString());
  return true;
}

export function releaseJobLease(db: Db, lease: JobLease, state: "succeeded" | "failed" | "retry" | "blocked", errorCode?: string, now = new Date()): boolean {
  if (!verifyLeaseToken(db, lease, now)) return false;
  db.prepare(`UPDATE etl_jobs
    SET state = ?, lease_token = NULL, lease_expires_at = NULL, error_code = ?
    WHERE id = ? AND lease_token = ?`).run(state, errorCode ?? null, lease.jobId, lease.token);
  return true;
}

export function verifyLeaseToken(db: Db, lease: JobLease, now = new Date()): boolean {
  const row = db.prepare(`SELECT lease_token AS token, lease_expires_at AS expiresAt FROM etl_jobs WHERE id = ?`)
    .get(lease.jobId) as { token: string | null; expiresAt: string | null } | undefined;
  if (!row?.token || row.token !== lease.token) return false;
  if (!row.expiresAt || row.expiresAt < now.toISOString()) return false;
  return true;
}
