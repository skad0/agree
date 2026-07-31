import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import test from "node:test";
import { createApp } from "../src/app.js";
import { backupDatabase, restoreDatabase } from "../src/backup.js";
import { openDatabase } from "../src/db.js";
import { hashResponseSubmissionToken, issueRequestCapability, issueResponseSubmissionToken, verifyRequestCapability } from "../src/security.js";
import { drainResponseObjectWork } from "../src/response-storage.js";

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
    for (const locale of ["he", "ar", "yi", "ru", "uk", "en", "am"]) {
      const response = await app.request(`/${locale}`);
      assert.equal(response.status, 200, locale);
      const html = await response.text();
      assert.match(html, new RegExp(`<html lang="${locale}" dir="${["he", "ar", "yi"].includes(locale) ? "rtl" : "ltr"}"`));
      assert.match(html, /href="\/uk(?:\?[^\"]*)?"[^>]*>Українська</, `Ukrainian selector missing from /${locale}`);
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
    assert.match(html, /href="\/uk\/standard\?lang=1"/);
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
    assert.match(await (await app.request("/uk/standard")).text(), /Стандарт прозорості для кожної партії/);
    assert.doesNotMatch(await (await app.request("/uk/government-model")).text(), /translation unavailable/);

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

test("Amharic pages deliver hashed Ethiopic fonts with scoped metric rules", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-amharic-fonts-"));
  try {
    const { app, close } = createApp({ sqlitePath: join(dir, "app.db") });
    const page = await app.request("/am");
    assert.equal(page.status, 200);
    const html = await page.text();
    const cssPath = html.match(/href="(\/assets\/app-[^"]+\.css)"/)?.[1];
    assert.ok(cssPath, html);
    const cssResponse = await app.request(cssPath);
    assert.equal(cssResponse.status, 200);
    const css = await cssResponse.text();
    const fontPaths = [...css.matchAll(/url\((\/assets\/noto-sans-ethiopic-(?:400|700)-[^)]+\.woff2)\)/g)].map((match) => match[1]!);
    assert.equal(new Set(fontPaths).size, 2);
    assert.ok(fontPaths.some((path) => path.includes("-400-")));
    assert.ok(fontPaths.some((path) => path.includes("-700-")));
    assert.match(css, /html\[lang=am\]\s*\{[^}]*--font:\s*var\(--amharic-font\)/s);
    assert.match(css, /html\[lang=am\]\s+h1\s*\{[^}]*line-height:\s*1\.14/s);
    assert.match(css, /html\[lang=am\]\s+textarea\s*\{[^}]*line-height:\s*1\.65/s);
    for (const fontPath of fontPaths) {
      const font = await app.request(fontPath!);
      assert.equal(font.status, 200, fontPath);
      assert.equal(font.headers.get("content-type"), "font/woff2");
      assert.match(font.headers.get("cache-control") ?? "", /immutable/);
      assert.ok((await font.arrayBuffer()).byteLength > 0, fontPath);
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
    for (const locale of ["he", "ar", "yi", "ru", "uk", "en", "am"]) {
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

test("locale negotiation and Ukrainian selectors resolve correctly", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-uk-locale-"));
  try {
    const { app, close } = createApp({ sqlitePath: join(dir, "app.db") });
    const root = await app.request("/", { headers: { "Accept-Language": "uk-UA,uk;q=0.9,en;q=0.8" } });
    assert.equal(root.status, 302);
    assert.equal(root.headers.get("location"), "/uk");
    const form = await getForm(app, "/uk/request/build?recipient=1");
    assert.match(form.html, /<option value="uk"[^>]*selected[^>]*>Українська<\/option>/);
    assert.match(form.html, /<html lang="uk" dir="ltr"/);
    close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("appeals render in seven locales, count every action, and do not store personal text", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-request-"));
  try {
    const runtime = createApp({ sqlitePath: join(dir, "app.db"), env: { NODE_ENV: "test", SESSION_SECRET: "test-secret" } });
    for (const locale of ["he", "ar", "yi", "ru", "uk", "en", "am"]) {
      const form = await getForm(runtime.app, `/${locale}/request/build?recipient=1`);
      const response = await postForm(runtime.app, `/${locale}/request/preview`, {
        csrf: form.csrf, recipientId: "1", demandId: "1", messageLocale: locale,
        name: "A Citizen", city: "A City", context: "PRIVATE-CONTEXT"
      }, form.cookie);
      assert.equal(response.status, 200, locale);
      const html = await response.text();
      assert.match(html, /PRIVATE-CONTEXT/);
      assert.doesNotMatch(html, /translation unavailable/, locale);
      // Templates must carry real line breaks, not the literal backslash-n that SQLite stores verbatim.
      assert.doesNotMatch(html, /\\n/, locale);
    }
    const request = runtime.db.prepare("SELECT id, selected_demands FROM generated_requests ORDER BY id DESC LIMIT 1").get() as { id: number; selected_demands: string };
    assert.doesNotMatch(request.selected_demands, /PRIVATE-CONTEXT/);
    const actionForm = await getForm(runtime.app, "/en/request/build?recipient=1");
    const previewForAction = await postForm(runtime.app, "/en/request/preview", { csrf: actionForm.csrf, recipientId: "1", demandId: "1", messageLocale: "en" }, actionForm.cookie);
    const actionHtml = await previewForAction.text();
    const capability = actionHtml.match(/name="capability" value="([^"]+)"/)?.[1];
    const actionRequestId = actionHtml.match(/name="requestId" value="(\d+)"/)?.[1];
    assert.ok(capability); assert.ok(actionRequestId);
    const performed = ["email_opened", "whatsapp_opened", "text_copied", "shared_x", "shared_facebook", "shared_whatsapp", "shared_telegram"];
    for (const action of performed) {
      const response = await postForm(runtime.app, action === "text_copied" ? "/en/request/copy" : "/en/request/action", action === "text_copied"
        ? { csrf: actionForm.csrf, requestId: actionRequestId, capability }
        : { csrf: actionForm.csrf, requestId: actionRequestId, capability, action, subject: "S", message: "EMAIL", whatsappMessage: "WA", socialMessage: "POST" }, actionForm.cookie);
      assert.equal(response.status, action === "text_copied" ? 204 : 200, action);
    }
    const sent = await postForm(runtime.app, "/en/request/report-sent", { csrf: actionForm.csrf, requestId: actionRequestId, capability }, actionForm.cookie);
    assert.equal(sent.status, 303);
    const actions = runtime.db.prepare("SELECT action_type FROM request_actions WHERE generated_request_id = ? ORDER BY action_type").all(Number(actionRequestId)).map((row) => row.action_type);
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
    const actionPreview = await postForm(runtime.app, "/en/request/preview", { csrf: form.csrf, recipientId: "3", demandId: "1", messageLocale: "en" }, form.cookie);
    const actionPreviewHtml = await actionPreview.text();
    const capability = actionPreviewHtml.match(/name="capability" value="([^"]+)"/)?.[1];
    const actionRequestId = actionPreviewHtml.match(/name="requestId" value="(\d+)"/)?.[1];
    assert.ok(capability); assert.ok(actionRequestId);
    const targets: Record<string, RegExp> = {
      shared_x: /https:\/\/x\.com\/intent\/post\?text=POST/,
      shared_facebook: /facebook\.com\/sharer\/sharer\.php\?u=https%3A%2F%2Fcampaign\.test%2Fen/,
      shared_whatsapp: /https:\/\/wa\.me\/\?text=POST/,
      shared_telegram: /t\.me\/share\/url\?url=https%3A%2F%2Fcampaign\.test%2Fen&amp;text=POST/
    };
    for (const [action, expected] of Object.entries(targets)) {
      const response = await postForm(runtime.app, "/en/request/action", {
        csrf: form.csrf, requestId: actionRequestId, capability, action, socialMessage: "POST"
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
  let uploaded = 0; let responseCountAtPut = -1; let pendingWorkAtPut = -1; let runtime: ReturnType<typeof createApp> | undefined; const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => { if (String(input).startsWith("http://storage.test")) { uploaded = (init?.body as Uint8Array).byteLength; responseCountAtPut = Number(runtime?.db.prepare("SELECT count(*) count FROM submitted_responses").get()?.count ?? -1); pendingWorkAtPut = Number(runtime?.db.prepare("SELECT count(*) count FROM response_object_work WHERE state = 'upload_pending'").get()?.count ?? -1); return new Response(null, { status: 200 }); } return originalFetch(input, init); };
  try {
    runtime = createApp({ sqlitePath: join(dir, "app.db"), env: {
      NODE_ENV: "test", SESSION_SECRET: "test-secret", R2_ACCOUNT_ID: "test", R2_ACCESS_KEY_ID: "key",
      R2_SECRET_ACCESS_KEY: "secret", R2_BUCKET: "bucket", R2_ENDPOINT: "http://storage.test"
    } });
    const form = await getForm(runtime.app, "/en/responses/new");
    const body = new FormData();
    const submissionToken = form.html.match(/name="submissionToken" value="([^"]+)"/)?.[1] ?? "";
    Object.entries({ csrf: form.csrf, submissionToken, recipientId: "1", receivedAt: "2026-01-01", channel: "email", responseText: "Official reply", email: "sender@example.org", consent: "yes" })
      .forEach(([key, value]) => body.set(key, value));
    body.set("file", new File([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1])], "reply.png", { type: "image/png" }));
    const response = await runtime.app.request("/en/responses", { method: "POST", headers: { cookie: form.cookie }, body });
    assert.equal(response.status, 303);
    assert.ok(uploaded > 0);
    assert.equal(responseCountAtPut, 0);
    assert.equal(pendingWorkAtPut, 1);
    assert.equal(runtime.db.prepare("SELECT status FROM submitted_responses").get()?.status, "new");
    assert.equal(runtime.db.prepare("SELECT mime FROM submitted_response_files").get()?.mime, "image/png");
    assert.equal(runtime.db.prepare("SELECT count(*) count FROM response_object_work").get()?.count, 0);
    const location = response.headers.get("location") ?? "";
    assert.equal(location, "/en/responses/thanks");
    assert.doesNotMatch(location, /Official reply|sender@example.org/);
    const thanks = await runtime.app.request(location);
    assert.equal(thanks.status, 200);
    assert.match(await thanks.text(), /safe to refresh/);
    runtime.close();
  } finally {
    globalThis.fetch = originalFetch;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("concurrent same-token file submissions use distinct intents and keep only the winner", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-response-concurrency-"));
  const originalFetch = globalThis.fetch;
  const puts: { key: string; data: Uint8Array; resolve: (response: Response) => void }[] = [];
  const deleted: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("challenges.cloudflare.com/turnstile")) return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "content-type": "application/json" } });
    if (url.startsWith("http://storage.test")) {
      const key = new URL(url).pathname.split("/").slice(2).join("/");
      if (init?.method === "DELETE") { deleted.push(key); return new Response(null, { status: 204 }); }
      const data = new Uint8Array(init?.body as Uint8Array);
      return new Promise<Response>((resolve) => puts.push({ key, data, resolve }));
    }
    return originalFetch(input, init);
  };
  try {
    const runtime = createApp({ sqlitePath: join(dir, "app.db"), env: { NODE_ENV: "test", SESSION_SECRET: "test-secret", TURNSTILE_SITE_KEY: "site", TURNSTILE_SECRET_KEY: "secret", R2_ACCOUNT_ID: "test", R2_ACCESS_KEY_ID: "key", R2_SECRET_ACCESS_KEY: "secret", R2_BUCKET: "bucket", R2_ENDPOINT: "http://storage.test" } });
    const form = await getForm(runtime.app, "/en/responses/new");
    const token = form.html.match(/name="submissionToken" value="([^"]+)"/)?.[1] ?? "";
    const makeBody = (letter: string, turnstile: string) => {
      const body = new FormData();
      Object.entries({ csrf: form.csrf, submissionToken: token, recipientId: "1", receivedAt: "2026-01-01", channel: "email", responseText: letter, email: `${letter.toLowerCase()}@example.org`, consent: "yes", "cf-turnstile-response": turnstile }).forEach(([key, value]) => body.set(key, value));
      body.set("file", new File([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, letter.charCodeAt(0)])], `${letter}.png`, { type: "image/png" }));
      return body;
    };
    const first = runtime.app.request("/en/responses", { method: "POST", headers: { cookie: form.cookie }, body: makeBody("A", "turnstile-a") });
    const second = runtime.app.request("/en/responses", { method: "POST", headers: { cookie: form.cookie }, body: makeBody("B", "turnstile-b") });
    for (let attempt = 0; puts.length < 2 && attempt < 100; attempt++) await new Promise((resolve) => setTimeout(resolve, 1));
    assert.equal(puts.length, 2);
    assert.notEqual(puts[0]!.key, puts[1]!.key);
    puts[0]!.resolve(new Response(null, { status: 200 }));
    for (let attempt = 0; Number(runtime.db.prepare("SELECT count(*) count FROM submitted_responses").get()?.count) < 1 && attempt < 100; attempt++) await new Promise((resolve) => setTimeout(resolve, 1));
    assert.equal(runtime.db.prepare("SELECT count(*) count FROM submitted_responses").get()?.count, 1);
    puts[1]!.resolve(new Response(null, { status: 200 }));
    assert.equal((await first).status, 303);
    assert.equal((await second).status, 303);
    for (let attempt = 0; Number(runtime.db.prepare("SELECT count(*) count FROM response_object_work").get()?.count) > 0 && attempt < 100; attempt++) await new Promise((resolve) => setTimeout(resolve, 1));
    assert.equal(runtime.db.prepare("SELECT count(*) count FROM submitted_responses").get()?.count, 1);
    assert.equal(runtime.db.prepare("SELECT count(*) count FROM response_submission_nonces").get()?.count, 1);
    const winner = runtime.db.prepare("SELECT response_text, object_key FROM submitted_responses JOIN submitted_response_files ON submitted_response_files.response_id = submitted_responses.id").get() as { response_text: string; object_key: string };
    const winnerData = puts.find((put) => put.key === winner.object_key)?.data.at(-1);
    assert.equal(winnerData, winner.response_text.charCodeAt(0));
    assert.deepEqual(deleted, [puts.find((put) => put.key !== winner.object_key)!.key]);
    runtime.close();
  } finally { globalThis.fetch = originalFetch; rmSync(dir, { recursive: true, force: true }); }
});

