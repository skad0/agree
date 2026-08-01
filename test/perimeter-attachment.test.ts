import assert from "node:assert/strict";
import test from "node:test";
import { Hono } from "hono";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { createRateLimiter } from "../src/security.js";
import { locales, t } from "../src/i18n.js";
const productionLedger = { ERASURE_LEDGER_S3_ENDPOINT: "https://ledger.example", ERASURE_LEDGER_S3_ACCESS_KEY: "key", ERASURE_LEDGER_S3_SECRET_KEY: "secret", ERASURE_LEDGER_S3_BUCKET: "ledger", ERASURE_LEDGER_HMAC_KEYS: `v1:${Buffer.alloc(32, 7).toString("base64url")}`, ERASURE_LEDGER_ACTIVE_KEY_VERSION: "v1" };

test("client identity ignores spoofed forwarding headers unless Cloudflare is explicitly trusted", async () => {
  const make = (trusted: string | undefined) => {
    const config = loadConfig({ NODE_ENV: "test", TRUSTED_PROXY: trusted, TRUSTED_PROXY_SECRET: trusted ? "edge-secret-012345678901234567890123" : undefined }); const app = new Hono(); const limit = createRateLimiter(config);
    app.use("*", async (context, next) => { (context as any).set("config", config); await next(); });
    app.get("/", (context) => context.text(limit(context, "test", 1, 60) ? "allowed" : "blocked")); return app;
  };
  const untrusted = make(undefined); assert.equal(await (await untrusted.request("/", { headers: { "X-Forwarded-For": "1.1.1.1" } })).text(), "allowed"); assert.equal(await (await untrusted.request("/", { headers: { "X-Forwarded-For": "2.2.2.2" } })).text(), "blocked");
  const trusted = make("cloudflare"); const proof = "edge-secret-012345678901234567890123"; assert.equal(await (await trusted.request("/", { headers: { "CF-Connecting-IP": "1.1.1.1", "X-Edge-Proxy-Proof": proof } })).text(), "allowed"); assert.equal(await (await trusted.request("/", { headers: { "CF-Connecting-IP": "2.2.2.2", "X-Edge-Proxy-Proof": "wrong" } })).text(), "allowed"); assert.equal(await (await trusted.request("/", { headers: { "CF-Connecting-IP": "3.3.3.3" } })).text(), "blocked"); assert.equal(await (await trusted.request("/", { headers: { "CF-Connecting-IP": "2.2.2.2", "X-Edge-Proxy-Proof": proof, "X-Forwarded-For": "1.1.1.1" } })).text(), "allowed"); assert.equal(await (await trusted.request("/", { headers: { "CF-Connecting-IP": "2.2.2.2", "X-Edge-Proxy-Proof": proof } })).text(), "blocked");
});

test("production configuration fails closed without the exact proxy contract", () => {
  assert.throws(() => loadConfig({ ...productionLedger, NODE_ENV: "production", SESSION_SECRET: "secret" }), /TRUSTED_PROXY/);
  assert.throws(() => loadConfig({ ...productionLedger, NODE_ENV: "production", SESSION_SECRET: "secret", TRUSTED_PROXY: "xff" }), /TRUSTED_PROXY/);
  assert.throws(() => loadConfig({ ...productionLedger, NODE_ENV: "production", SESSION_SECRET: "secret", TRUSTED_PROXY: "cloudflare", TRUSTED_PROXY_SECRET: "edge-secret-012345678901234567890123" }), /APP_BASE_URL/);
  assert.throws(() => loadConfig({ ...productionLedger, NODE_ENV: "production", SESSION_SECRET: "secret", TRUSTED_PROXY: "cloudflare", TRUSTED_PROXY_SECRET: "edge-secret-012345678901234567890123", APP_BASE_URL: "http://origin.example" }), /HTTPS/);
  assert.throws(() => loadConfig({ ...productionLedger, NODE_ENV: "production", TRUSTED_PROXY: "cloudflare", TRUSTED_PROXY_SECRET: "edge-secret-012345678901234567890123", APP_BASE_URL: "https://example.org" }), /SESSION_SECRET/);
  assert.equal(loadConfig({ ...productionLedger, NODE_ENV: "production", SESSION_SECRET: "session-secret", TRUSTED_PROXY: "cloudflare", TRUSTED_PROXY_SECRET: "edge-secret-012345678901234567890123", APP_BASE_URL: "https://example.org", PRIVACY_CONTACT_EMAIL: "privacy@example.org" }).trustedProxy, "cloudflare");
});

