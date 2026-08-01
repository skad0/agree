import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { createApp } from "../src/app.js";
import { drainResponseObjectWork, enforceRetention, subtractUtcMonths } from "../src/response-storage.js";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const ledgerEnv = { ERASURE_LEDGER_S3_ENDPOINT: "http://ledger.test", ERASURE_LEDGER_S3_ACCESS_KEY: "ledger-key", ERASURE_LEDGER_S3_SECRET_KEY: "ledger-secret", ERASURE_LEDGER_S3_BUCKET: "ledger", ERASURE_LEDGER_HMAC_KEYS: `v1:${Buffer.alloc(32, 7).toString("base64url")}`, ERASURE_LEDGER_ACTIVE_KEY_VERSION: "v1" };

test("deletion link stores only a hash and confirmation is one-use with sibling invalidation", async () => {
  const { app, db, close } = createApp({ sqlitePath: ":memory:", env: { NODE_ENV: "development", ...ledgerEnv, TRUSTED_PROXY: "cloudflare", TRUSTED_PROXY_SECRET: "privacy-test-edge-secret-32-chars!!" } });
  const originalFetch = globalThis.fetch; globalThis.fetch = (async () => new Response(null, { status: 200 })) as typeof fetch;
  try {
    const first = await issue(app, "person@example.org"); const second = await issue(app, "person@example.org");
    assert.match(first.link, /token=/); const raw = new URL(first.link).searchParams.get("token")!;
    assert.equal(db.prepare("SELECT count(*) count FROM privacy_deletion_tokens WHERE token_hash = ?").get(raw)?.count, 0);
    assert.equal(db.prepare("SELECT count(*) count FROM privacy_deletion_tokens WHERE token_hash = ?").get(hash(raw))?.count, 1);
    const confirmed = await confirm(app, raw, "10.0.0.1"); assert.equal(confirmed.status, 200);
    assert.equal(db.prepare("SELECT count(*) count FROM privacy_deletion_tokens WHERE email_normalized = ? AND used_at IS NOT NULL").get("person@example.org")?.count, 2);
    assert.equal((await confirm(app, raw, "10.0.0.2")).status, 400);
    const sibling = new URL(second.link).searchParams.get("token")!; assert.equal((await confirm(app, sibling, "10.0.0.3")).status, 400);
  } finally { globalThis.fetch = originalFetch; close(); }
});

test("retention honors inactive boundary and deletes only one bounded batch", () => {
  const { db, close } = createApp({ sqlitePath: ":memory:", env: { NODE_ENV: "test" } });
  try {
    for (let i = 0; i < 101; i++) db.prepare("INSERT INTO supporters (email_normalized, locale, privacy_consent_at, created_at, last_active_at) VALUES (?, 'en', ?, ?, ?)").run(`old-${i}@example.org`, "2020-01-01", "2020-01-01", "2023-12-31T00:00:00.000Z");
    db.prepare("INSERT INTO supporters (email_normalized, locale, privacy_consent_at, created_at, last_active_at) VALUES ('active@example.org', 'en', '2020', '2020', '2024-01-01T00:00:00.000Z')").run();
    enforceRetention(db, Date.parse("2026-01-01T00:00:00.000Z"));
    assert.equal(db.prepare("SELECT count(*) count FROM supporters WHERE email_normalized LIKE 'old-%'").get()?.count, 1);
    assert.equal(db.prepare("SELECT count(*) count FROM supporters WHERE email_normalized = 'active@example.org'").get()?.count, 1);
  } finally { close(); }
});