test("ambiguous aborted PUT retains delayed cleanup until a late remote commit is safe to delete", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-response-put-timeout-"));
  const originalFetch = globalThis.fetch; let putSignal: AbortSignal | undefined; const remoteObjects = new Set<string>(); const deleted: string[] = [];
  globalThis.fetch = async (input, init) => {
    if (String(input).includes("challenges.cloudflare.com/turnstile")) return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "content-type": "application/json" } });
    if (String(input).startsWith("http://storage.test")) {
      const key = new URL(String(input)).pathname.split("/").slice(2).join("/");
      if (init?.method === "DELETE") { deleted.push(key); remoteObjects.delete(key); return new Response(null, { status: 204 }); }
      putSignal = init?.signal as AbortSignal;
      return new Promise<Response>((_, reject) => putSignal!.addEventListener("abort", () => { remoteObjects.add(key); reject(new DOMException("timed out", "TimeoutError")); }, { once: true }));
    }
    return originalFetch(input, init);
  };
  try {
    const runtime = createApp({ sqlitePath: join(dir, "agree.db"), env: { NODE_ENV: "test", SESSION_SECRET: "test-secret", RESPONSE_PUT_TIMEOUT_MS: "5", TURNSTILE_SITE_KEY: "site", TURNSTILE_SECRET_KEY: "secret", R2_ACCOUNT_ID: "test", R2_ACCESS_KEY_ID: "key", R2_SECRET_ACCESS_KEY: "secret", R2_BUCKET: "bucket", R2_ENDPOINT: "http://storage.test" } });
    const form = await getForm(runtime.app, "/en/responses/new");
    const body = new FormData();
    Object.entries({ csrf: form.csrf, submissionToken: form.html.match(/name="submissionToken" value="([^"]+)"/)?.[1] ?? "", recipientId: "1", receivedAt: "2026-01-01", channel: "email", responseText: "Ambiguous", email: "ambiguous@example.org", consent: "yes", "cf-turnstile-response": "valid" }).forEach(([key, value]) => body.set(key, value));
    body.set("file", new File([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 9])], "late.png", { type: "image/png" }));
    assert.equal((await runtime.app.request("/en/responses", { method: "POST", headers: { cookie: form.cookie }, body })).status, 303);
    assert.ok(putSignal);
    assert.equal(remoteObjects.size, 1);
    assert.deepEqual(deleted, []);
    assert.equal(runtime.db.prepare("SELECT state FROM response_object_work").get()?.state, "delete_pending");
    const next = Date.parse(String(runtime.db.prepare("SELECT next_attempt_at FROM response_object_work").get()?.next_attempt_at));
    assert.ok(next > Date.now() + 5_000);
    assert.equal(runtime.db.prepare("SELECT count(*) count FROM submitted_responses").get()?.count, 0);
    await drainResponseObjectWork(runtime.db, runtime.config, next + 1);
    assert.equal(deleted.length, 1);
    assert.equal(remoteObjects.size, 0);
    assert.equal(runtime.db.prepare("SELECT count(*) count FROM response_object_work").get()?.count, 0);
    runtime.close();
  } finally { globalThis.fetch = originalFetch; rmSync(dir, { recursive: true, force: true }); }
});

