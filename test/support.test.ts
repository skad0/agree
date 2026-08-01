import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createApp } from "../src/app.js";

test("support submission does not overwrite a verified supporter", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-support-integrity-"));
  try {
    const runtime = createApp({ sqlitePath: join(dir, "app.db"), env: { NODE_ENV: "test", SESSION_SECRET: "test-secret" } });
    runtime.db.prepare(`INSERT INTO supporters
      (email_normalized, name, city, locale, public_name_allowed, privacy_consent_at, created_at, email_verified_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .run("verified@example.org", "Original Name", "Original City", "en", 1, "original-consent", "created", "verified");

    const form = await runtime.app.request("/en/support");
    const html = await form.text();
    const csrf = html.match(/name="csrf" value="([^"]+)"/)?.[1];
    assert.ok(csrf);
    const cookie = form.headers.get("set-cookie")?.split(";")[0] ?? "";
    const response = await runtime.app.request("/en/support", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded", cookie },
      body: new URLSearchParams({ csrf, email: "verified@example.org", name: "Attacker Name", city: "Attacker City", publicName: "", consent: "yes" })
    });

    assert.equal(response.status, 200);
    const responseHtml = await response.text();
    const renewalToken = responseHtml.match(/\/verify-email\?token=([^&"]+)/)?.[1];
    assert.ok(renewalToken);
    const supporter = runtime.db.prepare(`SELECT name, city, locale, public_name_allowed, privacy_consent_at,
      email_verified_at, last_active_at FROM supporters WHERE email_normalized = ?`).get("verified@example.org");
    assert.deepEqual({ ...supporter }, {
      name: "Original Name", city: "Original City", locale: "en", public_name_allowed: 1,
      privacy_consent_at: "original-consent", email_verified_at: "verified", last_active_at: null
    });
    assert.equal(runtime.db.prepare("SELECT count(*) AS count FROM email_verifications").get()?.count, 1);
    const renewed = await verify(runtime.app, renewalToken);
    assert.equal(renewed.status, 200);
    const activity = runtime.db.prepare("SELECT last_active_at FROM supporters WHERE email_normalized = ?").get("verified@example.org") as { last_active_at: string | null };
    assert.ok(activity.last_active_at);
    assert.equal((await verify(runtime.app, renewalToken)).status, 400);
    runtime.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("re-registering a pending supporter invalidates the old token", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-pending-integrity-"));
  try {
    const runtime = createApp({ sqlitePath: join(dir, "app.db"), env: { NODE_ENV: "test", SESSION_SECRET: "test-secret" } });
    const first = await submit(runtime.app, { email: "pending@example.org", name: "Original Name" });
    const second = await submit(runtime.app, { email: "pending@example.org", name: "Current Name" });
    const pending = runtime.db.prepare("SELECT last_active_at, email_verified_at FROM supporters WHERE email_normalized = ?").get("pending@example.org") as { last_active_at: string | null; email_verified_at: string | null };
    assert.ok(pending.last_active_at);
    assert.equal(pending.email_verified_at, null);

    const oldVerification = await verify(runtime.app, first.token);
    assert.equal(oldVerification.status, 400);
    const currentVerification = await verify(runtime.app, second.token);
    assert.equal(currentVerification.status, 200);
    const supporter = runtime.db.prepare("SELECT name, email_verified_at, last_active_at FROM supporters WHERE email_normalized = ?").get("pending@example.org") as { name: string; email_verified_at: string | null; last_active_at: string | null };
    assert.equal(supporter.name, "Current Name");
    assert.ok(supporter.email_verified_at);
    assert.ok(supporter.last_active_at);
    runtime.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

async function submit(app: ReturnType<typeof createApp>["app"], values: { email: string; name: string }) {
  const form = await app.request("/en/support");
  const html = await form.text();
  const csrf = html.match(/name="csrf" value="([^"]+)"/)?.[1];
  assert.ok(csrf);
  const response = await app.request("/en/support", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: form.headers.get("set-cookie")?.split(";")[0] ?? "" },
    body: new URLSearchParams({ csrf, ...values, consent: "yes" })
  });
  assert.equal(response.status, 200);
  const token = (await response.text()).match(/\/verify-email\?token=([^&"]+)/)?.[1];
  assert.ok(token);
  return { token };
}

async function verify(app: ReturnType<typeof createApp>["app"], token: string) {
  const form = await app.request(`/verify-email?token=${token}&locale=en`);
  const html = await form.text();
  const csrf = html.match(/name="csrf" value="([^"]+)"/)?.[1];
  assert.ok(csrf);
  return app.request("/verify-email", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: form.headers.get("set-cookie")?.split(";")[0] ?? "" },
    body: new URLSearchParams({ csrf, token, locale: "en" })
  });
}
