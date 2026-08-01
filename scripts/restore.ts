import { restoreDatabase } from "../src/backup.js";
import { loadConfig } from "../src/config.js";

const key = process.argv[2];
if (!key || process.argv.includes("--help")) throw new Error("Usage: AGREE_RESTORE_SERVICE_STOPPED=1 AGREE_RESTORE_CONFIRMED=1 npm run restore -- daily/YYYY-MM-DD.db");
if (process.env.AGREE_RESTORE_CONFIRMED !== "1" || process.env.AGREE_RESTORE_SERVICE_STOPPED !== "1") throw new Error("Refusing restore: stop the service, then set AGREE_RESTORE_CONFIRMED=1 and AGREE_RESTORE_SERVICE_STOPPED=1");
const config = loadConfig();
try {
  const report = await restoreDatabase(config, key, config.sqlitePath, { operatorConfirmed: true, serviceStopped: true });
  console.log(JSON.stringify(report));
} catch { throw new Error("Restore failed closed; live database was not activated"); }