test("TypeError PUT failures are also retained as delayed ambiguous cleanup", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-response-put-typeerror-")); const originalFetch = globalThis.fetch; let deletes = 0;
  globalThis.fetch = async (input, init) => {
    if (String(input).includes("challenges.cloudflare.com/turnstile")) return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "content-type": "application/json" } });
    if (String(input).startsWith("http://storage.test")) { if (init?.method === "DELETE") { deletes += 1; return new Response(null, { status: 204 }); } throw new TypeError("transport failed"); }
    return originalFetch(input, init);
  };
  try {
    const runtime = createApp({ sqlitePath: join(dir, "agree.db"), env: { NODE_ENV: "test", SESSION_SECRET: "test-secret", RESPONSE_PUT_TIMEOUT_MS: "5", TURNSTILE_SITE_KEY: "site", TURNSTILE_SECRET_KEY: "secret", R2_ACCOUNT_ID: "test", R2_ACCESS_KEY_ID: "key", R2_SECRET_ACCESS_KEY: "secret", R2_BUCKET: "bucket", R2_ENDPOINT: "http://storage.test" } });
    const form = await getForm(runtime.app, "/en/responses/new"); const body = new FormData();
    Object.entries({ csrf: form.csrf, submissionToken: form.html.match(/name="submissionToken" value="([^"]+)"/)?.[1] ?? "", recipientId: "1", receivedAt: "2026-01-01", channel: "email", responseText: "Transport failure", email: "transport@example.org", consent: "yes", "cf-turnstile-response": "valid" }).forEach(([key, value]) => body.set(key, value));
    body.set("file", new File([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 3])], "transport.png", { type: "image/png" }));
    assert.equal((await runtime.app.request("/en/responses", { method: "POST", headers: { cookie: form.cookie }, body })).status, 303);
    const next = Date.parse(String(runtime.db.prepare("SELECT next_attempt_at FROM response_object_work").get()?.next_attempt_at));
    assert.ok(next > Date.now() + 5_000);
    assert.equal(deletes, 0);
    await drainResponseObjectWork(runtime.db, runtime.config, next + 1);
    assert.equal(deletes, 1);
    assert.equal(runtime.db.prepare("SELECT count(*) count FROM response_object_work").get()?.count, 0);
    runtime.close();
  } finally { globalThis.fetch = originalFetch; rmSync(dir, { recursive: true, force: true }); }
});

