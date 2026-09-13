import assert from "node:assert/strict";
import test from "node:test";
import { Hono } from "hono";
import { createApp } from "../src/app.js";
import { loadConfig, publishablePrivacyContactEmail } from "../src/config.js";
import { createRateLimiter } from "../src/security.js";
import { locales, t } from "../src/i18n.js";
const productionBase = { NODE_ENV: "production", SESSION_SECRET: "secret", TRUSTED_PROXY: "cloudflare", TRUSTED_PROXY_SECRET: "edge-secret-012345678901234567890123", APP_BASE_URL: "https://example.org", PRIVACY_CONTACT_EMAIL: "privacy@example.org" };

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
  assert.throws(() => loadConfig({ NODE_ENV: "production", SESSION_SECRET: "secret" }), /TRUSTED_PROXY/);
  assert.throws(() => loadConfig({ NODE_ENV: "production", SESSION_SECRET: "secret", TRUSTED_PROXY: "xff" }), /TRUSTED_PROXY/);
  assert.throws(() => loadConfig({ NODE_ENV: "production", SESSION_SECRET: "secret", TRUSTED_PROXY: "cloudflare", TRUSTED_PROXY_SECRET: "edge-secret-012345678901234567890123" }), /APP_BASE_URL/);
  assert.throws(() => loadConfig({ NODE_ENV: "production", SESSION_SECRET: "secret", TRUSTED_PROXY: "cloudflare", TRUSTED_PROXY_SECRET: "edge-secret-012345678901234567890123", APP_BASE_URL: "http://origin.example" }), /HTTPS/);
  assert.throws(() => loadConfig({ NODE_ENV: "production", TRUSTED_PROXY: "cloudflare", TRUSTED_PROXY_SECRET: "edge-secret-012345678901234567890123", APP_BASE_URL: "https://example.org" }), /SESSION_SECRET/);
  assert.equal(loadConfig(productionBase).trustedProxy, "cloudflare");
});

test("production requires an operational privacy contact and policy renders it", async () => {
  const base = { NODE_ENV: "production", SESSION_SECRET: "session-secret", TRUSTED_PROXY: "cloudflare", TRUSTED_PROXY_SECRET: "edge-secret-012345678901234567890123", APP_BASE_URL: "https://example.org" } as const;
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
      assert.ok(t(locale, "privacyContactFallback").length > 0);
      for (const term of requiredTerms[locale]!) assert.match(t(locale, "privacyBody"), new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${locale} missing ${term}`);
      assert.match(t(locale, "privacyBody"), /24/);
      assert.match(t(locale, "privacyBody"), /12/);
      assert.doesNotMatch(html, /pre-production|placeholder|заполнитель|заповнювач|عنصر نائب/i);
      assert.doesNotMatch(html, /kriant@hey\.com/i);
    }
  } finally { runtime.close(); }
});

test("personal consumer privacy mailboxes are not published on public pages", async () => {
  assert.equal(publishablePrivacyContactEmail("kriant@hey.com"), null);
  assert.equal(publishablePrivacyContactEmail("privacy@example.org"), "privacy@example.org");
  const runtime = createApp({ sqlitePath: ":memory:", env: { NODE_ENV: "test", PRIVACY_CONTACT_EMAIL: "kriant@hey.com" } });
  try {
    for (const path of ["/en/privacy", "/en/methodology", "/he/privacy"]) {
      const html = await (await runtime.app.request(path)).text();
      assert.doesNotMatch(html, /kriant@hey\.com/i);
      assert.doesNotMatch(html, /@hey\.com/i);
      assert.match(html, /campaign privacy contact configured for this site|פרטי הקשר לפרטיות של הקמפיין/);
    }
  } finally { runtime.close(); }
});

test("repository sources never hardcode the owner personal mailbox", async () => {
  const { readdirSync, readFileSync, statSync } = await import("node:fs");
  const { join } = await import("node:path");
  const roots = ["src", "test", "docs", "migrations", "scripts"];
  const skip = new Set(["node_modules", "dist", "data", ".git"]);
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (skip.has(name)) continue;
      const path = join(dir, name);
      const st = statSync(path);
      if (st.isDirectory()) walk(path);
      else if (/\.(ts|tsx|js|json|md|sql|example|yml|yaml|html|txt)$/i.test(name)) {
        const text = readFileSync(path, "utf8");
        if (/kriant@hey\.com/i.test(text)) hits.push(path);
      }
    }
  };
  for (const root of roots) walk(root);
  // Allow this test file to mention the address only as a forbidden example.
  const unexpected = hits.filter((path) => !path.endsWith("perimeter-attachment.test.ts"));
  assert.deepEqual(unexpected, []);
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
