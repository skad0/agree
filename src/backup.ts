import { backup, DatabaseSync } from "node:sqlite";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { Config } from "./config.js";
import type { Db } from "./db.js";
import { getStoreObject, putStoreObject, type Store } from "./s3.js";

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

export async function restoreDatabase(config: Config, key: string, target: string) {
  const directory = mkdtempSync(join(tmpdir(), "agree-restore-")); const file = join(directory, "restore.db");
  try {
    writeFileSync(file, await getStoreObject(backupStore(config), key));
    const check = new DatabaseSync(file, { readOnly: true });
    try { if (check.prepare("PRAGMA integrity_check").get()?.integrity_check !== "ok") throw new Error("SQLite integrity check failed"); } finally { check.close(); }
    mkdirSync(dirname(target), { recursive: true }); copyFileSync(file, target);
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

function backupStore(config: Config): Store {
  if (!hasBackupStorage(config)) throw new Error("Backup storage is not configured");
  return { endpoint: config.backupEndpoint, accessKey: config.backupAccessKey!, secretKey: config.backupSecretKey!, bucket: config.backupBucket!, region: config.backupRegion };
}
function isoWeek(date: Date) { const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())); target.setUTCDate(target.getUTCDate() + 4 - (target.getUTCDay() || 7)); const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1)); return `${target.getUTCFullYear()}-W${String(Math.ceil((((target.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)).padStart(2, "0")}`; }