test("12-month response retention queues attachments before deleting metadata at the calendar cutoff", () => {
  const { db, close } = createApp({ sqlitePath: ":memory:", env: { NODE_ENV: "test" } });
  try {
    db.prepare("INSERT INTO recipients (type, is_active) VALUES ('party', 1)").run();
    db.prepare("INSERT INTO submitted_responses (recipient_id, received_at, channel, response_text, submitter_email, consent_at, created_at) VALUES (1, '2024-12-31', 'email', 'before', 'before@example.org', '2024-12-31', '2024-12-31')").run();
    db.prepare("INSERT INTO submitted_response_files (response_id, object_key, mime, size, uploaded_at) VALUES (1, 'boundary/object', 'text/plain', 1, '2024-12-31')").run();
    db.prepare("INSERT INTO submitted_responses (recipient_id, received_at, channel, response_text, submitter_email, consent_at, created_at) VALUES (1, '2025-01-01T00:00:00.000Z', 'email', 'equal', 'equal@example.org', '2025-01-01T00:00:00.000Z', '2025-01-01T00:00:00.000Z')").run();
    db.prepare("INSERT INTO submitted_responses (recipient_id, received_at, channel, response_text, submitter_email, consent_at, created_at) VALUES (1, '2025-01-02T00:00:00.000Z', 'email', 'after', 'after@example.org', '2025-01-02T00:00:00.000Z', '2025-01-02T00:00:00.000Z')").run();
    enforceRetention(db, Date.parse("2026-01-01T00:00:00.000Z"));
    assert.equal(db.prepare("SELECT count(*) count FROM submitted_responses").get()?.count, 2);
    assert.equal(db.prepare("SELECT state FROM response_object_work WHERE object_key = 'boundary/object'").get()?.state, "delete_pending");
  } finally { close(); }
});

test("retention anniversaries use UTC calendar months with end-of-month clamping", () => {
  const leapDay = Date.parse("2024-02-29T12:34:56.000Z");
  assert.equal(new Date(subtractUtcMonths(leapDay, 12)).toISOString(), "2023-02-28T12:34:56.000Z");
  assert.equal(new Date(subtractUtcMonths(Date.parse("2025-03-31T00:00:00.000Z"), 12)).toISOString(), "2024-03-31T00:00:00.000Z");
  assert.equal(new Date(subtractUtcMonths(Date.parse("2024-02-29T00:00:00.000Z"), 24)).toISOString(), "2022-02-28T00:00:00.000Z");
  const { db, close } = createApp({ sqlitePath: ":memory:", env: { NODE_ENV: "test" } });
  try {
    const cutoff = Date.parse("2025-02-28T00:00:00.000Z");
    for (const [email, active] of [["before@example.org", "2023-02-27T23:59:59.000Z"], ["equal@example.org", "2023-02-28T00:00:00.000Z"], ["after@example.org", "2023-02-28T00:00:01.000Z"]] as [string, string][]) db.prepare("INSERT INTO supporters (email_normalized, locale, privacy_consent_at, created_at, last_active_at) VALUES (?, 'en', ?, ?, ?)").run(email, active, active, active);
    enforceRetention(db, cutoff);
    assert.equal(db.prepare("SELECT count(*) count FROM supporters WHERE email_normalized = 'before@example.org'").get()?.count, 0);
    assert.equal(db.prepare("SELECT count(*) count FROM supporters WHERE email_normalized IN ('equal@example.org','after@example.org')").get()?.count, 2);
  } finally { close(); }
});

test("migration 009 sanitizes a retained historical audit payload", () => {
  const db = new DatabaseSync(":memory:");
  try {
    for (const name of ["001_schema.sql", "002_seed.sql", "003_social_share.sql", "004_campaign_content.sql", "005_response_lifecycle.sql", "006_knesset_recipients.sql", "007_uk_locale.sql", "008_privacy_retention.sql"]) db.exec(readFileSync(join(process.cwd(), "migrations", name), "utf8"));
    db.prepare("INSERT INTO admins (email, role) VALUES ('fixture@example.org', 'admin')").run();
    db.prepare("INSERT INTO admin_audit_events (admin_id, action, entity, payload, created_at) VALUES (1, 'save', 'supporter', ?, ?)").run('{"email":"private@example.org","name":"Private"}', "2026-01-01");
    db.exec(readFileSync(join(process.cwd(), "migrations", "009_privacy_retention_hardening.sql"), "utf8"));
    assert.equal(db.prepare("SELECT payload FROM admin_audit_events").get()?.payload, "{}");
  } finally { db.close(); }
});

