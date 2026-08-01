import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { backupDatabase, restoreDatabase } from "../src/backup.js";
import { createApp } from "../src/app.js";
import { createErasureEvent, createErasureLedgerManifest, ERASURE_LEDGER_MANIFEST_KEY, serializeErasureEvent, serializeErasureLedgerManifest } from "../src/erasure-ledger.js";

const signingKey = Buffer.alloc(32, 4).toString("base64url");
const env = {
  NODE_ENV: "test", SESSION_SECRET: "restore-test-secret",
  BACKUP_S3_ENDPOINT: "http://backup.test", BACKUP_S3_ACCESS_KEY: "backup-key", BACKUP_S3_SECRET_KEY: "backup-secret", BACKUP_S3_BUCKET: "backups",
  ERASURE_LEDGER_S3_ENDPOINT: "http://ledger.test", ERASURE_LEDGER_S3_ACCESS_KEY: "ledger-key", ERASURE_LEDGER_S3_SECRET_KEY: "ledger-secret", ERASURE_LEDGER_S3_BUCKET: "ledger", ERASURE_LEDGER_HMAC_KEYS: `old:${Buffer.alloc(32, 8).toString("base64url")},active:${signingKey}`, ERASURE_LEDGER_ACTIVE_KEY_VERSION: "active"
};

test("restore reconciles a pre-erasure backup and queues response attachment deletion", async () => {
  await withStorage(async (runtime, objects) => {
    const cutoff = "2026-01-01T00:00:00.000Z";
    runtime.db.prepare("INSERT INTO supporters (email_normalized, locale, privacy_consent_at, created_at) VALUES ('restore@example.org', 'en', '2025', '2025')").run();
    runtime.db.prepare("INSERT INTO submitted_responses (recipient_id, received_at, channel, response_text, submitter_email, consent_at, created_at) VALUES (1, '2025', 'email', 'private', 'Restore@Example.org', '2025', '2025')").run();
    runtime.db.prepare("INSERT INTO submitted_response_files (response_id, object_key, mime, size, uploaded_at) VALUES (1, 'responses/private.bin', 'application/octet-stream', 1, '2025')").run();
    const key = (await backupDatabase(runtime.db, runtime.config))[0]!;
    addEvent(runtime, objects, "restore@example.org", cutoff);
    const target = join(mkdtempSync(join(tmpdir(), "restore-target-")), "app.db");
    const report = await restoreDatabase(runtime.config, key, target, { operatorConfirmed: true, serviceStopped: true });
    const restored = runtime.db.constructor === undefined ? undefined : (await import("../src/db.js")).openDatabase(target);
    assert.equal(report.validatedEvents, 1); assert.equal(report.attachmentJobs, 1); assert.ok(report.eventDigest); assert.doesNotMatch(JSON.stringify(report), /restore@example\.org|Restore@Example\.org/);
    assert.equal(restored?.prepare("SELECT deleted_at IS NOT NULL AS erased FROM supporters WHERE deleted_at IS NOT NULL").get()?.erased, 1);
    assert.equal(restored?.prepare("SELECT count(*) AS count FROM submitted_responses").get()?.count, 0);
    assert.equal(restored?.prepare("SELECT state FROM response_object_work WHERE object_key = 'responses/private.bin'").get()?.state, "delete_pending");
    restored?.close();
  });
});

test("rows created after eraseThrough survive reconciliation and duplicate events use latest cutoff", async () => {
  await withStorage(async (runtime, objects) => {
    const oldCutoff = "2024-01-01T00:00:00.000Z"; const latestCutoff = "2025-01-01T00:00:00.000Z";
    runtime.db.prepare("INSERT INTO supporters (email_normalized, locale, privacy_consent_at, created_at) VALUES ('survivor@example.org', 'en', '2025', '2025-06-01T00:00:00.000Z')").run();
    runtime.db.prepare("INSERT INTO submitted_responses (recipient_id, received_at, channel, response_text, submitter_email, consent_at, created_at) VALUES (1, '2025', 'email', 'survive', 'survivor@example.org', '2025', '2026-02-01T00:00:00.000Z')").run();
    const key = (await backupDatabase(runtime.db, runtime.config))[0]!;
    addEvent(runtime, objects, "survivor@example.org", oldCutoff); addEvent(runtime, objects, "survivor@example.org", latestCutoff);
    const target = join(mkdtempSync(join(tmpdir(), "restore-target-")), "app.db"); await restoreDatabase(runtime.config, key, target, { operatorConfirmed: true, serviceStopped: true });
    const restored = (await import("../src/db.js")).openDatabase(target);
    assert.equal(restored.prepare("SELECT deleted_at FROM supporters WHERE email_normalized = 'survivor@example.org'").get()?.deleted_at, null);
    assert.equal(restored.prepare("SELECT count(*) AS count FROM submitted_responses").get()?.count, 1); restored.close();
  });
});

