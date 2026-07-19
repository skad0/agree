import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { backupDatabase, hasBackupStorage } from "./backup.js";

const runtime = createApp();
if (runtime.config.isEphemeralSessionSecret) console.warn("SESSION_SECRET is absent; using an ephemeral development secret");
const server = serve({ fetch: runtime.app.fetch, hostname: "0.0.0.0", port: runtime.config.port }, (info) => {
  console.log(`Listening on http://${info.address}:${info.port}`);
});
server.on("error", (error) => {
  console.error(`Server failed: ${error.message}`);
  runtime.close();
  process.exitCode = 1;
});
if (hasBackupStorage(runtime.config)) {
  const runBackup = () => backupDatabase(runtime.db, runtime.config).then((keys) => console.log(`Backed up SQLite: ${keys.join(", ")}`)).catch((error) => console.error("SQLite backup failed", error));
  void runBackup();
  setInterval(runBackup, 86_400_000).unref();
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => server.close(() => {
    runtime.close();
    process.exit(0);
  }));
}