test("production requires an operational privacy contact and policy renders it", async () => {
  const base = { ...productionLedger, NODE_ENV: "production", SESSION_SECRET: "session-secret", TRUSTED_PROXY: "cloudflare", TRUSTED_PROXY_SECRET: "edge-secret-012345678901234567890123", APP_BASE_URL: "https://example.org" } as const;
  assert.throws(() => loadConfig(base), /PRIVACY_CONTACT_EMAIL/);
  assert.throws(() => loadConfig({ ...base, PRIVACY_CONTACT_EMAIL: "[CAMPAIGN OPERATOR CONTACT TO BE ADDED BEFORE PRODUCTION]" }), /PRIVACY_CONTACT_EMAIL/);
  const config = loadConfig({ ...base, PRIVACY_CONTACT_EMAIL: "privacy@example.org" });
  assert.equal(config.privacyContactEmail, "privacy@example.org");
  const runtime = createApp({ sqlitePath: ":memory:", env: { NODE_ENV: "test", PRIVACY_CONTACT_EMAIL: "privacy@example.org" } });
  try {
    const requiredTerms: Record<string, string[]> = {
      en: ["email", "recipient", "event-level", "Cloudflare", "Turnstile", "cookies"],
      he: ["דוא", "הנמען", "אירועים", "Cloudflare", "Turnstile", "עוגיות"],
      ar: ["البريد", "المستلم", "أحداث", "Cloudflare", "Turnstile", "ملفات تعريف"],
      ru: ["email", "адресат", "событийные", "Cloudflare", "Turnstile", "cookie"],
      uk: ["електронна пошта", "адресата", "подієві", "Cloudflare", "Turnstile", "cookie"],
      am: ["ኢሜይል", "ተቀባዩ", "ክስተት", "Cloudflare", "Turnstile", "ኩኪ"],
      yi: ["בליצפּאָסט", "אַדרעסאַט", "געשעעניש", "Cloudflare", "Turnstile", "קיכלעך"]
    };
    for (const locale of locales) {
      const response = await runtime.app.request(`/${locale}/privacy`);
      const html = await response.text();
      assert.equal(response.status, 200);
      assert.match(html, /privacy@example\.org/);
      assert.equal(t(locale, "privacyBody").split("\n\n").length, 7);
      assert.match(t(locale, "privacyBody"), /\{\{PRIVACY_CONTACT_EMAIL\}\}/);
      for (const term of requiredTerms[locale]!) assert.match(t(locale, "privacyBody"), new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${locale} missing ${term}`);
      assert.match(t(locale, "privacyBody"), /24/);
      assert.match(t(locale, "privacyBody"), /12/);
      assert.doesNotMatch(html, /pre-production|placeholder|заполнитель|заповнювач|عنصر نائب/i);
    }
  } finally { runtime.close(); }
});

test("response attachment requires admin authorization and is forced to inert download headers", async () => {
  const runtime = createApp({ sqlitePath: ":memory:", env: { NODE_ENV: "test", ADMIN_EMAILS: "admin@example.org", R2_ACCOUNT_ID: "account", R2_ACCESS_KEY_ID: "key", R2_SECRET_ACCESS_KEY: "secret", R2_BUCKET: "bucket" } });
  const originalFetch = globalThis.fetch;
  try {
    runtime.db.prepare("INSERT INTO recipients (type, is_active) VALUES ('party', 1)").run();
    runtime.db.prepare("INSERT INTO submitted_responses (recipient_id, received_at, channel, response_text, submitter_email, consent_at, created_at) VALUES (1, 'now', 'email', 'response', 'person@example.org', 'now', 'now')").run();
    runtime.db.prepare("INSERT INTO submitted_response_files (response_id, object_key, mime, size, uploaded_at) VALUES (1, 'private/file.html', 'text/html', 4, 'now')").run();
    assert.equal((await runtime.app.request("/admin/response-files/1")).status, 403);
    globalThis.fetch = (async () => new Response("data", { status: 200 })) as typeof fetch;
    const response = await runtime.app.request("/admin/response-files/1", { headers: { "X-Test-Admin-Email": "admin@example.org" } });
    assert.equal(response.status, 200); assert.equal(response.headers.get("content-type"), "application/octet-stream"); assert.equal(response.headers.get("content-disposition"), 'attachment; filename="response-attachment-1.bin"'); assert.equal(response.headers.get("x-content-type-options"), "nosniff"); assert.equal(response.headers.get("content-security-policy"), "default-src 'none'; sandbox"); assert.equal(response.headers.get("cache-control"), "private, no-store"); assert.equal(await response.text(), "data");
  } finally { globalThis.fetch = originalFetch; runtime.close(); }
});
