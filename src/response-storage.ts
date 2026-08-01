import type { Config } from "./config.js";
import type { Db } from "./db.js";
import { deleteObject } from "./s3.js";

const STALE_UPLOAD_MS = 60 * 60 * 1000;
const MAX_ERROR_LENGTH = 160;
const MAX_BACKOFF_MS = 60 * 60 * 1000;
const RETENTION_BATCH_SIZE = 100;
let drainRunning = false;

export function queueResponseObjectDelete(db: Db, objectKey: string, now = new Date().toISOString()) {
  db.prepare(`INSERT INTO response_object_work (object_key, state, next_attempt_at, created_at, updated_at)
    VALUES (?, 'delete_pending', ?, ?, ?)
    ON CONFLICT(object_key) DO UPDATE SET state = 'delete_pending', next_attempt_at = excluded.next_attempt_at, updated_at = excluded.updated_at`).run(objectKey, now, now, now);
}

export async function drainResponseObjectWork(db: Db, config: Config, now = Date.now()) {
  if (drainRunning) return;
  drainRunning = true;
  try { await drainResponseObjectWorkInternal(db, config, now); }
  finally { drainRunning = false; }
}

async function drainResponseObjectWorkInternal(db: Db, config: Config, now: number) {
  const nowIso = new Date(now).toISOString();
  db.exec("BEGIN IMMEDIATE");
  try {
    const stale = db.prepare("SELECT object_key FROM response_object_work WHERE state = 'upload_pending' AND created_at < ? ORDER BY created_at, object_key LIMIT ?").all(new Date(now - STALE_UPLOAD_MS).toISOString(), RETENTION_BATCH_SIZE) as { object_key: string }[];
    for (const { object_key } of stale) {
      const referenced = db.prepare("SELECT 1 FROM submitted_response_files WHERE object_key = ?").get(object_key);
      if (referenced) db.prepare("DELETE FROM response_object_work WHERE object_key = ?").run(object_key);
      else db.prepare("UPDATE response_object_work SET state = 'delete_pending', next_attempt_at = ?, updated_at = ? WHERE object_key = ?").run(nowIso, nowIso, object_key);
    }
    db.exec("COMMIT");
  } catch (error) { db.exec("ROLLBACK"); throw error; }

  const jobs = db.prepare("SELECT object_key, attempts FROM response_object_work WHERE state = 'delete_pending' AND next_attempt_at <= ? ORDER BY object_key LIMIT 100").all(nowIso) as { object_key: string; attempts: number }[];
  for (const job of jobs) {
    if (db.prepare("SELECT 1 FROM submitted_response_files WHERE object_key = ?").get(job.object_key)) {
      db.prepare("DELETE FROM response_object_work WHERE object_key = ?").run(job.object_key);
      continue;
    }
    try {
      await deleteObject(config, job.object_key);
      db.prepare("DELETE FROM response_object_work WHERE object_key = ?").run(job.object_key);
    } catch (error) {
      const attempts = Math.min(job.attempts + 1, 20);
      const backoff = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** Math.min(attempts, 10));
      const message = String(error instanceof Error ? error.message : "delete failed").replaceAll(/[\r\n]/g, " ").slice(0, MAX_ERROR_LENGTH);
      db.prepare("UPDATE response_object_work SET attempts = ?, next_attempt_at = ?, last_error = ?, updated_at = ? WHERE object_key = ?")
        .run(attempts, new Date(now + backoff).toISOString(), message, new Date(now).toISOString(), job.object_key);
      console.error(`Response object deletion overdue (attempt ${attempts}): ${job.object_key}: ${message}`);
    }
  }
}

export function enforceRetention(db: Db, now = Date.now()) {
  const responseCutoff = new Date(subtractUtcMonths(now, 12)).toISOString();
  const supporterCutoff = new Date(subtractUtcMonths(now, 24)).toISOString();
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const response of db.prepare("SELECT id FROM submitted_responses WHERE created_at < ? ORDER BY created_at, id LIMIT ?").all(responseCutoff, RETENTION_BATCH_SIZE) as { id: number }[]) {
      for (const file of db.prepare("SELECT object_key FROM submitted_response_files WHERE response_id = ?").all(response.id) as { object_key: string }[]) queueResponseObjectDelete(db, file.object_key, new Date(now).toISOString());
      db.prepare("DELETE FROM submitted_responses WHERE id = ?").run(response.id);
    }
    const generatedRequests = db.prepare("SELECT id FROM generated_requests WHERE created_at < ? ORDER BY created_at, id LIMIT ?")
      .all(responseCutoff, RETENTION_BATCH_SIZE) as { id: number }[];
    if (generatedRequests.length) {
      const placeholders = generatedRequests.map(() => "?").join(",");
      const ids = generatedRequests.map(({ id }) => id);
      // Delete explicitly as well as relying on the FK cascade: this keeps the
      // retention invariant safe if an older database was created without FK enforcement.
      db.prepare(`DELETE FROM request_actions WHERE generated_request_id IN (${placeholders})`).run(...ids);
      db.prepare(`DELETE FROM generated_requests WHERE id IN (${placeholders})`).run(...ids);
    }
    db.prepare("DELETE FROM admin_audit_events WHERE id IN (SELECT id FROM admin_audit_events WHERE created_at < ? ORDER BY created_at, id LIMIT ?)").run(responseCutoff, RETENTION_BATCH_SIZE);
    for (const supporter of db.prepare("SELECT id FROM supporters WHERE deleted_at IS NULL AND last_active_at < ? ORDER BY last_active_at, id LIMIT ?").all(supporterCutoff, RETENTION_BATCH_SIZE) as { id: number }[]) {
      db.prepare("UPDATE generated_requests SET supporter_id = NULL WHERE supporter_id = ?").run(supporter.id); db.prepare("DELETE FROM email_verifications WHERE supporter_id = ?").run(supporter.id); db.prepare("DELETE FROM supporters WHERE id = ?").run(supporter.id);
    }
    const cleanupNow = new Date(now).toISOString();
    const usedCleanup = db.prepare("DELETE FROM privacy_deletion_tokens WHERE id IN (SELECT id FROM privacy_deletion_tokens WHERE used_at IS NOT NULL ORDER BY used_at, id LIMIT ?)").run(RETENTION_BATCH_SIZE);
    const remainingCleanup = Math.max(0, RETENTION_BATCH_SIZE - Number(usedCleanup.changes));
    if (remainingCleanup) db.prepare("DELETE FROM privacy_deletion_tokens WHERE id IN (SELECT id FROM privacy_deletion_tokens WHERE expires_at < ? AND used_at IS NULL ORDER BY expires_at, id LIMIT ?)").run(cleanupNow, remainingCleanup);
    db.exec("COMMIT");
  } catch (error) { db.exec("ROLLBACK"); throw error; }
}

/** UTC calendar-month subtraction: a month-end anniversary clamps to the target month end. */
export function subtractUtcMonths(timestamp: number, months: number) {
  const source = new Date(timestamp); const year = source.getUTCFullYear(); const month = source.getUTCMonth() - months; const day = source.getUTCDate();
  const targetYear = year + Math.floor(month / 12); const targetMonth = ((month % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  return Date.UTC(targetYear, targetMonth, Math.min(day, lastDay), source.getUTCHours(), source.getUTCMinutes(), source.getUTCSeconds(), source.getUTCMilliseconds());
}