test("historical signing keys are honored during restore", async () => {
  await withStorage(async (runtime, objects) => {
    const oldConfig = { ...runtime.config, erasureLedger: { ...runtime.config.erasureLedger, activeVersion: "old", keys: new Map([["old", Buffer.alloc(32, 8)]]) } };
    runtime.db.prepare("INSERT INTO supporters (email_normalized, locale, privacy_consent_at, created_at) VALUES ('rotated@example.org', 'en', '2025', '2025')").run();
    const key = (await backupDatabase(runtime.db, runtime.config))[0]!;
    const event = createErasureEvent(oldConfig, "rotated@example.org", "2026-01-01T00:00:00.000Z"); objects.set("/ledger/" + ERASURE_LEDGER_MANIFEST_KEY, serializeErasureLedgerManifest(createErasureLedgerManifest(runtime.config))); objects.set("/ledger/erasure-events/v1/" + event.eventId + ".json", serializeErasureEvent(event));
    const target = join(mkdtempSync(join(tmpdir(), "restore-target-")), "app.db"); await restoreDatabase(runtime.config, key, target, { operatorConfirmed: true, serviceStopped: true });
    const restored = (await import("../src/db.js")).openDatabase(target); assert.equal(restored.prepare("SELECT deleted_at IS NOT NULL AS erased FROM supporters").get()?.erased, 1); restored.close();
  });
});

test("tampered, unknown-key, incomplete, inaccessible, corrupt, and FK-invalid inputs never mutate the target", async () => {
  await withStorage(async (runtime, objects, mode) => {
    runtime.db.prepare("INSERT INTO supporters (email_normalized, locale, privacy_consent_at, created_at) VALUES ('private@example.org', 'en', '2025', '2025')").run();
    const key = (await backupDatabase(runtime.db, runtime.config))[0]!; const target = join(mkdtempSync(join(tmpdir(), "restore-target-")), "app.db"); writeFileSync(target, Buffer.from("original-target")); const original = readFileSync(target);
    addEvent(runtime, objects, "private@example.org", "2026-01-01T00:00:00.000Z");
    if (mode === "tampered") { const objectKey = [...objects.keys()].find((value) => value.includes("erasure-events"))!; objects.set(objectKey, Buffer.from(JSON.stringify({ bad: true }))); }
    if (mode === "unknown") { const eventKey = [...objects.keys()].find((value) => value.includes("erasure-events"))!; const event = createErasureEvent({ ...runtime.config, erasureLedger: { ...runtime.config.erasureLedger, activeVersion: "unknown", keys: new Map([["unknown", Buffer.alloc(32, 5)]]) } }, "private@example.org", "2026-01-01T00:00:00.000Z"); objects.set(eventKey, serializeErasureEvent(event)); }
    if (mode === "corrupt") objects.set([...objects.keys()].find((value) => value.includes("/backups/daily/"))!, Buffer.from("not sqlite"));
    if (mode === "fk") { runtime.db.exec("PRAGMA foreign_keys=OFF"); runtime.db.prepare("INSERT INTO submitted_responses (recipient_id, received_at, channel, response_text, submitter_email, consent_at, created_at) VALUES (999, '2025', 'email', 'bad', 'none@example.org', '2025', '2025')").run(); objects.clear(); const freshKey = (await backupDatabase(runtime.db, runtime.config))[0]!; assert.equal(freshKey, key); addEvent(runtime, objects, "private@example.org", "2026-01-01T00:00:00.000Z"); }
    await assert.rejects(restoreDatabase(runtime.config, key, target, { operatorConfirmed: true, serviceStopped: true }), /./, `expected ${mode} restore failure`); assert.deepEqual(readFileSync(target), original);
  }, "tampered");
  await assertFailureMode("unknown"); await assertFailureMode("incomplete"); await assertFailureMode("access"); await assertFailureMode("corrupt"); await assertFailureMode("fk"); await assertFailureMode("migration");
});

test("library restore requires confirmation before touching target", async () => {
  await withStorage(async (runtime) => { const target = join(mkdtempSync(join(tmpdir(), "restore-target-")), "app.db"); writeFileSync(target, Buffer.from("untouched")); await assert.rejects(restoreDatabase(runtime.config, "daily/missing.db", target), /confirmation/); assert.equal(readFileSync(target).toString(), "untouched"); });
});

test("library restore requires an explicit stopped-service attestation", async () => {
  await withStorage(async (runtime) => {
    const target = join(mkdtempSync(join(tmpdir(), "restore-target-")), "app.db"); writeFileSync(target, Buffer.from("untouched"));
    await assert.rejects(restoreDatabase(runtime.config, "daily/missing.db", target, { operatorConfirmed: true }), /serviceStopped=true/);
    assert.equal(readFileSync(target).toString(), "untouched");
  });
});

