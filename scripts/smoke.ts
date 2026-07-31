import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const port = Number(process.env.SMOKE_PORT ?? 3217); const directory = mkdtempSync(join(tmpdir(), "agree-smoke-"));
const child = spawn(process.execPath, ["dist/src/server.js"], { env: { NODE_ENV: "development", PORT: String(port), SQLITE_PATH: join(directory, "app.db"), APP_BASE_URL: `http://127.0.0.1:${port}` }, stdio: ["ignore", "pipe", "pipe"] });
const exited = new Promise((resolve) => child.once("exit", resolve));
child.stdout.pipe(process.stdout); child.stderr.pipe(process.stderr);
try {
  await waitFor(`http://127.0.0.1:${port}/health`);
  for (const path of ["/health", "/en", "/he", "/ar", "/yi", "/ru", "/uk", "/am", "/en/demands", "/uk/demands", "/en/support", "/uk/support", "/en/request", "/uk/request", "/en/responses/new", "/uk/responses/new", "/en/privacy", "/uk/privacy", "/en/delete-data", "/uk/delete-data", "/admin"]) {
    const response = await fetch(`http://127.0.0.1:${port}${path}`); console.log(`${response.status} ${path}`);
    const expected = path === "/admin" ? 403 : 200; if (response.status !== expected) throw new Error(`Expected ${expected} for ${path}`);
  }
} finally { if (child.exitCode === null) child.kill("SIGTERM"); await exited; rmSync(directory, { recursive: true, force: true }); }

async function waitFor(url: string) { for (let attempt = 0; attempt < 50; attempt++) { try { if ((await fetch(url)).ok) return; } catch {} await new Promise((resolve) => setTimeout(resolve, 100)); } throw new Error("Server did not start"); }
