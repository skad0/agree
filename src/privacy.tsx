import { createHash, randomBytes } from "node:crypto";
import type { Hono } from "hono";
import type { Config } from "./config.js";
import type { Db } from "./db.js";
import { sendEmail } from "./email.js";
import { isLocale, t, type Locale } from "./i18n.js";
import { Layout } from "./layout.js";
import { privateNoStore, rememberLocale } from "./public-state.js";
import { JourneyIntro, Surface } from "./components/public-ui.js";
import { recordErasureEvent } from "./erasure-ledger.js";
import { drainResponseObjectWork, queueResponseObjectDelete } from "./response-storage.js";
import { createRateLimiter, issueCsrf, text, Turnstile, validCsrf, validTurnstile } from "./security.js";

export function registerPrivacyRoutes(app: Hono, db: Db, config: Config) {
  const rateLimit = createRateLimiter();
  app.get("/:locale/privacy", (context) => { const locale = localeParam(context.req.param("locale")); if (!locale) return context.notFound(); rememberLocale(context, locale, config); const body = t(locale, "privacyBody").replaceAll("{{PRIVACY_CONTACT_EMAIL}}", config.privacyContactEmail); return context.html(<Layout locale={locale} title={t(locale, "privacyTitle")} path={context.req.path}><div class="privacy-page"><JourneyIntro title={t(locale, "privacyTitle")} /><Surface class="privacy-surface"><div class="privacy-copy">{privacyParagraphs(body)}<p><a href={`/${locale}/delete-data`}>{t(locale, "deleteTitle")}</a></p></div></Surface></div></Layout>); });
  app.get("/:locale/delete-data", (context) => { const locale = localeParam(context.req.param("locale")); if (!locale) return context.notFound(); rememberLocale(context, locale, config); const csrf = issueCsrf(context, config); const token = context.req.query("token"); privateNoStore(context); return context.html(<Layout locale={locale} title={t(locale, "deleteTitle")} path={context.req.path} languageQuery={token ? `token=${encodeURIComponent(token)}` : ""}><div class="privacy-page"><JourneyIntro title={t(locale, "deleteTitle")} /><Surface class="delete-form-surface"><p>{t(locale, "deleteBody")}</p><form class="public-form" method="post"><input type="hidden" name="csrf" value={csrf} />{token ? <><input type="hidden" name="token" value={token} /><Turnstile config={config} /><button type="submit">{t(locale, "deleteConfirm")}</button></> : <><label>{t(locale, "email")}<input type="email" name="email" required /></label><Turnstile config={config} /><button type="submit">{t(locale, "submit")}</button></>}</form></Surface></div></Layout>); });
  app.post("/:locale/delete-data", async (context) => {
    const locale = localeParam(context.req.param("locale")); if (!locale) return context.notFound(); privateNoStore(context); const body = await context.req.parseBody();
    if (!rateLimit(context, "delete", 3, 3600) || !validCsrf(context, config, body)) return statusPage(context, locale, t(locale, "invalidForm"), 403);
    const suppliedToken = text(body.token);
    if (suppliedToken) {
      if (!await validTurnstile(context, config, body)) return statusPage(context, locale, t(locale, "invalidForm"), 403);
      const now = new Date().toISOString();
      const candidate = db.prepare("SELECT id, email_normalized, expires_at, used_at FROM privacy_deletion_tokens WHERE token_hash = ?").get(hashToken(suppliedToken)) as { id: number; email_normalized: string; expires_at: string; used_at: string | null } | undefined;
      if (!candidate || candidate.used_at || candidate.expires_at <= now) return statusPage(context, locale, t(locale, "invalidToken"), 400);
      try { await recordErasureEvent(config, candidate.email_normalized, now); }
      catch { console.error("Privacy erasure ledger upload failed"); return statusPage(context, locale, "Deletion is temporarily unavailable; please retry.", 503); }
      db.exec("BEGIN IMMEDIATE");
      try { const token = db.prepare("SELECT id, email_normalized, expires_at, used_at FROM privacy_deletion_tokens WHERE token_hash = ?").get(hashToken(suppliedToken)) as { id: number; email_normalized: string; expires_at: string; used_at: string | null } | undefined;
        if (!token || token.used_at || token.expires_at <= now) { db.exec("ROLLBACK"); return statusPage(context, locale, t(locale, "invalidToken"), 400); }
        db.prepare("UPDATE privacy_deletion_tokens SET used_at = ? WHERE email_normalized = ? AND used_at IS NULL AND created_at <= ?").run(now, token.email_normalized, now);
        deleteData(db, token.email_normalized, now); db.exec("COMMIT");
      } catch (error) { db.exec("ROLLBACK"); throw error; }
      await drainResponseObjectWork(db, config).catch((error) => console.error("Response object deletion after privacy request failed", error)); return statusPage(context, locale, t(locale, "deleted"));
    }
    if (!await validTurnstile(context, config, body)) return statusPage(context, locale, t(locale, "invalidForm"), 403);
    const email = text(body.email).trim().toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return statusPage(context, locale, t(locale, "invalidForm"), 422);
    const token = randomBytes(32).toString("base64url"); const now = new Date().toISOString(); db.prepare("INSERT INTO privacy_deletion_tokens (token_hash, email_normalized, expires_at, created_at) VALUES (?, ?, ?, ?)").run(hashToken(token), email, new Date(Date.now() + 3_600_000).toISOString(), now);
    const link = `${config.appBaseUrl}/${locale}/delete-data?token=${token}`; const sent = await sendEmail(config, email, "Confirm civic platform data deletion", `<p><a href="${link}">Review and confirm data deletion</a></p>`); const developmentLink = !sent && config.nodeEnv !== "production" ? <p><a href={link}>Development deletion link</a></p> : null;
    privateNoStore(context); return context.html(<Layout locale={locale} title={t(locale, "deleteTitle")} path={context.req.path}><div class="privacy-page"><Surface class="status-surface"><p role="status">{t(locale, sent ? "deleteSent" : "verificationUnavailable")}</p>{developmentLink}</Surface></div></Layout>, sent || developmentLink ? 200 : 503);
  });
}
function deleteData(db: Db, email: string, eraseThrough: string) {
  const responses = db.prepare("SELECT id FROM submitted_responses WHERE lower(trim(submitter_email)) = ? AND created_at <= ?").all(email, eraseThrough) as { id: number }[];
  for (const response of responses) {
    for (const file of db.prepare("SELECT object_key FROM submitted_response_files WHERE response_id = ?").all(response.id) as { object_key: string }[]) queueResponseObjectDelete(db, file.object_key, eraseThrough);
    db.prepare("UPDATE response_submission_nonces SET outcome = 'erased', response_id = NULL, updated_at = ? WHERE response_id = ?").run(eraseThrough, response.id);
    db.prepare("DELETE FROM submitted_responses WHERE id = ?").run(response.id);
  }
  for (const supporter of db.prepare("SELECT id, email_normalized FROM supporters WHERE email_normalized = ? AND created_at <= ?").all(email, eraseThrough) as { id: number; email_normalized: string }[]) {
    db.prepare("UPDATE generated_requests SET supporter_id = NULL WHERE supporter_id = ? AND created_at <= ?").run(supporter.id, eraseThrough);
    db.prepare("DELETE FROM email_verifications WHERE supporter_id = ?").run(supporter.id);
    let address = `deleted-${supporter.id}@invalid.local`; while (db.prepare("SELECT 1 FROM supporters WHERE email_normalized = ? AND id <> ?").get(address, supporter.id)) address = `deleted-${supporter.id}-${randomBytes(12).toString("hex")}@invalid.local`;
    db.prepare("UPDATE supporters SET email_normalized = ?, name = NULL, city = NULL, profession = NULL, public_name_allowed = 0, deleted_at = ? WHERE id = ?").run(address, eraseThrough, supporter.id);
  }
}
function hashToken(token: string) { return createHash("sha256").update(token).digest("hex"); }
function localeParam(value: string) { return isLocale(value) ? value : undefined; }
function privacyParagraphs(body: string) {
  return body.split("\n\n").map((paragraph) => paragraph.startsWith("### ")
    ? <h2>{paragraph.slice(4)}</h2>
    : <p>{paragraph}</p>);
}
function statusPage(context: any, locale: Locale, message: string, status = 200) { privateNoStore(context); return context.html(<Layout locale={locale} title={t(locale, "deleteTitle")} path={`/${locale}/delete-data`}><div class="privacy-page"><h1>{t(locale, "deleteTitle")}</h1><Surface class="status-surface"><p role="status">{message}</p></Surface></div></Layout>, status); }
