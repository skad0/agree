import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import test from "node:test";
import { createApp } from "../src/app.js";
import { backupDatabase, restoreDatabase } from "../src/backup.js";
import { openDatabase } from "../src/db.js";

test("health reports a usable SQLite database", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-health-"));
  try {
    const { app, db, close } = createApp({ sqlitePath: join(dir, "app.db") });
    const response = await app.request("/health");
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { status: "ok", database: "ok" });
    const journalMode = db.prepare("PRAGMA journal_mode").get()?.journal_mode;
    assert.equal(journalMode, "wal");
    db.prepare("INSERT INTO supporters (email_normalized, locale, privacy_consent_at, created_at) VALUES ('persist@example.org', 'en', 'now', 'now')").run();
    close();
    const reopened = createApp({ sqlitePath: join(dir, "app.db") });
    assert.equal(reopened.db.prepare("SELECT count(*) count FROM supporters").get()?.count, 1);
    reopened.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("all public locales render with the correct text direction", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-locales-"));
  try {
    const { app, close } = createApp({ sqlitePath: join(dir, "app.db") });
    for (const locale of ["he", "ar", "yi", "ru", "en", "am"]) {
      const response = await app.request(`/${locale}`);
      assert.equal(response.status, 200, locale);
      const html = await response.text();
      assert.match(html, new RegExp(`<html lang="${locale}" dir="${["he", "ar", "yi"].includes(locale) ? "rtl" : "ltr"}"`));
    }
    close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("home and demands are populated from SQLite", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-content-"));
  try {
    const { app, close } = createApp({ sqlitePath: join(dir, "app.db") });
    const home = await app.request("/en");
    assert.match(await home.text(), /Transparent public institutions/);
    const demands = await app.request("/en/demands");
    assert.match(await demands.text(), /Explain decisions in plain language/);
    close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("support verification increments the counter once for a normalized email", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-support-"));
  try {
    const runtime = createApp({ sqlitePath: join(dir, "app.db"), env: { NODE_ENV: "test", SESSION_SECRET: "test-secret" } });
    const first = await submitSupport(runtime.app, " Citizen@Example.org ");
    const second = await submitSupport(runtime.app, "citizen@example.org");
    await verifySupport(runtime.app, first.token);
    await verifySupport(runtime.app, second.token);
    const count = runtime.db.prepare("SELECT count(*) AS count FROM supporters WHERE email_verified_at IS NOT NULL").get()?.count;
    assert.equal(count, 1);
    runtime.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("appeals render in six locales, count four actions, and do not store personal text", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-request-"));
  try {
    const runtime = createApp({ sqlitePath: join(dir, "app.db"), env: { NODE_ENV: "test", SESSION_SECRET: "test-secret" } });
    for (const locale of ["he", "ar", "yi", "ru", "en", "am"]) {
      const form = await getForm(runtime.app, `/${locale}/request/build?recipient=1`);
      const response = await postForm(runtime.app, `/${locale}/request/preview`, {
        csrf: form.csrf, recipientId: "1", demandId: "1", messageLocale: locale,
        name: "A Citizen", city: "A City", context: "PRIVATE-CONTEXT"
      }, form.cookie);
      assert.equal(response.status, 200, locale);
      assert.match(await response.text(), /PRIVATE-CONTEXT/);
    }
    const request = runtime.db.prepare("SELECT id, selected_demands FROM generated_requests ORDER BY id DESC LIMIT 1").get() as { id: number; selected_demands: string };
    assert.doesNotMatch(request.selected_demands, /PRIVATE-CONTEXT/);
    const actionForm = await getForm(runtime.app, "/en/request/build?recipient=1");
    for (const action of ["email_opened", "whatsapp_opened", "text_copied"]) {
      const response = await postForm(runtime.app, "/en/request/action", { csrf: actionForm.csrf, requestId: String(request.id), action }, actionForm.cookie);
      assert.equal(response.status, 200, action);
    }
    const sent = await postForm(runtime.app, "/en/request/report-sent", { csrf: actionForm.csrf, requestId: String(request.id) }, actionForm.cookie);
    assert.equal(sent.status, 303);
    const actions = runtime.db.prepare("SELECT action_type FROM request_actions WHERE generated_request_id = ? ORDER BY action_type").all(request.id).map((row) => row.action_type);
    assert.deepEqual(actions, ["email_opened", "reported_sent", "text_copied", "whatsapp_opened"]);
    runtime.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("response files stream to S3-compatible storage and enter moderation as new", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-response-"));
  let uploaded = 0; const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => { if (String(input).startsWith("http://storage.test")) { uploaded = (init?.body as Uint8Array).byteLength; return new Response(null, { status: 200 }); } return originalFetch(input, init); };
  try {
    const runtime = createApp({ sqlitePath: join(dir, "app.db"), env: {
      NODE_ENV: "test", SESSION_SECRET: "test-secret", R2_ACCOUNT_ID: "test", R2_ACCESS_KEY_ID: "key",
      R2_SECRET_ACCESS_KEY: "secret", R2_BUCKET: "bucket", R2_ENDPOINT: "http://storage.test"
    } });
    const form = await getForm(runtime.app, "/en/responses/new");
    const body = new FormData();
    Object.entries({ csrf: form.csrf, recipientId: "1", receivedAt: "2026-01-01", channel: "email", responseText: "Official reply", email: "sender@example.org", consent: "yes" })
      .forEach(([key, value]) => body.set(key, value));
    body.set("file", new File([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1])], "reply.png", { type: "image/png" }));
    const response = await runtime.app.request("/en/responses", { method: "POST", headers: { cookie: form.cookie }, body });
    assert.equal(response.status, 303);
    assert.ok(uploaded > 0);
    assert.equal(runtime.db.prepare("SELECT status FROM submitted_responses").get()?.status, "new");
    assert.equal(runtime.db.prepare("SELECT mime FROM submitted_response_files").get()?.mime, "image/png");
    runtime.close();
  } finally {
    globalThis.fetch = originalFetch;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("admin rejects direct access and accepts a valid Cloudflare Access JWT", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-access-"));
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = await exportJWK(publicKey); Object.assign(jwk, { kid: "test-key", alg: "RS256", use: "sig" });
  const issuer = "https://access-test.example";
  try {
    const runtime = createApp({ sqlitePath: join(dir, "app.db"), env: { NODE_ENV: "test", SESSION_SECRET: "test-secret", CF_ACCESS_TEAM_DOMAIN: issuer, CF_ACCESS_AUD: "test-audience", CF_ACCESS_TEST_JWKS: JSON.stringify({ keys: [jwk] }) } });
    assert.equal((await runtime.app.request("/admin")).status, 403);
    const token = await new SignJWT({ email: "admin@example.org" }).setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuer(issuer).setAudience("test-audience").setIssuedAt().setExpirationTime("5m").sign(privateKey);
    assert.equal((await runtime.app.request("/admin", { headers: { "Cf-Access-Jwt-Assertion": token } })).status, 200);
    runtime.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("admin content mutations and kill switches are audited", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-admin-"));
  try {
    const runtime = createApp({ sqlitePath: join(dir, "app.db"), env: { NODE_ENV: "test", SESSION_SECRET: "test-secret" } });
    const headers = { "X-Test-Admin-Email": "admin@example.org" };
    const form = await getForm(runtime.app, "/admin/demands", headers);
    const created = await postForm(runtime.app, "/admin/demands", { csrf: form.csrf, action: "save", sortOrder: "2", isActive: "yes", locale: "en", title: "A tested demand", body: "Test body" }, form.cookie, headers);
    assert.equal(created.status, 303);
    const demand = runtime.db.prepare("SELECT demand_id FROM demand_translations WHERE title = 'A tested demand'").get() as { demand_id: number };
    const removed = await postForm(runtime.app, "/admin/demands", { csrf: form.csrf, action: "delete", id: String(demand.demand_id) }, form.cookie, headers);
    assert.equal(removed.status, 303);
    const settings = await getForm(runtime.app, "/admin/settings", headers);
    const disabled = await postForm(runtime.app, "/admin/settings", { csrf: settings.csrf, campaign: "yes", requests: "yes", responses: "yes" }, settings.cookie, headers);
    assert.equal(disabled.status, 303);
    assert.equal(runtime.db.prepare("SELECT support_enabled FROM campaigns WHERE id = 1").get()?.support_enabled, 0);
    assert.equal(runtime.db.prepare("SELECT count(*) count FROM admin_audit_events").get()?.count, 3);
    assert.doesNotMatch(String(runtime.db.prepare("SELECT payload FROM admin_audit_events ORDER BY id DESC LIMIT 1").get()?.payload), /csrf/);
    runtime.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("SQLite backup uploads daily and weekly copies that pass restore integrity", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-backup-test-")); const objects = new Map<string, Buffer>();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => { const path = new URL(String(input)).pathname; if (init?.method === "PUT") { objects.set(path, Buffer.from(init.body as Uint8Array)); return new Response(); } const data = objects.get(path); return new Response(data ? new Uint8Array(data) : null, { status: data ? 200 : 404 }); };
  try {
    const runtime = createApp({ sqlitePath: join(dir, "source.db"), env: { NODE_ENV: "test", SESSION_SECRET: "test-secret", BACKUP_S3_ENDPOINT: "http://backup.test", BACKUP_S3_ACCESS_KEY: "key", BACKUP_S3_SECRET_KEY: "secret", BACKUP_S3_BUCKET: "backups" } });
    const keys = await backupDatabase(runtime.db, runtime.config); assert.equal(keys.length, 2); assert.equal(objects.size, 2);
    const restoredPath = join(dir, "restored.db"); await restoreDatabase(runtime.config, keys[0]!, restoredPath);
    const restored = openDatabase(restoredPath); assert.equal(restored.prepare("SELECT slug FROM campaigns WHERE id = 1").get()?.slug, "civic-request"); restored.close(); runtime.close();
  } finally { globalThis.fetch = originalFetch; rmSync(dir, { recursive: true, force: true }); }
});

test("data deletion requires email-link confirmation and anonymizes matching records", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-delete-"));
  try {
    const runtime = createApp({ sqlitePath: join(dir, "app.db"), env: { NODE_ENV: "test", SESSION_SECRET: "test-secret" } });
    const support = await submitSupport(runtime.app, "delete@example.org"); await verifySupport(runtime.app, support.token);
    const request = await getForm(runtime.app, "/en/delete-data");
    const response = await postForm(runtime.app, "/en/delete-data", { csrf: request.csrf, email: "delete@example.org" }, request.cookie);
    const html = await response.text(); const token = html.match(/\/en\/delete-data\?token=([^"&]+)/)?.[1]; assert.ok(token, html);
    const confirmation = await getForm(runtime.app, `/en/delete-data?token=${token}`);
    const deleted = await postForm(runtime.app, "/en/delete-data", { csrf: confirmation.csrf, token }, confirmation.cookie); assert.equal(deleted.status, 200);
    const row = runtime.db.prepare("SELECT email_normalized, name, deleted_at FROM supporters").get() as { email_normalized: string; name: string | null; deleted_at: string | null };
    assert.notEqual(row.email_normalized, "delete@example.org"); assert.equal(row.name, null); assert.ok(row.deleted_at);
    runtime.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

async function submitSupport(app: ReturnType<typeof createApp>["app"], email: string) {
  const form = await getForm(app, "/en/support");
  const response = await postForm(app, "/en/support", { csrf: form.csrf, email, consent: "yes" }, form.cookie);
  assert.equal(response.status, 200);
  const html = await response.text();
  const token = html.match(/\/verify-email\?token=([^&"]+)/)?.[1];
  assert.ok(token, html);
  return { token };
}

async function verifySupport(app: ReturnType<typeof createApp>["app"], token: string) {
  const form = await getForm(app, `/verify-email?token=${token}&locale=en`);
  const response = await postForm(app, "/verify-email", { csrf: form.csrf, token, locale: "en" }, form.cookie);
  assert.equal(response.status, 200);
}

async function getForm(app: ReturnType<typeof createApp>["app"], path: string, headers: Record<string, string> = {}) {
  const response = await app.request(path, { headers });
  assert.equal(response.status, 200, path);
  const html = await response.text();
  const csrf = html.match(/name="csrf" value="([^"]+)"/)?.[1];
  assert.ok(csrf, html);
  return { csrf, cookie: response.headers.get("set-cookie")?.split(";")[0] ?? "" };
}

function postForm(app: ReturnType<typeof createApp>["app"], path: string, values: Record<string, string>, cookie: string, headers: Record<string, string> = {}) {
  return app.request(path, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie, ...headers },
    body: new URLSearchParams(values)
  });
}
