import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../src/app.js";

const directory = mkdtempSync(join(tmpdir(), "agree-pages-")); const runtime = createApp({ sqlitePath: join(directory, "app.db"), env: { NODE_ENV: "test" } });
try {
  const expect: Record<string, number> = { "/admin": 403, "/en/demands": 301, "/uk/demands": 301 };
  for (const path of ["/health", "/en", "/he", "/ar", "/yi", "/ru", "/uk", "/am",
    "/en/standard", "/he/standard", "/uk/standard", "/en/coalition-agreement", "/uk/coalition-agreement", "/en/first-100-days", "/ar/first-100-days", "/uk/first-100-days",
    "/en/government-model", "/uk/government-model", "/en/about", "/uk/about", "/en/methodology", "/uk/methodology", "/en/demands",
    "/en/support", "/uk/support", "/en/request", "/uk/request", "/en/responses/new", "/uk/responses/new", "/en/privacy", "/uk/privacy", "/en/delete-data", "/uk/delete-data", "/admin"]) {
    const response = await runtime.app.request(path); const expected = expect[path] ?? 200;
    console.log(`${response.status} ${path}`); if (response.status !== expected) throw new Error(`Expected ${expected}`);
  }
} finally { runtime.close(); rmSync(directory, { recursive: true, force: true }); }
