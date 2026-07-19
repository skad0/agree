import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { Hono } from "hono";
import type { Config } from "./config.js";
import type { Db } from "./db.js";
import { sendEmail } from "./email.js";
import { isLocale, t, type Locale } from "./i18n.js";
import { Layout } from "./layout.js";
import { createRateLimiter, issueCsrf, text, Turnstile, validCsrf, validTurnstile } from "./security.js";

export function registerPrivacyRoutes(app: Hono, db: Db, config: Config) {
  const rateLimit = createRateLimiter();
  app.get("/:locale/privacy", (context) => {
    const locale = localeParam(context.req.param("locale")); if (!locale) return context.notFound();
    return context.html(<Layout locale={locale} title={t(locale, "privacyTitle")} path={context.req.path}><h1>{t(locale, "privacyTitle")}</h1>{t(locale, "privacyBody").split("\n\n").map((paragraph) => <p>{paragraph}</p>)}<p><a href={`/${locale}/delete-data`}>{t(locale, "deleteTitle")}</a></p></Layout>);
  });
  app.get("/:locale/delete-data", (context) => {
    const locale = localeParam(context.req.param("locale")); if (!locale) return context.notFound();
    const csrf = issueCsrf(context, config); const token = context.req.query("token"); context.header("Cache-Control", "private, no-store");
    return context.html(<Layout locale={locale} title={t(locale, "deleteTitle")} path={context.req.path}><h1>{t(locale, "deleteTitle")}</h1><p>{t(locale, "deleteBody")}</p>
      <form method="post"><input type="hidden" name="csrf" value={csrf} />{token
        ? <><input type="hidden" name="token" value={token} /><Turnstile config={config} /><button type="submit">{t(locale, "deleteConfirm")}</button></>
        : <><label>{t(locale, "email")}<input type="email" name="email" required /></label><Turnstile config={config} /><button type="submit">{t(locale, "submit")}</button></>}</form>
    </Layout>);
  });
  app.post("/:locale/delete-data", async (context) => {
    const locale = localeParam(context.req.param("locale")); if (!locale) return context.notFound();
    const body = await context.req.parseBody();
    if (!rateLimit(context, "delete", 3, 3600) || !validCsrf(context, config, body)) return statusPage(context, locale, t(locale, "invalidForm"), 403);
    const suppliedToken = text(body.token);
    if (suppliedToken) {
      if (!await validTurnstile(context, config, body)) return statusPage(context, locale, t(locale, "invalidForm"), 403);
      const payload = decryptToken(suppliedToken, config.sessionSecret);
      if (!payload || payload.expires < Date.now()) return statusPage(context, locale, t(locale, "invalidToken"), 400);
      deleteData(db, payload.email); return statusPage(context, locale, t(locale, "deleted"));
    }
    if (!await validTurnstile(context, config, body)) return statusPage(context, locale, t(locale, "invalidForm"), 403);
    const email = text(body.email).toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return statusPage(context, locale, t(locale, "invalidForm"), 422);
    const token = encryptToken({ email, expires: Date.now() + 3_600_000 }, config.sessionSecret);
    const link = `${config.appBaseUrl}/${locale}/delete-data?token=${token}`;
    const sent = await sendEmail(config, email, "Confirm civic platform data deletion", `<p><a href="${link}">Review and confirm data deletion</a></p>`);
    const developmentLink = !sent && config.nodeEnv !== "production" ? <p><a href={link}>Development deletion link</a></p> : null;
    return context.html(<Layout locale={locale} title={t(locale, "deleteTitle")} path={context.req.path}><p role="status">{t(locale, sent ? "deleteSent" : "verificationUnavailable")}</p>{developmentLink}</Layout>, sent || developmentLink ? 200 : 503);
  });
}

function deleteData(db: Db, email: string) {
  const now = new Date().toISOString(); db.exec("BEGIN IMMEDIATE");
  try {
    const supporters = db.prepare("SELECT id FROM supporters WHERE email_normalized = ?").all(email) as { id: number }[];
    for (const supporter of supporters) {
      db.prepare("UPDATE generated_requests SET supporter_id = NULL WHERE supporter_id = ?").run(supporter.id);
      db.prepare("DELETE FROM email_verifications WHERE supporter_id = ?").run(supporter.id);
      db.prepare("UPDATE supporters SET email_normalized = ?, name = NULL, city = NULL, profession = NULL, public_name_allowed = 0, deleted_at = ? WHERE id = ?")
        .run(`deleted-${supporter.id}@invalid.local`, now, supporter.id);
    }
    db.prepare("UPDATE submitted_responses SET submitter_email = 'deleted@invalid.local' WHERE lower(submitter_email) = ?").run(email);
    db.exec("COMMIT");
  } catch (error) { db.exec("ROLLBACK"); throw error; }
}

function encryptToken(payload: { email: string; expires: number }, secret: string) {
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", createHash("sha256").update(secret).digest(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload)), cipher.final()]); return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}
function decryptToken(token: string, secret: string) {
  try { const bytes = Buffer.from(token, "base64url"); const decipher = createDecipheriv("aes-256-gcm", createHash("sha256").update(secret).digest(), bytes.subarray(0, 12)); decipher.setAuthTag(bytes.subarray(12, 28)); return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString()) as { email: string; expires: number }; } catch { return undefined; }
}
function localeParam(value: string) { return isLocale(value) ? value : undefined; }
function statusPage(context: any, locale: Locale, message: string, status = 200) { return context.html(<Layout locale={locale} title={t(locale, "deleteTitle")} path={`/${locale}/delete-data`}><p role="status">{message}</p></Layout>, status); }
