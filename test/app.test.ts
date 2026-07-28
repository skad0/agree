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

test("campaign documents render from SQLite in every locale", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-content-"));
  try {
    const { app, db, close } = createApp({ sqlitePath: join(dir, "app.db") });
    assert.equal(db.prepare("SELECT count(*) c FROM demands WHERE document = 'standard'").get()?.c, 10);
    assert.equal(db.prepare("SELECT count(*) c FROM demands WHERE document = 'coalition'").get()?.c, 5);

    const home = await app.request("/en");
    assert.match(await home.text(), /Elections held on schedule/);

    // The standard renders the obligation plus all three fixed callouts.
    const standard = await app.request("/en/standard");
    const html = await standard.text();
    assert.match(html, /The commitment/);
    assert.match(html, /Why this matters/);
    assert.match(html, /How it is checked/);
    assert.match(html, /Permitted exceptions/);
    assert.doesNotMatch(html, /A shared candidate mechanism/, "coalition clauses must not leak into the standard");

    const coalition = await app.request("/en/coalition-agreement");
    assert.match(await coalition.text(), /A shared candidate mechanism/);

    // Timeline bars use SVG geometry, because the CSP drops inline style attributes. In RTL the
    // offset is mirrored server-side: days 1-14 sit at x=86 rather than x=0.
    assert.match(await (await app.request("/he/first-100-days")).text(), /class="plan-bar" x="86" y="0" width="14"/);
    assert.match(await (await app.request("/en/first-100-days")).text(), /class="plan-bar" x="0" y="0" width="14"/);

    const model = await app.request("/ru/government-model");
    const modelHtml = await model.text();
    assert.match(modelHtml, /Оборона/);
    assert.match(modelHtml, /Культура, спорт, туризм и наследие/);

    assert.equal((await app.request("/en/demands")).status, 301);
    close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the appearance switcher is served and applied before paint", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-theme-"));
  try {
    const { app, close } = createApp({ sqlitePath: join(dir, "app.db") });
    const html = await (await app.request("/en")).text();

    // Must be render-blocking and same-origin: script-src has no 'unsafe-inline', and a deferred
    // script would paint the wrong theme first.
    const tag = html.match(/<script src="(\/assets\/theme-[^"]+\.js)"><\/script>/);
    assert.ok(tag?.[1], "theme script tag missing or deferred");
    assert.ok(html.indexOf(tag[0]) < html.indexOf("<body"), "theme script must be in head");

    const asset = await app.request(tag[1]);
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get("cache-control") ?? "", /immutable/);
    assert.match(await asset.text(), /localStorage\.getItem\('theme'\)/);

    for (const value of ["light", "dark", "system"]) {
      assert.match(html, new RegExp(`data-theme-set="${value}"`), value);
    }
    close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("every locale has every key used by the templates", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-i18n-"));
  try {
    const { app, close } = createApp({ sqlitePath: join(dir, "app.db") });
    const paths = ["", "/standard", "/coalition-agreement", "/first-100-days", "/government-model", "/about", "/methodology", "/support", "/request", "/responses/new", "/privacy"];
    for (const locale of ["he", "ar", "yi", "ru", "en", "am"]) {
      for (const path of paths) {
        const response = await app.request(`/${locale}${path}`);
        assert.equal(response.status, 200, `/${locale}${path}`);
        const html = await response.text();
        assert.doesNotMatch(html, /translation unavailable/, `/${locale}${path}`);
      }
    }
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

test("appeals render in six locales, count every action, and do not store personal text", async () => {
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
      const html = await response.text();
      assert.match(html, /PRIVATE-CONTEXT/);
      // Templates must carry real line breaks, not the literal backslash-n that SQLite stores verbatim.
      assert.doesNotMatch(html, /\\n/, locale);
    }
    const request = runtime.db.prepare("SELECT id, selected_demands FROM generated_requests ORDER BY id DESC LIMIT 1").get() as { id: number; selected_demands: string };
    assert.doesNotMatch(request.selected_demands, /PRIVATE-CONTEXT/);
    const actionForm = await getForm(runtime.app, "/en/request/build?recipient=1");
    const performed = ["email_opened", "whatsapp_opened", "text_copied", "shared_x", "shared_facebook", "shared_whatsapp", "shared_telegram"];
    for (const action of performed) {
      const response = await postForm(runtime.app, "/en/request/action", {
        csrf: actionForm.csrf, requestId: String(request.id), action,
        subject: "S", message: "EMAIL", whatsappMessage: "WA", socialMessage: "POST"
      }, actionForm.cookie);
      assert.equal(response.status, 200, action);
    }
    const sent = await postForm(runtime.app, "/en/request/report-sent", { csrf: actionForm.csrf, requestId: String(request.id) }, actionForm.cookie);
    assert.equal(sent.status, 303);
    const actions = runtime.db.prepare("SELECT action_type FROM request_actions WHERE generated_request_id = ? ORDER BY action_type").all(request.id).map((row) => row.action_type);
    assert.deepEqual(actions, [...performed, "reported_sent"].sort());
    runtime.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("public post text mentions the handle, falls back to Knesset plus name, and builds share links", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-social-"));
  try {
    const runtime = createApp({ sqlitePath: join(dir, "app.db"), env: { NODE_ENV: "test", SESSION_SECRET: "test-secret", APP_BASE_URL: "https://campaign.test" } });
    const add = (id: number, handle: string | null) => {
      runtime.db.prepare("INSERT INTO recipients (id, type, email, social_handle) VALUES (?, 'politician', 'mk@example.org', ?)").run(id, handle);
      runtime.db.prepare("INSERT INTO recipient_translations (recipient_id, locale, name) VALUES (?, 'en', ?)").run(id, `MK Number ${id}`);
    };
    add(2, "@mk_handle");
    add(3, null);

    const preview = async (recipientId: number) => {
      const form = await getForm(runtime.app, `/en/request/build?recipient=${recipientId}`);
      const response = await postForm(runtime.app, "/en/request/preview", {
        csrf: form.csrf, recipientId: String(recipientId), demandId: "1", messageLocale: "en"
      }, form.cookie);
      assert.equal(response.status, 200);
      return await response.text();
    };

    const withHandle = await preview(2);
    assert.match(withHandle, /@mk_handle/);
    assert.doesNotMatch(withHandle, /Knesset member/);
    assert.match(withHandle, /https:\/\/campaign.test\/en/);

    const withoutHandle = await preview(3);
    assert.match(withoutHandle, /Knesset member MK Number 3/);

    const request = runtime.db.prepare("SELECT id FROM generated_requests ORDER BY id DESC LIMIT 1").get() as { id: number };
    const form = await getForm(runtime.app, "/en/request/build?recipient=3");
    const targets: Record<string, RegExp> = {
      shared_x: /https:\/\/x\.com\/intent\/post\?text=POST/,
      shared_facebook: /facebook\.com\/sharer\/sharer\.php\?u=https%3A%2F%2Fcampaign\.test%2Fen/,
      shared_whatsapp: /https:\/\/wa\.me\/\?text=POST/,
      shared_telegram: /t\.me\/share\/url\?url=https%3A%2F%2Fcampaign\.test%2Fen&amp;text=POST/
    };
    for (const [action, expected] of Object.entries(targets)) {
      const response = await postForm(runtime.app, "/en/request/action", {
        csrf: form.csrf, requestId: String(request.id), action, socialMessage: "POST"
      }, form.cookie);
      assert.equal(response.status, 200, action);
      assert.match(await response.text(), expected, action);
    }
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
    const runtime = createApp({ sqlitePath: join(dir, "app.db"), env: { NODE_ENV: "test", SESSION_SECRET: "test-secret", ADMIN_EMAILS: "admin@example.org", CF_ACCESS_TEAM_DOMAIN: issuer, CF_ACCESS_AUD: "test-audience", CF_ACCESS_TEST_JWKS: JSON.stringify({ keys: [jwk] }) } });
    assert.equal((await runtime.app.request("/admin")).status, 403);
    const token = await new SignJWT({ email: "admin@example.org" }).setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuer(issuer).setAudience("test-audience").setIssuedAt().setExpirationTime("5m").sign(privateKey);
    assert.equal((await runtime.app.request("/admin", { headers: { "Cf-Access-Jwt-Assertion": token } })).status, 200);
    const outsider = await new SignJWT({ email: "outsider@example.org" }).setProtectedHeader({ alg: "RS256", kid: "test-key" })
      .setIssuer(issuer).setAudience("test-audience").setIssuedAt().setExpirationTime("5m").sign(privateKey);
    assert.equal((await runtime.app.request("/admin", { headers: { "Cf-Access-Jwt-Assertion": outsider } })).status, 403);
    runtime.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("admin content mutations and kill switches are audited", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-admin-"));
  try {
    const runtime = createApp({ sqlitePath: join(dir, "app.db"), env: { NODE_ENV: "test", SESSION_SECRET: "test-secret", ADMIN_EMAILS: "admin@example.org" } });
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

test("demand body markdown cannot inject scripts or javascript: links", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-xss-"));
  try {
    const runtime = createApp({ sqlitePath: join(dir, "app.db"), env: { NODE_ENV: "test", SESSION_SECRET: "test-secret" } });
    const demandId = Number(runtime.db.prepare("INSERT INTO demands (campaign_id, sort_order, is_active) VALUES (1, 99, 1)").run().lastInsertRowid);
    runtime.db.prepare("INSERT INTO demand_translations (demand_id, locale, title, body) VALUES (?, 'en', 'XSS probe', ?)")
      .run(demandId, "<script>alert(1)</script> [click](javascript:alert(1)) ![x](data:text/html,x)");
    const html = await (await runtime.app.request("/en/demands")).text();
    assert.doesNotMatch(html, /<script>alert/);
    assert.doesNotMatch(html, /javascript:/);
    assert.doesNotMatch(html, /data:text/);
    runtime.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

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
