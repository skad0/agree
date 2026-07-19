import { backupDatabase } from "../src/backup.js";
import { loadConfig } from "../src/config.js";
import { openDatabase } from "../src/db.js";

const config = loadConfig(); const db = openDatabase(config.sqlitePath);
try { console.log((await backupDatabase(db, config)).join("\n")); } finally { db.close(); }