test("restore fails closed without ledger configuration and the CLI guard remains explicit", async () => {
  await withStorage(async (runtime) => {
    const key = (await backupDatabase(runtime.db, runtime.config))[0]!; const target = join(mkdtempSync(join(tmpdir(), "restore-target-")), "app.db"); writeFileSync(target, Buffer.from("untouched"));
    const missingLedger = { ...runtime.config, erasureLedger: { ...runtime.config.erasureLedger, endpoint: undefined, accessKey: undefined, secretKey: undefined, bucket: undefined, keys: new Map(), activeVersion: undefined } };
    await assert.rejects(restoreDatabase(missingLedger, key, target, { operatorConfirmed: true, serviceStopped: true }), /ledger configuration/); assert.equal(readFileSync(target).toString(), "untouched");
  });
  const result = spawnSync(process.execPath, ["dist/scripts/restore.js", "daily/example.db"], { encoding: "utf8", env: { ...process.env, AGREE_RESTORE_CONFIRMED: "" } });
  assert.notEqual(result.status, 0); assert.match(`${result.stderr}${result.stdout}`, /AGREE_RESTORE_CONFIRMED=1/);
});

async function assertFailureMode(mode: string) {
  await withStorage(async (runtime, objects, actualMode) => {
    runtime.db.prepare("INSERT INTO supporters (email_normalized, locale, privacy_consent_at, created_at) VALUES ('private@example.org', 'en', '2025', '2025')").run(); if (actualMode === "migration") runtime.db.prepare("DELETE FROM schema_migrations WHERE name = '014_generated_request_retention.sql'").run(); const key = (await backupDatabase(runtime.db, runtime.config))[0]!; const target = join(mkdtempSync(join(tmpdir(), "restore-target-")), "app.db"); writeFileSync(target, Buffer.from("original-target")); const original = readFileSync(target);
    addEvent(runtime, objects, "private@example.org", "2026-01-01T00:00:00.000Z");
    if (actualMode === "unknown") { const eventKey = [...objects.keys()].find((value) => value.includes("erasure-events"))!; const event = createErasureEvent({ ...runtime.config, erasureLedger: { ...runtime.config.erasureLedger, activeVersion: "unknown", keys: new Map([["unknown", Buffer.alloc(32, 5)]]) } }, "private@example.org", "2026-01-01T00:00:00.000Z"); objects.set(eventKey, serializeErasureEvent(event)); }
    if (actualMode === "incomplete") objects.set("__listing_mode", Buffer.from("incomplete"));
    if (actualMode === "access") objects.set("__listing_mode", Buffer.from("access"));
    if (actualMode === "corrupt") objects.set([...objects.keys()].find((value) => value.includes("/backups/daily/"))!, Buffer.from("not sqlite"));
    if (actualMode === "fk") { runtime.db.exec("PRAGMA foreign_keys=OFF"); runtime.db.prepare("INSERT INTO submitted_responses (recipient_id, received_at, channel, response_text, submitter_email, consent_at, created_at) VALUES (999, '2025', 'email', 'bad', 'none@example.org', '2025', '2025')").run(); objects.clear(); const fresh = (await backupDatabase(runtime.db, runtime.config))[0]!; assert.equal(fresh, key); addEvent(runtime, objects, "private@example.org", "2026-01-01T00:00:00.000Z"); }
    await assert.rejects(restoreDatabase(runtime.config, key, target, { operatorConfirmed: true, serviceStopped: true }), /./, `expected ${actualMode} restore failure`); assert.deepEqual(readFileSync(target), original);
  }, mode);
}

async function withStorage(run: (runtime: ReturnType<typeof createApp>, objects: Map<string, Uint8Array>, mode?: string) => Promise<void>, mode?: string) {
  const objects = new Map<string, Uint8Array>(); const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input, init) => { const url = new URL(String(input)); if (url.searchParams.has("list-type")) { const marker = objects.get("__listing_mode")?.toString(); if (marker === "access") return new Response(null, { status: 403 }); if (marker === "incomplete") return new Response("<ListBucketResult><IsTruncated>true</IsTruncated></ListBucketResult>", { status: 200 }); const keys = [...objects.keys()].filter((key) => key.startsWith("/ledger/erasure-events/")); return new Response(`<ListBucketResult><IsTruncated>false</IsTruncated>${keys.map((key) => `<Contents><Key>${key.slice("/ledger/".length)}</Key></Contents>`).join("")}</ListBucketResult>`, { status: 200 }); } if (init?.method === "PUT") { objects.set(url.pathname, new Uint8Array(init.body as ArrayBuffer)); return new Response(null, { status: 200 }); } const data = objects.get(url.pathname); return new Response(data ? new Uint8Array(data) : null, { status: data ? 200 : 404 }); }) as typeof fetch;
  const runtime = createApp({ sqlitePath: ":memory:", env }); const manifest = createErasureLedgerManifest(runtime.config); objects.set(`/ledger/${ERASURE_LEDGER_MANIFEST_KEY}`, serializeErasureLedgerManifest(manifest)); try { await run(runtime, objects, mode); } finally { runtime.close(); globalThis.fetch = originalFetch; }
}
function addEvent(runtime: ReturnType<typeof createApp>, objects: Map<string, Uint8Array>, email: string, cutoff: string) { objects.set(`/ledger/${ERASURE_LEDGER_MANIFEST_KEY}`, serializeErasureLedgerManifest(createErasureLedgerManifest(runtime.config, cutoff))); const event = createErasureEvent(runtime.config, email, cutoff, cutoff); objects.set(`/ledger/erasure-events/v1/${event.eventId}.json`, serializeErasureEvent(event)); }
