import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createErasureEvent, normalizeSubject, serializeErasureEvent, verifyErasureEvent } from "../src/erasure-ledger.js";

const key = Buffer.alloc(32, 9).toString("base64url");
const ledger = { ERASURE_LEDGER_S3_ENDPOINT: "http://ledger.test", ERASURE_LEDGER_S3_ACCESS_KEY: "access", ERASURE_LEDGER_S3_SECRET_KEY: "secret", ERASURE_LEDGER_S3_BUCKET: "ledger", ERASURE_LEDGER_HMAC_KEYS: `old:${key},active:${Buffer.alloc(32, 8).toString("base64url")}`, ERASURE_LEDGER_ACTIVE_KEY_VERSION: "active" };

test("erasure events normalize subjects, separate domains, and verify their versioned MAC", () => {
  const config = loadConfig({ NODE_ENV: "test", ...ledger });
  const event = createErasureEvent(config, " Person@Example.ORG ", "2026-01-02T03:04:05.000Z", "2026-01-02T03:04:05.000Z", "event-id");
  assert.equal(normalizeSubject(" Person@Example.ORG "), "person@example.org");
  assert.equal(createErasureEvent(config, "person@example.org", event.eraseThrough, event.recordedAt, event.eventId).subjectTag, event.subjectTag);
  assert.equal(verifyErasureEvent(config, event), true);
  assert.equal(verifyErasureEvent(config, { ...event, keyVersion: "old" }), false);
  const serialized = new TextDecoder().decode(serializeErasureEvent(event));
  assert.doesNotMatch(serialized, /person@example\.org/i);
  assert.doesNotMatch(`erasure-events/v1/${event.eventId}.json`, /person@example\.org/i);
});

test("production requires a complete ledger store and versioned signing keys", () => {
  const base = { NODE_ENV: "production", SESSION_SECRET: "session", TRUSTED_PROXY: "cloudflare", TRUSTED_PROXY_SECRET: "edge-secret-012345678901234567890123", APP_BASE_URL: "https://example.org", PRIVACY_CONTACT_EMAIL: "privacy@example.org" };
  assert.throws(() => loadConfig(base), /ERASURE_LEDGER/);
  assert.throws(() => loadConfig({ ...base, ...ledger, ERASURE_LEDGER_HMAC_KEYS: "active:not-base64!" }), /ERASURE_LEDGER/);
  assert.equal(loadConfig({ ...base, ...ledger, ERASURE_LEDGER_S3_ENDPOINT: "https://ledger.test" }).erasureLedger.activeVersion, "active");
});

test("ledger upload failure leaves the token and live records unchanged", async () => {
  const runtime = createApp({ sqlitePath: ":memory:", env: { NODE_ENV: "test", ...ledger } });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response("failed", { status: 503 })) as typeof fetch;
  try {
    const issued = await issue(runtime.app, "failure@example.org");
    const token = new URL(issued.link).searchParams.get("token")!;
    const confirmation = await confirmationPage(runtime.app, token);
    assert.equal((await confirm(runtime.app, token, confirmation)).status, 503);
    assert.equal(runtime.db.prepare("SELECT used_at FROM privacy_deletion_tokens WHERE email_normalized = 'failure@example.org'").get()?.used_at, null);
  } finally { globalThis.fetch = originalFetch; runtime.close(); }
});

test("successful ledger upload survives a relational rollback and retry creates harmless distinct events", async () => {
  const runtime = createApp({ sqlitePath: ":memory:", env: { NODE_ENV: "test", ...ledger } });
  const originalFetch = globalThis.fetch; const uploads: string[] = [];
  globalThis.fetch = (async (input, init) => { uploads.push(String(input)); return new Response(null, { status: 200 }); }) as typeof fetch;
  try {
    runtime.db.prepare("INSERT INTO supporters (email_normalized, locale, privacy_consent_at, created_at) VALUES ('rollback@example.org', 'en', '2020-01-01T00:00:00.000Z', '2020-01-01T00:00:00.000Z')").run();
    runtime.db.exec("CREATE TRIGGER abort_erasure BEFORE UPDATE ON supporters BEGIN SELECT RAISE(ABORT, 'fixture abort'); END");
    const issued = await issue(runtime.app, "rollback@example.org"); const token = new URL(issued.link).searchParams.get("token")!;
    const confirmation = await confirmationPage(runtime.app, token);
    assert.equal((await confirm(runtime.app, token, confirmation)).status, 500);
    assert.equal(runtime.db.prepare("SELECT used_at FROM privacy_deletion_tokens WHERE email_normalized = 'rollback@example.org'").get()?.used_at, null);
    assert.equal(uploads.length, 1); assert.match(uploads[0]!, /erasure-events\/v1\/[^/]+\.json$/);
    const retryPage = await confirmationPage(runtime.app, token);
    assert.equal((await confirm(runtime.app, token, retryPage)).status, 500);
    assert.equal(uploads.length, 2); assert.notEqual(uploads[0], uploads[1]);
  } finally { globalThis.fetch = originalFetch; runtime.close(); }
});

async function issue(app: ReturnType<typeof createApp>["app"], email: string) {
  const page = await app.request("/en/delete-data"); const html = await page.text(); const csrf = html.match(/name="csrf" value="([^"]+)"/)![1]!; const cookie = page.headers.get("set-cookie")!.split(";")[0]!;
  const response = await app.request("/en/delete-data", { method: "POST", headers: { cookie, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrf, email }) });
  const body = await response.text(); return { link: body.match(/href="([^"]*delete-data\?token=[^"]+)"/)![1]!, cookie };
}
async function confirmationPage(app: ReturnType<typeof createApp>["app"], token: string) {
  const page = await app.request(`/en/delete-data?token=${token}`); const html = await page.text(); return { csrf: html.match(/name="csrf" value="([^"]+)"/)![1]!, cookie: page.headers.get("set-cookie")!.split(";")[0]! };
}
async function confirm(app: ReturnType<typeof createApp>["app"], token: string, page: { csrf: string; cookie: string }) {
  return app.request("/en/delete-data", { method: "POST", headers: { cookie: page.cookie, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrf: page.csrf, token }) });
}