test("response submission tokens are opaque, replay-safe, and tombstone known expired tokens", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-response-token-"));
  try {
    const runtime = createApp({ sqlitePath: join(dir, "app.db"), env: { NODE_ENV: "test", SESSION_SECRET: "test-secret" } });
    const form = await getForm(runtime.app, "/en/responses/new");
    const token = form.html.match(/name="submissionToken" value="([^"]+)"/)?.[1] ?? "";
    const values = { csrf: form.csrf, submissionToken: token, recipientId: "1", receivedAt: "2026-01-01", channel: "email", responseText: "One response", email: "sender@example.org", consent: "yes" };
    const first = await postForm(runtime.app, "/en/responses", values, form.cookie);
    assert.equal(first.status, 303);
    assert.equal((await postForm(runtime.app, "/en/responses", values, form.cookie)).status, 303);
    assert.equal(runtime.db.prepare("SELECT count(*) count FROM submitted_responses").get()?.count, 1);
    assert.equal(runtime.db.prepare("SELECT count(*) count FROM response_submission_nonces WHERE token_hash = ?").get(hashResponseSubmissionToken(token))?.count, 1);
    assert.doesNotMatch(JSON.stringify(runtime.db.prepare("SELECT * FROM response_submission_nonces").all()), new RegExp(token));
    const tampered = { ...values, submissionToken: `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}` };
    assert.equal((await postForm(runtime.app, "/en/responses", tampered, form.cookie)).status, 403);

    const expired = issueResponseSubmissionToken(runtime.config, Date.now() - 48 * 60 * 60 * 1000);
    runtime.db.prepare("INSERT INTO response_submission_nonces (token_hash, outcome, created_at, updated_at) VALUES (?, 'completed', 'now', 'now')").run(hashResponseSubmissionToken(expired));
    assert.equal((await postForm(runtime.app, "/en/responses", { ...values, submissionToken: expired }, form.cookie)).status, 303);
    assert.equal(runtime.db.prepare("SELECT count(*) count FROM submitted_responses").get()?.count, 1);
    runtime.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("failed response upload is compensated through durable delete work", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-response-upload-failure-"));
  const originalFetch = globalThis.fetch; const methods: string[] = [];
  globalThis.fetch = async (input, init) => { if (String(input).startsWith("http://storage.test")) { methods.push(init?.method ?? "GET"); return new Response(null, { status: init?.method === "DELETE" ? 204 : 500 }); } return originalFetch(input, init); };
  try {
    const runtime = createApp({ sqlitePath: join(dir, "app.db"), env: { NODE_ENV: "test", SESSION_SECRET: "test-secret", R2_ACCOUNT_ID: "test", R2_ACCESS_KEY_ID: "key", R2_SECRET_ACCESS_KEY: "secret", R2_BUCKET: "bucket", R2_ENDPOINT: "http://storage.test" } });
    const form = await getForm(runtime.app, "/en/responses/new");
    const body = new FormData();
    Object.entries({ csrf: form.csrf, submissionToken: form.html.match(/name="submissionToken" value="([^"]+)"/)?.[1] ?? "", recipientId: "1", receivedAt: "2026-01-01", channel: "email", responseText: "Upload failure", email: "failure@example.org", consent: "yes" }).forEach(([key, value]) => body.set(key, value));
    body.set("file", new File([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], "failure.png", { type: "image/png" }));
    assert.equal((await runtime.app.request("/en/responses", { method: "POST", headers: { cookie: form.cookie }, body })).status, 303);
    assert.deepEqual(methods, ["PUT"]);
    const next = Date.parse(String(runtime.db.prepare("SELECT next_attempt_at FROM response_object_work").get()?.next_attempt_at));
    assert.ok(next > Date.now() + 30_000);
    await drainResponseObjectWork(runtime.db, runtime.config, next + 1);
    assert.deepEqual(methods, ["PUT", "DELETE"]);
    assert.equal(runtime.db.prepare("SELECT count(*) count FROM submitted_responses").get()?.count, 0);
    assert.equal(runtime.db.prepare("SELECT count(*) count FROM response_object_work").get()?.count, 0);
    runtime.close();
  } finally { globalThis.fetch = originalFetch; rmSync(dir, { recursive: true, force: true }); }
});

test("privacy deletion queues response objects, erases nonce links, and preserves unrelated responses", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-response-delete-"));
  const originalFetch = globalThis.fetch; const deleted: string[] = []; let responseCountAtDelete = -1;
  let runtime: ReturnType<typeof createApp> | undefined;
  globalThis.fetch = async (input, init) => { if (String(input).startsWith("http://storage.test") && init?.method === "DELETE") { deleted.push(new URL(String(input)).pathname); responseCountAtDelete = Number(runtime?.db.prepare("SELECT count(*) count FROM submitted_responses").get()?.count ?? -1); return new Response(null, { status: 204 }); } return originalFetch(input, init); };
  try {
    runtime = createApp({ sqlitePath: join(dir, "app.db"), env: { NODE_ENV: "test", SESSION_SECRET: "test-secret", R2_ACCOUNT_ID: "test", R2_ACCESS_KEY_ID: "key", R2_SECRET_ACCESS_KEY: "secret", R2_BUCKET: "bucket", R2_ENDPOINT: "http://storage.test" } });
    const support = await submitSupport(runtime.app, "delete-response@example.org");
    await verifySupport(runtime.app, support.token);
    const matching = Number(runtime.db.prepare(`INSERT INTO submitted_responses (recipient_id, received_at, channel, response_text, submitter_email, consent_at, status, created_at)
      VALUES (1, '2026-01-01', 'email', 'private', ' Delete-Response@Example.org ', 'now', 'new', 'now')`).run().lastInsertRowid);
    const unrelated = Number(runtime.db.prepare(`INSERT INTO submitted_responses (recipient_id, received_at, channel, response_text, submitter_email, consent_at, status, created_at)
      VALUES (1, '2026-01-01', 'email', 'keep', 'other@example.org', 'now', 'new', 'now')`).run().lastInsertRowid);
    runtime.db.prepare("INSERT INTO submitted_response_files (response_id, object_key, mime, size, uploaded_at) VALUES (?, 'responses/delete-me.png', 'image/png', 8, 'now')").run(matching);
    const nonce = issueResponseSubmissionToken(runtime.config);
    runtime.db.prepare("INSERT INTO response_submission_nonces (token_hash, response_id, outcome, created_at, updated_at) VALUES (?, ?, 'completed', 'now', 'now')").run(hashResponseSubmissionToken(nonce), matching);
    const request = await getForm(runtime.app, "/en/delete-data");
    const sent = await postForm(runtime.app, "/en/delete-data", { csrf: request.csrf, email: " Delete-Response@Example.org ", consent: "yes" }, request.cookie);
    const deletionToken = (await sent.text()).match(/\/en\/delete-data\?token=([^"&]+)/)?.[1]; assert.ok(deletionToken);
    const confirmation = await getForm(runtime.app, `/en/delete-data?token=${deletionToken}`);
    assert.equal((await postForm(runtime.app, "/en/delete-data", { csrf: confirmation.csrf, token: deletionToken }, confirmation.cookie)).status, 200);
    assert.equal(runtime.db.prepare("SELECT count(*) count FROM submitted_responses WHERE id = ?").get(matching)?.count, 0);
    assert.equal(runtime.db.prepare("SELECT count(*) count FROM submitted_responses WHERE id = ?").get(unrelated)?.count, 1);
    assert.deepEqual({ ...runtime.db.prepare("SELECT outcome, response_id FROM response_submission_nonces WHERE token_hash = ?").get(hashResponseSubmissionToken(nonce)) as Record<string, unknown> }, { outcome: "erased", response_id: null });
    assert.equal(runtime.db.prepare("SELECT count(*) count FROM submitted_response_files WHERE response_id = ?").get(matching)?.count, 0);
    assert.equal(responseCountAtDelete, 1);
    assert.equal(deleted.length, 1);
    runtime.close();
  } finally { globalThis.fetch = originalFetch; rmSync(dir, { recursive: true, force: true }); }
});

test("response object work retries deletes and drains stale upload intents", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-response-work-")); const originalFetch = globalThis.fetch; let deletes = 0;
  globalThis.fetch = async (input, init) => { if (String(input).startsWith("http://storage.test") && init?.method === "DELETE") { deletes += 1; return new Response(null, { status: deletes === 1 ? 500 : 404 }); } return originalFetch(input, init); };
  try {
    const runtime = createApp({ sqlitePath: join(dir, "app.db"), env: { NODE_ENV: "test", SESSION_SECRET: "test-secret", R2_ACCOUNT_ID: "test", R2_ACCESS_KEY_ID: "key", R2_SECRET_ACCESS_KEY: "secret", R2_BUCKET: "bucket", R2_ENDPOINT: "http://storage.test" } });
    const old = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    runtime.db.prepare("INSERT INTO response_object_work (object_key, state, attempts, next_attempt_at, created_at, updated_at) VALUES ('responses/stale.png', 'upload_pending', 0, ?, ?, ?)").run(old, old, old);
    await drainResponseObjectWork(runtime.db, runtime.config);
    assert.equal(runtime.db.prepare("SELECT state FROM response_object_work WHERE object_key = 'responses/stale.png'").get()?.state, "delete_pending");
    await drainResponseObjectWork(runtime.db, runtime.config, Date.now());
    const retry = runtime.db.prepare("SELECT attempts, last_error FROM response_object_work WHERE object_key = 'responses/stale.png'").get() as { attempts: number; last_error: string };
    assert.equal(retry.attempts, 1);
    assert.ok(retry.last_error);
    await drainResponseObjectWork(runtime.db, runtime.config, Date.now() + 10_000);
    assert.equal(runtime.db.prepare("SELECT count(*) count FROM response_object_work WHERE object_key = 'responses/stale.png'").get()?.count, 0);
    assert.equal(deletes, 2);
    runtime.close();
  } finally { globalThis.fetch = originalFetch; rmSync(dir, { recursive: true, force: true }); }
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

test("moderators are confined to response moderation and receive a restricted nav", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-moderator-"));
  try {
    const runtime = createApp({ sqlitePath: join(dir, "app.db"), env: { NODE_ENV: "test", SESSION_SECRET: "test-secret" } });
    runtime.db.prepare("INSERT INTO admins (email, role) VALUES ('moderator@example.org', 'moderator')").run();
    const headers = { "X-Test-Admin-Email": "moderator@example.org" };
    const dashboard = await runtime.app.request("/admin", { headers });
    assert.equal(dashboard.status, 200);
    const dashboardHtml = await dashboard.text();
    assert.match(dashboardHtml, /href="\/admin\/responses"/);
    assert.doesNotMatch(dashboardHtml, /href="\/admin\/settings"|href="\/admin\/supporters"|href="\/admin\/audit"|href="\/admin\/demands"/);
    assert.equal((await runtime.app.request("/admin/responses", { headers })).status, 200);
    const responseId = Number(runtime.db.prepare(`INSERT INTO submitted_responses
      (recipient_id, received_at, channel, response_text, submitter_email, consent_at, status, created_at)
      VALUES (1, '2026-01-01', 'email', 'Reply', 'reply@example.org', 'now', 'new', 'now')`).run().lastInsertRowid);
    const responseForm = await getForm(runtime.app, `/admin/responses/${responseId}`, headers);
    const updated = await postForm(runtime.app, `/admin/responses/${responseId}`, { csrf: responseForm.csrf, status: "confirmed" }, responseForm.cookie, headers);
    assert.equal(updated.status, 303);
    assert.equal(runtime.db.prepare("SELECT status FROM submitted_responses WHERE id = ?").get(responseId)?.status, "confirmed");
    for (const path of ["/admin/demands", "/admin/recipients", "/admin/templates", "/admin/supporters", "/admin/supporters.csv", "/admin/audit", "/admin/settings", "/admin/export/stats"]) {
      assert.equal((await runtime.app.request(path, { headers })).status, 403, path);
    }
    assert.equal((await postForm(runtime.app, "/admin/settings", { csrf: "not-forbidden-to-parse", campaign: "yes" }, "", headers)).status, 403);
    assert.equal((await postForm(runtime.app, "/admin/demands", { csrf: "not-forbidden-to-parse", action: "save", locale: "en", title: "Nope", body: "Nope" }, "", headers)).status, 403);
    runtime.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("request A capability is rejected at every request B action endpoint", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-capability-routes-"));
  try {
    const runtime = createApp({ sqlitePath: join(dir, "app.db"), env: { NODE_ENV: "test", SESSION_SECRET: "test-secret" } });
    const a = await generatedRequest(runtime.app, 1);
    const b = await generatedRequest(runtime.app, 1);
    const wrong = { csrf: b.csrf, requestId: b.requestId, capability: a.capability };
    const action = await postForm(runtime.app, "/en/request/action", { ...wrong, action: "shared_x", socialMessage: "B" }, b.cookie);
    const copy = await postForm(runtime.app, "/en/request/copy", wrong, b.cookie);
    const report = await postForm(runtime.app, "/en/request/report-sent", wrong, b.cookie);
    assert.equal(action.status, 422);
    assert.equal(copy.status, 422);
    assert.equal(report.status, 422);
    assert.equal(runtime.db.prepare("SELECT count(*) count FROM request_actions").get()?.count, 0);
    runtime.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("disabled requests reject action, copy, and report without recording actions", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-disabled-request-actions-"));
  try {
    const runtime = createApp({ sqlitePath: join(dir, "app.db"), env: { NODE_ENV: "test", SESSION_SECRET: "test-secret" } });
    const request = await generatedRequest(runtime.app, 1);
    runtime.db.prepare("UPDATE campaigns SET requests_enabled = 0 WHERE id = 1").run();
    const values = { csrf: request.csrf, requestId: request.requestId, capability: request.capability };
    assert.equal((await postForm(runtime.app, "/en/request/action", { ...values, action: "shared_x" }, request.cookie)).status, 503);
    assert.equal((await postForm(runtime.app, "/en/request/copy", values, request.cookie)).status, 503);
    assert.equal((await postForm(runtime.app, "/en/request/report-sent", values, request.cookie)).status, 503);
    assert.equal(runtime.db.prepare("SELECT count(*) count FROM request_actions").get()?.count, 0);
    runtime.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("copy bypasses Turnstile while a one-use token protects the substantive action", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-turnstile-actions-"));
  const originalFetch = globalThis.fetch;
  let turnstileCalls = 0;
  const usedTurnstileTokens = new Set<string>();
  globalThis.fetch = async (input, init) => {
    if (String(input).includes("challenges.cloudflare.com/turnstile")) {
      turnstileCalls += 1;
      const token = new URLSearchParams(String(init?.body)).get("response") ?? "";
      const success = !usedTurnstileTokens.has(token);
      usedTurnstileTokens.add(token);
      return new Response(JSON.stringify({ success }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return originalFetch(input, init);
  };
  try {
    const runtime = createApp({ sqlitePath: join(dir, "app.db"), env: {
      NODE_ENV: "test", SESSION_SECRET: "test-secret", TURNSTILE_SITE_KEY: "site", TURNSTILE_SECRET_KEY: "secret"
    } });
    const request = await generatedRequest(runtime.app, 1, "preview-token");
    const values = { csrf: request.csrf, requestId: request.requestId, capability: request.capability };
    const copy = await postForm(runtime.app, "/en/request/copy", values, request.cookie);
    assert.equal(copy.status, 204);
    assert.equal(turnstileCalls, 1, "preview used its own token; copy must not call Turnstile");
    const action = await postForm(runtime.app, "/en/request/action", { ...values, action: "shared_x", "cf-turnstile-response": "one-use" }, request.cookie);
    assert.equal(action.status, 200);
    assert.equal(turnstileCalls, 2);
    const replay = await postForm(runtime.app, "/en/request/action", { ...values, action: "shared_x", "cf-turnstile-response": "one-use" }, request.cookie);
    assert.equal(replay.status, 403);
    runtime.close();
  } finally {
    globalThis.fetch = originalFetch;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("request preview, action, and result are private; result shares the handle and preserves language request", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-request-route-headers-"));
  try {
    const runtime = createApp({ sqlitePath: join(dir, "app.db"), env: { NODE_ENV: "test", SESSION_SECRET: "test-secret", APP_BASE_URL: "https://campaign.test" } });
    runtime.db.prepare("INSERT INTO recipients (id, type, email, social_handle, is_active) VALUES (7, 'politician', 'oracle@example.org', '@oracle_handle', 1)").run();
    runtime.db.prepare("INSERT INTO recipient_translations (recipient_id, locale, name) VALUES (7, 'en', 'Oracle Recipient')").run();
    const form = await getForm(runtime.app, "/en/request/build?recipient=7");
    const preview = await postForm(runtime.app, "/en/request/preview", { csrf: form.csrf, recipientId: "7", demandId: "1", messageLocale: "en" }, form.cookie);
    assert.equal(preview.status, 200);
    assert.match(preview.headers.get("cache-control") ?? "", /private/);
    assert.match(preview.headers.get("cache-control") ?? "", /no-store/);
    const html = await preview.text();
    const requestId = html.match(/name="requestId" value="(\d+)"/)?.[1];
    const capability = html.match(/name="capability" value="([^"]+)"/)?.[1];
    assert.ok(requestId); assert.ok(capability);
    const action = await postForm(runtime.app, "/en/request/action", { csrf: form.csrf, requestId, capability, action: "shared_x", socialMessage: "Oracle" }, form.cookie);
    assert.equal(action.status, 200);
    assert.match(action.headers.get("cache-control") ?? "", /private/);
    assert.match(action.headers.get("cache-control") ?? "", /no-store/);
    const result = await runtime.app.request(`/en/request/result?request=${requestId}`);
    assert.equal(result.status, 200);
    assert.match(result.headers.get("cache-control") ?? "", /private/);
    assert.match(result.headers.get("cache-control") ?? "", /no-store/);
    const resultHtml = await result.text();
    assert.match(resultHtml, /%40oracle_handle|@oracle_handle/);
    assert.match(resultHtml, new RegExp(`/he/request/result\\?lang=1&amp;request=${requestId}`));
    assert.match(resultHtml, new RegExp(`/ar/request/result\\?lang=1&amp;request=${requestId}`));
    assert.match(resultHtml, new RegExp(`/uk/request/result\\?lang=1&amp;request=${requestId}`));
    runtime.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("contactless recipients are excluded and unavailable direct actions are not persisted", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-contactless-recipient-"));
  try {
    const runtime = createApp({ sqlitePath: join(dir, "app.db"), env: { NODE_ENV: "test", SESSION_SECRET: "test-secret" } });
    runtime.db.prepare("INSERT INTO recipients (id, type, is_active) VALUES (7, 'politician', 1), (8, 'politician', 1)").run();
    runtime.db.prepare("INSERT INTO recipient_translations (recipient_id, locale, name) VALUES (7, 'en', 'No Contact Recipient'), (8, 'en', 'Email Recipient')").run();
    runtime.db.prepare("UPDATE recipients SET email = 'email@example.org' WHERE id = 8").run();

    const list = await runtime.app.request("/en/request");
    const listHtml = await list.text();
    assert.doesNotMatch(listHtml, /No Contact Recipient/);
    assert.match(listHtml, /Email Recipient/);
    assert.equal((await runtime.app.request("/en/request/build?recipient=7")).headers.get("location"), "/en/request");

    const emailForm = await getForm(runtime.app, "/en/request/build?recipient=8");
    const preview = await postForm(runtime.app, "/en/request/preview", {
      csrf: emailForm.csrf, recipientId: "8", demandId: "1", messageLocale: "en"
    }, emailForm.cookie);
    const previewHtml = await preview.text();
    assert.match(previewHtml, /name="action" value="email_opened"/);
    assert.doesNotMatch(previewHtml, /name="action" value="whatsapp_opened"/);

    const csrf = emailForm.csrf;
    const requestId = Number(runtime.db.prepare("INSERT INTO generated_requests (recipient_id, locale, selected_demands, created_at) VALUES (7, 'en', '[1]', 'now') RETURNING id").get()?.id);
    const capability = issueRequestCapability(requestId, runtime.config);
    const rejected = await postForm(runtime.app, "/en/request/action", {
      csrf, requestId: String(requestId), capability, action: "email_opened", subject: "S", message: "M"
    }, emailForm.cookie);
    assert.equal(rejected.status, 422);
    assert.equal(runtime.db.prepare("SELECT count(*) AS count FROM request_actions WHERE generated_request_id = ?").get(requestId)?.count, 0);
    runtime.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("request capabilities are bound, signed, strictly parsed, and expire", () => {
  const runtime = createApp({ sqlitePath: ":memory:", env: { NODE_ENV: "test", SESSION_SECRET: "capability-secret" } });
  const config = runtime.config;
  const now = Date.parse("2026-01-01T00:00:00.000Z");
  const tokenA = issueRequestCapability(41, config, now);
  const tokenB = issueRequestCapability(42, config, now);
  assert.equal(verifyRequestCapability(tokenA, 41, config, now), true);
  assert.equal(verifyRequestCapability(tokenA, 42, config, now), false);
  assert.equal(verifyRequestCapability(tokenB, 41, config, now), false);
  assert.equal(verifyRequestCapability(`${tokenA.slice(0, -1)}0`, 41, config, now), false);
  assert.equal(verifyRequestCapability(`${tokenA}.extra`, 41, config, now), false);
  assert.equal(verifyRequestCapability(tokenA, 41, config, now + 24 * 60 * 60 * 1000 + 1), false);
  runtime.close();
});

test("demand updates preserve canonical fields when the edit omits them", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-demand-preserve-"));
  try {
    const runtime = createApp({ sqlitePath: join(dir, "app.db"), env: { NODE_ENV: "test", SESSION_SECRET: "test-secret" } });
    runtime.db.prepare("UPDATE demands SET document = 'coalition' WHERE id = 1").run();
    runtime.db.prepare("UPDATE demand_translations SET rationale = 'Keep rationale', verification = 'Keep verification', exceptions = 'Keep exceptions' WHERE demand_id = 1 AND locale = 'en'").run();
    const headers = { "X-Test-Admin-Email": "admin@example.org" };
    runtime.db.prepare("INSERT INTO admins (email, role) VALUES ('admin@example.org', 'admin')").run();
    const form = await getForm(runtime.app, "/admin/demands", headers);
    const demandFormHtml = await (await runtime.app.request("/admin/demands", { headers })).text();
    for (const field of ["document", "rationale", "verification", "exceptions"]) assert.match(demandFormHtml, new RegExp(`name="${field}"`), field);
    const response = await postForm(runtime.app, "/admin/demands", { csrf: form.csrf, action: "save", id: "1", locale: "en", title: "Updated title", body: "Updated body" }, form.cookie, headers);
    assert.equal(response.status, 303);
    const row = runtime.db.prepare("SELECT d.document, dt.rationale, dt.verification, dt.exceptions FROM demands d JOIN demand_translations dt ON dt.demand_id = d.id WHERE d.id = 1 AND dt.locale = 'en'").get() as Record<string, string>;
    assert.equal(row.document, "coalition");
    assert.equal(row.rationale, "Keep rationale");
    assert.equal(row.verification, "Keep verification");
    assert.equal(row.exceptions, "Keep exceptions");
    runtime.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("populated demand edit route round-trips an inactive coalition demand without creating a row", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-demand-edit-route-"));
  try {
    const runtime = createApp({ sqlitePath: join(dir, "app.db"), env: { NODE_ENV: "test", SESSION_SECRET: "test-secret" } });
    const demandId = Number(runtime.db.prepare("INSERT INTO demands (campaign_id, sort_order, is_active, document) VALUES (1, 77, 0, 'coalition')").run().lastInsertRowid);
    runtime.db.prepare(`INSERT INTO demand_translations
      (demand_id, locale, title, body, rationale, verification, exceptions)
      VALUES (?, 'en', 'Existing coalition title', 'Existing coalition body', 'Existing rationale', 'Existing verification', 'Existing exceptions')`).run(demandId);
    runtime.db.prepare("INSERT INTO admins (email, role) VALUES ('admin@example.org', 'admin')").run();
    const headers = { "X-Test-Admin-Email": "admin@example.org" };
    const beforeCount = runtime.db.prepare("SELECT count(*) count FROM demands").get()?.count;
    const edit = await runtime.app.request(`/admin/demands/edit?id=${demandId}&locale=en`, { headers });
    assert.equal(edit.status, 200);
    const editHtml = await edit.text();
    assert.match(editHtml, new RegExp(`<h1>Edit demand #${demandId}</h1>`));
    assert.match(editHtml, new RegExp(`name="id"[^>]*value="${demandId}"`));
    assert.match(editHtml, /name="sortOrder"[^>]*value="77"/);
    assert.match(editHtml, /value="coalition" selected(?:="[^"]*")?/);
    assert.match(editHtml, /value="no" selected(?:="[^"]*")?/);

    const csrf = editHtml.match(/name="csrf" value="([^"]+)"/)?.[1];
    const cookie = edit.headers.get("set-cookie")?.split(";")[0] ?? "";
    const rendered = {
      id: editHtml.match(/name="id"[^>]*value="([^"]+)"/)?.[1] ?? "",
      sortOrder: editHtml.match(/name="sortOrder"[^>]*value="([^"]+)"/)?.[1] ?? "",
      document: "coalition", isActive: "no", locale: "en",
      title: editHtml.match(/name="title"[^>]*value="([^"]*)"/)?.[1] ?? "",
      body: editHtml.match(/<textarea name="body"[^>]*>([\s\S]*?)<\/textarea>/)?.[1] ?? "",
      rationale: editHtml.match(/<textarea name="rationale"[^>]*>([\s\S]*?)<\/textarea>/)?.[1] ?? "",
      verification: editHtml.match(/<textarea name="verification"[^>]*>([\s\S]*?)<\/textarea>/)?.[1] ?? "",
      exceptions: editHtml.match(/<textarea name="exceptions"[^>]*>([\s\S]*?)<\/textarea>/)?.[1] ?? ""
    };
    assert.ok(csrf);
    assert.deepEqual(rendered, {
      id: String(demandId), sortOrder: "77", document: "coalition", isActive: "no", locale: "en",
      title: "Existing coalition title", body: "Existing coalition body", rationale: "Existing rationale",
      verification: "Existing verification", exceptions: "Existing exceptions"
    });
    const updated = await postForm(runtime.app, "/admin/demands", {
      csrf, action: "save", ...rendered, title: "Edited coalition title", body: "Edited coalition body"
    }, cookie, headers);
    assert.equal(updated.status, 303, await updated.text());
    assert.equal(runtime.db.prepare("SELECT count(*) count FROM demands").get()?.count, beforeCount);
    const row = runtime.db.prepare(`SELECT d.id, d.sort_order, d.document, d.is_active, dt.title, dt.body, dt.rationale, dt.verification, dt.exceptions
      FROM demands d JOIN demand_translations dt ON dt.demand_id = d.id AND dt.locale = 'en' WHERE d.id = ?`).get(demandId) as Record<string, unknown>;
    assert.deepEqual({ ...row }, { id: demandId, sort_order: 77, document: "coalition", is_active: 0, title: "Edited coalition title", body: "Edited coalition body", rationale: "Existing rationale", verification: "Existing verification", exceptions: "Existing exceptions" });

    const editAgain = await runtime.app.request(`/admin/demands/edit?id=${demandId}&locale=en`, { headers });
    const editAgainHtml = await editAgain.text();
    const csrfAgain = editAgainHtml.match(/name="csrf" value="([^"]+)"/)?.[1];
    const cookieAgain = editAgain.headers.get("set-cookie")?.split(";")[0] ?? "";
    assert.ok(csrfAgain);
    const blankOptional = await postForm(runtime.app, "/admin/demands", {
      csrf: csrfAgain, action: "save", id: String(demandId), sortOrder: "77", document: "coalition", isActive: "no", locale: "en",
      title: "Edited coalition title", body: "Edited coalition body", rationale: "", verification: "", exceptions: ""
    }, cookieAgain, headers);
    assert.equal(blankOptional.status, 303);
    const optional = runtime.db.prepare("SELECT rationale, verification, exceptions FROM demand_translations WHERE demand_id = ? AND locale = 'en'").get(demandId) as Record<string, unknown>;
    assert.deepEqual({ ...optional }, { rationale: null, verification: null, exceptions: null });
    runtime.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("admin CSV neutralizes spreadsheet formula prefixes", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-csv-"));
  try {
    const runtime = createApp({ sqlitePath: join(dir, "app.db"), env: { NODE_ENV: "test", SESSION_SECRET: "test-secret" } });
    runtime.db.prepare("INSERT INTO admins (email, role) VALUES ('admin@example.org', 'admin')").run();
    runtime.db.prepare("INSERT INTO supporters (email_normalized, name, city, locale, privacy_consent_at, created_at) VALUES ('+email@example.org', '=SUM(1,1)', '@city', 'en', 'now', 'now')").run();
    const response = await runtime.app.request("/admin/supporters.csv", { headers: { "X-Test-Admin-Email": "admin@example.org" } });
    assert.equal(response.status, 200);
    const csv = await response.text();
    assert.match(csv, /"'=SUM\(1,1\)"/);
    assert.match(csv, /"'\+email@example\.org"/);
    assert.match(csv, /"'@city"/);
    runtime.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("admin settings render persisted checkbox state and demand metadata", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-admin-regressions-"));
  try {
    const runtime = createApp({ sqlitePath: join(dir, "app.db"), env: { NODE_ENV: "test", SESSION_SECRET: "test-secret", ADMIN_EMAILS: "admin@example.org" } });
    const headers = { "X-Test-Admin-Email": "admin@example.org" };
    const settings = await getForm(runtime.app, "/admin/settings", headers);
    const savedSettings = await postForm(runtime.app, "/admin/settings", {
      csrf: settings.csrf, campaign: "yes", support: "yes"
    }, settings.cookie, headers);
    assert.equal(savedSettings.status, 303);
    const settingsHtml = await (await runtime.app.request("/admin/settings", { headers })).text();
    assert.match(settingsHtml, /name="support" value="yes" checked/);
    assert.doesNotMatch(settingsHtml, /name="requests" value="yes" checked/);
    assert.doesNotMatch(settingsHtml, /name="responses" value="yes" checked/);

    const demands = await getForm(runtime.app, "/admin/demands", headers);
    const savedDemand = await postForm(runtime.app, "/admin/demands", {
      csrf: demands.csrf, action: "save", document: "coalition", sortOrder: "7", isActive: "yes",
      locale: "en", title: "Metadata demand", body: "Commitment", rationale: "Why", verification: "How", exceptions: "When"
    }, demands.cookie, headers);
    assert.equal(savedDemand.status, 303);
    const row = runtime.db.prepare(`SELECT d.document, dt.rationale, dt.verification, dt.exceptions
      FROM demands d JOIN demand_translations dt ON dt.demand_id = d.id WHERE dt.title = 'Metadata demand'`).get() as Record<string, string>;
    assert.equal(row.document, "coalition");
    assert.equal(row.rationale, "Why");
    assert.equal(row.verification, "How");
    assert.equal(row.exceptions, "When");
    runtime.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("invalid admin recipient input returns an HTML 422 page", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-admin-recipient-"));
  try {
    const runtime = createApp({ sqlitePath: join(dir, "app.db"), env: { NODE_ENV: "test", SESSION_SECRET: "test-secret", ADMIN_EMAILS: "admin@example.org" } });
    const headers = { "X-Test-Admin-Email": "admin@example.org" };
    const form = await getForm(runtime.app, "/admin/recipients", headers);
    const response = await postForm(runtime.app, "/admin/recipients", {
      csrf: form.csrf, action: "save", type: "invalid", locale: "en", name: ""
    }, form.cookie, headers);
    assert.equal(response.status, 422);
    assert.match(response.headers.get("content-type") ?? "", /text\/html/);
    assert.match(await response.text(), /Choose a valid type and locale/);
    runtime.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("request result rejects missing IDs and builds a request-specific recipient share", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-request-result-"));
  try {
    const runtime = createApp({ sqlitePath: join(dir, "app.db"), env: { NODE_ENV: "test", SESSION_SECRET: "test-secret", APP_BASE_URL: "https://campaign.test" } });
    for (const path of ["/en/request/result", "/en/request/result?request=999999", "/en/request/result?request=not-an-id"]) {
      const response = await runtime.app.request(path);
      assert.equal(response.status, 422, path);
      assert.match(response.headers.get("content-type") ?? "", /text\/html/);
    }
    const form = await getForm(runtime.app, "/en/request/build?recipient=1");
    const preview = await postForm(runtime.app, "/en/request/preview", {
      csrf: form.csrf, recipientId: "1", demandId: "1", messageLocale: "en"
    }, form.cookie);
    assert.equal(preview.status, 200);
    const requestId = (await preview.text()).match(/name="requestId" value="(\d+)"/)?.[1];
    assert.ok(requestId);
    const result = await runtime.app.request(`/en/request/result?request=${requestId}`);
    assert.equal(result.status, 200);
    const html = await result.text();
    assert.match(html, /Public Service Office/);
    assert.match(html, new RegExp(`request=${requestId}`));
    assert.match(html, /after(?:%20|&#x20;)the(?:%20|&#x20;)election/);
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

async function generatedRequest(app: ReturnType<typeof createApp>["app"], recipientId: number, turnstile?: string) {
  const form = await getForm(app, `/en/request/build?recipient=${recipientId}`);
  const response = await postForm(app, "/en/request/preview", { csrf: form.csrf, recipientId: String(recipientId), demandId: "1", messageLocale: "en", ...(turnstile ? { "cf-turnstile-response": turnstile } : {}) }, form.cookie);
  assert.equal(response.status, 200);
  const html = await response.text();
  const requestId = html.match(/name="requestId" value="(\d+)"/)?.[1];
  const capability = html.match(/name="capability" value="([^"]+)"/)?.[1];
  assert.ok(requestId); assert.ok(capability);
  return { csrf: form.csrf, cookie: form.cookie, requestId, capability };
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
  return { csrf, cookie: response.headers.get("set-cookie")?.split(";")[0] ?? "", html };
}

function postForm(app: ReturnType<typeof createApp>["app"], path: string, values: Record<string, string>, cookie: string, headers: Record<string, string> = {}) {
  return app.request(path, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie, ...headers },
    body: new URLSearchParams(values)
  });
}
