import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { backupDatabase, restoreDatabase } from "../src/backup.js";
import { createApp } from "../src/app.js";
import { openDatabase } from "../src/db.js";
import { ERASURE_LEDGER_MANIFEST_KEY, createErasureLedgerManifest, serializeErasureLedgerManifest } from "../src/erasure-ledger.js";

import test from "node:test";

const env = {
  NODE_ENV: "test", SESSION_SECRET: "privacy-race-secret",
  BACKUP_S3_ENDPOINT: "http://backup.test", BACKUP_S3_ACCESS_KEY: "backup-key", BACKUP_S3_SECRET_KEY: "backup-secret", BACKUP_S3_BUCKET: "backups",
  ERASURE_LEDGER_S3_ENDPOINT: "http://ledger.test", ERASURE_LEDGER_S3_ACCESS_KEY: "ledger-key", ERASURE_LEDGER_S3_SECRET_KEY: "ledger-secret", ERASURE_LEDGER_S3_BUCKET: "ledger", ERASURE_LEDGER_HMAC_KEYS: `v1:${Buffer.alloc(32, 6).toString("base64url")}`, ERASURE_LEDGER_ACTIVE_KEY_VERSION: "v1"
};

test("post-cutoff same-email writes survive live deletion and subsequent restore reconciliation", async () => {
  const objects = new Map<string, Uint8Array>(); const originalFetch = globalThis.fetch; let runtime: ReturnType<typeof createApp> | undefined;
  globalThis.fetch = (async (input, init) => {
    const url = new URL(String(input));
    if (url.searchParams.has("list-type")) {
      const keys = [...objects.keys()].filter((key) => key.startsWith("/ledger/erasure-events/"));
      return new Response(`<ListBucketResult><IsTruncated>false</IsTruncated>${keys.map((key) => `<Contents><Key>${key.slice("/ledger/".length)}</Key></Contents>`).join("")}</ListBucketResult>`);
    }
    if (init?.method === "PUT") {
      const body = new Uint8Array(init.body as ArrayBuffer); objects.set(url.pathname, body);
      if (url.pathname.startsWith("/ledger/erasure-events/")) {
        const event = JSON.parse(new TextDecoder().decode(body)) as { eraseThrough: string };
        const after = new Date(Date.parse(event.eraseThrough) + 1).toISOString();
        runtime!.db.prepare("INSERT INTO supporters (email_normalized, locale, privacy_consent_at, created_at) VALUES ('race@example.org  ', 'en', ?, ?)").run(after, after);
        runtime!.db.prepare("INSERT INTO submitted_responses (recipient_id, received_at, channel, response_text, submitter_email, consent_at, created_at) VALUES (1, ?, 'email', 'post-cutoff', 'RACE@EXAMPLE.ORG', ?, ?)").run(after, after, after);
      }
      return new Response(null, { status: 200 });
    }
    const data = objects.get(url.pathname); return new Response(data ? new Uint8Array(data) : null, { status: data ? 200 : 404 });
  }) as typeof fetch;
  try {
    runtime = createApp({ sqlitePath: ":memory:", env });
    const manifest = createErasureLedgerManifest(runtime.config); objects.set(`/ledger/${ERASURE_LEDGER_MANIFEST_KEY}`, serializeErasureLedgerManifest(manifest));
    runtime.db.prepare("INSERT INTO supporters (email_normalized, locale, privacy_consent_at, created_at) VALUES ('race@example.org', 'en', '2020', '2020')").run();
    runtime.db.prepare("INSERT INTO submitted_responses (recipient_id, received_at, channel, response_text, submitter_email, consent_at, created_at) VALUES (1, '2020', 'email', 'pre-cutoff', 'race@example.org', '2020', '2020')").run();
    runtime.db.prepare("INSERT INTO supporters (email_normalized, locale, privacy_consent_at, created_at) VALUES ('race@example.org ', 'en', '2999', '2999-01-01T00:00:00.000Z')").run();
    runtime.db.prepare("INSERT INTO submitted_responses (recipient_id, received_at, channel, response_text, submitter_email, consent_at, created_at) VALUES (1, '2999', 'email', 'backup-post', 'RACE@EXAMPLE.ORG', '2999', '2999-01-01T00:00:00.000Z')").run();
    const backupKey = (await backupDatabase(runtime.db, runtime.config))[0]!;
    const request = await form(runtime.app, "/en/delete-data");
    const issued = await runtime.app.request("/en/delete-data", { method: "POST", headers: { cookie: request.cookie, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrf: request.csrf, email: "race@example.org" }) });
    const token = (await issued.text()).match(/delete-data\?token=([^"&]+)/)![1]!;
    const confirmation = await form(runtime.app, `/en/delete-data?token=${token}`);
    const deleted = await runtime.app.request("/en/delete-data", { method: "POST", headers: { cookie: confirmation.cookie, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrf: confirmation.csrf, token }) });
    assert.equal(deleted.status, 200);
    assert.equal(runtime.db.prepare("SELECT count(*) AS count FROM submitted_responses WHERE response_text = 'pre-cutoff'").get()?.count, 0);
    assert.equal(runtime.db.prepare("SELECT count(*) AS count FROM submitted_responses WHERE response_text = 'post-cutoff'").get()?.count, 1);
    assert.equal(runtime.db.prepare("SELECT count(*) AS count FROM submitted_responses WHERE response_text = 'backup-post'").get()?.count, 1);
    assert.equal(runtime.db.prepare("SELECT count(*) AS count FROM supporters WHERE email_normalized LIKE 'race@example.org %'").get()?.count, 2);
    const target = join(mkdtempSync(join(tmpdir(), "privacy-race-restore-")), "app.db"); await restoreDatabase(runtime.config, backupKey, target, { operatorConfirmed: true, serviceStopped: true });
    const restored = openDatabase(target);
    assert.equal(restored.prepare("SELECT count(*) AS count FROM submitted_responses WHERE response_text = 'pre-cutoff'").get()?.count, 0);
    assert.equal(restored.prepare("SELECT count(*) AS count FROM submitted_responses WHERE response_text = 'backup-post'").get()?.count, 1);
    assert.equal(restored.prepare("SELECT count(*) AS count FROM supporters WHERE email_normalized = 'race@example.org '").get()?.count, 1); restored.close();
  } finally { runtime?.close(); globalThis.fetch = originalFetch; }
});

async function form(app: ReturnType<typeof createApp>["app"], path: string) {
  const response = await app.request(path); const html = await response.text(); return { csrf: html.match(/name="csrf" value="([^"]+)"/)![1]!, cookie: response.headers.get("set-cookie")!.split(";")[0]! };
}
