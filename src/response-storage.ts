import type { Config } from "./config.js";
import type { Db } from "./db.js";
import { deleteObject } from "./s3.js";

const STALE_UPLOAD_MS = 60 * 60 * 1000;
const MAX_ERROR_LENGTH = 160;
const MAX_BACKOFF_MS = 60 * 60 * 1000;
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
    const stale = db.prepare("SELECT object_key FROM response_object_work WHERE state = 'upload_pending' AND created_at < ?").all(new Date(now - STALE_UPLOAD_MS).toISOString()) as { object_key: string }[];
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
    }
  }
}
