import { restoreDatabase } from "../src/backup.js";
import { loadConfig } from "../src/config.js";

const key = process.argv[2];
if (!key) throw new Error("Usage: npm run restore -- daily/YYYY-MM-DD.db");
const config = loadConfig(); await restoreDatabase(config, key, config.sqlitePath); console.log(`Restored ${key} to ${config.sqlitePath}`);

