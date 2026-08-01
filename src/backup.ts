import { backup, DatabaseSync } from "node:sqlite";
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { Config } from "./config.js";
import type { Db } from "./db.js";
import { getStoreObject, listErasureLedgerObjects, putStoreObject, type Store } from "./s3.js";
import { ERASURE_LEDGER_MANIFEST_KEY, eventDigest, parseErasureEvent, subjectTag, verifyErasureEvent, verifyErasureLedgerManifest, type ErasureEvent } from "./erasure-ledger.js";
import { openDatabase } from "./db.js";
import { queueResponseObjectDelete } from "./response-storage.js";
import { randomBytes } from "node:crypto";

export function hasBackupStorage(config: Config) {
  return Boolean(config.backupEndpoint && config.backupAccessKey && config.backupSecretKey && config.backupBucket);
}

export async function backupDatabase(db: Db, config: Config) {
  const store = backupStore(config); const directory = mkdtempSync(join(tmpdir(), "agree-backup-")); const file = join(directory, "app.db");
  try {
    await backup(db, file);
    const data = new Uint8Array(await import("node:fs/promises").then((fs) => fs.readFile(file)));
    const day = new Date().toISOString().slice(0, 10); const week = isoWeek(new Date());
    const keys = [`daily/${day}.db`, `weekly/${week}.db`];
    for (const key of keys) await putStoreObject(store, key, "application/vnd.sqlite3", data);
    return keys;
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

export type RestoreReport = { backupKey: string; validatedEvents: number; eventDigest: string; affectedRows: number; attachmentJobs: number; activation: "activated" };

export async function restoreDatabase(config: Config, key: string, target: string, options: { operatorConfirmed?: boolean; serviceStopped?: boolean } = {}): Promise<RestoreReport> {
  if (options.operatorConfirmed !== true) throw new Error("Restore requires explicit operator confirmation");
  if (options.serviceStopped !== true) throw new Error("Restore requires serviceStopped=true; maintenance mode is not implemented");
  const parent = dirname(target); mkdirSync(parent, { recursive: true });
  if (exists(`${target}-wal`) || exists(`${target}-shm`)) throw new Error("Restore target has SQLite WAL/SHM sidecars; stop the service and remove them before restoring");
  const directory = mkdtempSync(join(parent, `.agree-restore-${process.pid}-`)); const staged = join(directory, "app.db");
  let db: DbLike | undefined;
  try {
    writeFileSync(staged, await getStoreObject(backupStore(config), key), { mode: 0o600 });
    checkIntegrity(staged);
    db = openDatabase(staged);
    checkForeignKeys(db); checkIntegrity(staged);
    const events = await loadLedger(config);
    const report = reconcile(db, config, events);
    checkForeignKeys(db); checkIntegrity(staged); db.exec("PRAGMA wal_checkpoint(TRUNCATE)"); db.close(); db = undefined;
    if (exists(`${staged}-wal`)) throw new Error("Staged SQLite WAL was not checkpointed");
    // Same-filesystem rename is atomic: before it the target is untouched, and after it
    // the target is always a complete database. No PII rollback copy is retained.
    renameSync(staged, target);
    return { backupKey: key, validatedEvents: events.length, eventDigest: eventDigest(events), ...report, activation: "activated" };
  } finally { db?.close(); rmSync(directory, { recursive: true, force: true }); }
}

type DbLike = ReturnType<typeof openDatabase>;
async function loadLedger(config: Config) {
  if (!config.erasureLedger.endpoint || !config.erasureLedger.accessKey || !config.erasureLedger.secretKey || !config.erasureLedger.bucket || !config.erasureLedger.keys.size || !config.erasureLedger.activeVersion) throw new Error("Erasure ledger configuration is required for restore");
  const store = { endpoint: config.erasureLedger.endpoint, accessKey: config.erasureLedger.accessKey!, secretKey: config.erasureLedger.secretKey!, bucket: config.erasureLedger.bucket!, region: config.erasureLedger.region };
  let manifest: unknown; try { manifest = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(await getStoreObject(store, ERASURE_LEDGER_MANIFEST_KEY))); } catch { throw new Error("Erasure ledger manifest is missing or invalid"); }
  if (!verifyErasureLedgerManifest(config, manifest)) throw new Error("Erasure ledger manifest authentication failed");
  const keys = await listErasureLedgerObjects(config); const events: ErasureEvent[] = [];
  for (const objectKey of keys.sort()) {
    if (!objectKey.startsWith("erasure-events/v1/")) throw new Error("Erasure ledger returned an object outside its prefix");
    const event = parseErasureEvent(await getStoreObject(store, objectKey));
    if (!verifyErasureEvent(config, event)) throw new Error("Erasure ledger event authentication failed");
    events.push(event);
  }
  return events;
}

function reconcile(db: DbLike, config: Config, events: ErasureEvent[]) {
  const latest = new Map<string, ErasureEvent>();
  for (const event of events) { const prior = latest.get(event.subjectTag); if (!prior || event.eraseThrough > prior.eraseThrough) latest.set(event.subjectTag, event); }
  const now = new Date().toISOString(); let affectedRows = 0; let attachmentJobs = 0;
  db.exec("BEGIN IMMEDIATE");
  try {
    const supporters = db.prepare("SELECT id, email_normalized, created_at FROM supporters").all() as { id: number; email_normalized: string; created_at: string }[];
    const emails = new Map<number, ErasureEvent>();
    for (const supporter of supporters) { const event = latestEventForEmail(config, [...latest.values()], supporter.email_normalized, supporter.created_at); if (event) emails.set(supporter.id, event); }
    for (const response of db.prepare("SELECT id, submitter_email, created_at FROM submitted_responses").all() as { id: number; submitter_email: string; created_at: string }[]) {
      const event = latestEventForEmail(config, [...latest.values()], response.submitter_email, response.created_at);
      if (!event) continue;
      for (const file of db.prepare("SELECT object_key FROM submitted_response_files WHERE response_id = ?").all(response.id) as { object_key: string }[]) { queueResponseObjectDelete(db, file.object_key, now); attachmentJobs++; }
      db.prepare("UPDATE response_submission_nonces SET outcome = 'erased', response_id = NULL, updated_at = ? WHERE response_id = ?").run(now, response.id);
      db.prepare("DELETE FROM submitted_responses WHERE id = ?").run(response.id); affectedRows++;
    }
    for (const [id, event] of emails) {
      db.prepare("UPDATE generated_requests SET supporter_id = NULL WHERE supporter_id = ? AND created_at <= ?").run(id, event.eraseThrough);
      db.prepare("DELETE FROM email_verifications WHERE supporter_id = ?").run(id);
      const supporter = db.prepare("SELECT email_normalized FROM supporters WHERE id = ?").get(id) as { email_normalized: string } | undefined;
      if (!supporter) continue;
      let address = `deleted-${id}@invalid.local`; while (db.prepare("SELECT 1 FROM supporters WHERE email_normalized = ? AND id <> ?").get(address, id)) address = `deleted-${id}-${randomBytes(12).toString("hex")}@invalid.local`;
      db.prepare("UPDATE supporters SET email_normalized = ?, name = NULL, city = NULL, profession = NULL, public_name_allowed = 0, deleted_at = ? WHERE id = ?").run(address, now, id); affectedRows++;
      db.prepare("UPDATE privacy_deletion_tokens SET used_at = COALESCE(used_at, ?) WHERE email_normalized = ? AND created_at <= ?").run(now, supporter.email_normalized, event.eraseThrough);
    }
    for (const token of db.prepare("SELECT email_normalized, created_at FROM privacy_deletion_tokens WHERE used_at IS NULL").all() as { email_normalized: string; created_at: string }[]) {
      const event = latestEventForEmail(config, [...latest.values()], token.email_normalized, token.created_at);
      if (event) db.prepare("UPDATE privacy_deletion_tokens SET used_at = ? WHERE email_normalized = ? AND used_at IS NULL AND created_at <= ?").run(now, token.email_normalized, event.eraseThrough);
    }
    db.exec("COMMIT");
  } catch (error) { db.exec("ROLLBACK"); throw error; }
  return { affectedRows, attachmentJobs };
}

function subjectMatches(config: Config, email: string, event: ErasureEvent) { for (const version of config.erasureLedger.keys.keys()) if (subjectTag(config, version, email) === event.subjectTag) return true; return false; }
function latestEventForEmail(config: Config, events: ErasureEvent[], email: string, createdAt: string) { return events.filter((event) => createdAt <= event.eraseThrough && subjectMatches(config, email, event)).sort((a, b) => a.eraseThrough.localeCompare(b.eraseThrough)).at(-1); }
function checkIntegrity(path: string) { const check = new DatabaseSync(path, { readOnly: true }); try { if (check.prepare("PRAGMA integrity_check").get()?.integrity_check !== "ok") throw new Error("SQLite integrity check failed"); } finally { check.close(); } }
function checkForeignKeys(db: DbLike) { const rows = db.prepare("PRAGMA foreign_key_check").all(); if (rows.length) throw new Error("SQLite foreign-key check failed"); }
function exists(path: string) { try { readFileSync(path); return true; } catch { return false; } }

function backupStore(config: Config): Store {
  if (!hasBackupStorage(config)) throw new Error("Backup storage is not configured");
  return { endpoint: config.backupEndpoint, accessKey: config.backupAccessKey!, secretKey: config.backupSecretKey!, bucket: config.backupBucket!, region: config.backupRegion };
}
function isoWeek(date: Date) { const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())); target.setUTCDate(target.getUTCDate() + 4 - (target.getUTCDay() || 7)); const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1)); return `${target.getUTCFullYear()}-W${String(Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)).padStart(2, "0")}`; }