test("privacy confirmation rolls back token consumption when relational deletion fails", async () => {
  const { app, db, close } = createApp({ sqlitePath: ":memory:", env: { NODE_ENV: "development", ...ledgerEnv } });
  const originalFetch = globalThis.fetch; globalThis.fetch = (async () => new Response(null, { status: 200 })) as typeof fetch;
  try {
    db.prepare("INSERT INTO supporters (email_normalized, locale, privacy_consent_at, created_at, last_active_at) VALUES ('rollback@example.org', 'en', '2020', '2020', '2020')").run();
    db.exec("CREATE TRIGGER abort_privacy_update BEFORE UPDATE ON supporters BEGIN SELECT RAISE(ABORT, 'fixture abort'); END");
    const issued = await issue(app, "rollback@example.org"); const token = new URL(issued.link).searchParams.get("token")!;
    assert.equal((await confirm(app, token, "10.0.0.4")).status, 500);
    assert.equal(db.prepare("SELECT count(*) count FROM privacy_deletion_tokens WHERE used_at IS NOT NULL").get()?.count, 0);
    db.exec("DROP TRIGGER abort_privacy_update"); assert.equal((await confirm(app, token, "10.0.0.5")).status, 200);
    assert.equal(db.prepare("SELECT count(*) count FROM privacy_deletion_tokens WHERE used_at IS NOT NULL").get()?.count, 1);
  } finally { globalThis.fetch = originalFetch; close(); }
});

test("historical audit payloads are removed and failed object deletion remains observable and durable", async () => {
  const { db, config, close } = createApp({ sqlitePath: ":memory:", env: { NODE_ENV: "test", R2_ACCOUNT_ID: "a", R2_ACCESS_KEY_ID: "k", R2_SECRET_ACCESS_KEY: "s", R2_BUCKET: "b", R2_ENDPOINT: "http://127.0.0.1:9" } });
  const originalFetch = globalThis.fetch; const errors: unknown[] = [];
  const originalError = console.error;
  try {
    db.prepare("INSERT INTO admins (email, role) VALUES ('admin@example.org', 'admin')").run();
    db.prepare("INSERT INTO admin_audit_events (admin_id, action, entity, payload, created_at) VALUES (1, 'old', 'supporter', ?, ?)").run('{"email":"private@example.org"}', "2020-01-01");
    enforceRetention(db, Date.parse("2026-01-01"));
    assert.equal(db.prepare("SELECT count(*) count FROM admin_audit_events WHERE payload LIKE '%email%'").get()?.count, 0);
    db.prepare("INSERT INTO response_object_work (object_key, state, next_attempt_at, created_at, updated_at) VALUES ('failed/object', 'delete_pending', ?, ?, ?)").run("2020-01-01", "2020-01-01", "2020-01-01");
    globalThis.fetch = (async () => new Response("failure", { status: 500 })) as typeof fetch;
    console.error = (...args: unknown[]) => { errors.push(args.join(" ")); };
    await drainResponseObjectWork(db, config, Date.parse("2026-01-01"));
    const work = db.prepare("SELECT attempts, last_error FROM response_object_work WHERE object_key = 'failed/object'").get() as { attempts: number; last_error: string };
    assert.equal(work.attempts, 1); assert.match(work.last_error, /Object delete failed/); assert.ok(errors.some((value) => String(value).includes("failed/object")));
  } finally { globalThis.fetch = originalFetch; console.error = originalError; close(); }
});

async function issue(app: ReturnType<typeof createApp>["app"], email: string) {
  const page = await app.request("/en/delete-data"); const html = await page.text(); const csrf = html.match(/name="csrf" value="([^"]+)"/)![1]!; const cookie = page.headers.get("set-cookie")!.split(";")[0]!;
  const response = await app.request("/en/delete-data", { method: "POST", headers: { cookie, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrf, email }) });
  const body = await response.text(); return { link: body.match(/href="([^"]*delete-data\?token=[^"]+)"/)![1]!, cookie };
}
async function confirm(app: ReturnType<typeof createApp>["app"], raw: string, ip: string) {
  const page = await app.request(`/en/delete-data?token=${raw}`); const html = await page.text(); const csrf = html.match(/name="csrf" value="([^"]+)"/)![1]!; const cookie = page.headers.get("set-cookie")!.split(";")[0]!;
  return app.request("/en/delete-data", { method: "POST", headers: { cookie, "content-type": "application/x-www-form-urlencoded", "CF-Connecting-IP": ip, "X-Edge-Proxy-Proof": "privacy-test-edge-secret-32-chars!!" }, body: new URLSearchParams({ csrf, token: raw }) });
}
