import { randomUUID } from "node:crypto";
import type { Hono } from "hono";
import type { Config } from "./config.js";
import type { Db } from "./db.js";
import { isLocale, t, type Locale } from "./i18n.js";
import { Layout } from "./layout.js";
import { hasObjectStorage, putObject } from "./s3.js";
import { createRateLimiter, issueCsrf, text, Turnstile, validCsrf, validTurnstile } from "./security.js";

const allowedFiles = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

export function registerResponseRoutes(app: Hono, db: Db, config: Config) {
  const rateLimit = createRateLimiter();

  app.get("/:locale/responses/new", (context) => {
    const locale = localeParam(context.req.param("locale"));
    if (!locale) return context.notFound();
    if (!campaignEnabled(db)) return statusPage(context, locale, t(locale, "formDisabled"), 503);
    const csrf = issueCsrf(context, config);
    const recipients = db.prepare(`SELECT r.id, rt.name FROM recipients r JOIN recipient_translations rt ON rt.recipient_id = r.id AND rt.locale = ? WHERE r.is_active = 1 ORDER BY rt.name`).all(locale) as { id: number; name: string }[];
    context.header("Cache-Control", "private, no-store");
    return context.html(<Layout locale={locale} title={t(locale, "responseTitle")} path={context.req.path}>
      <h1>{t(locale, "responseTitle")}</h1>
      <form method="post" action={`/${locale}/responses`} encType="multipart/form-data">
        <input type="hidden" name="csrf" value={csrf} />
        <label>{t(locale, "recipient")}<select name="recipientId" required>{recipients.map((recipient) => <option value={recipient.id}>{recipient.name}</option>)}</select></label>
        <label>{t(locale, "receivedDate")}<input type="date" name="receivedAt" required max={new Date().toISOString().slice(0, 10)} /></label>
        <label>{t(locale, "channel")}<input name="channel" required maxLength={50} /></label>
        <label>{t(locale, "responseText")}<textarea name="responseText" required maxLength={20000}></textarea></label>
        <label>{t(locale, "fileHelp")}<input type="file" name="file" accept="image/jpeg,image/png,image/webp,application/pdf" /></label>
        <label>{t(locale, "email")}<input type="email" name="email" required maxLength={254} /></label>
        <label><input type="checkbox" name="consent" value="yes" required /> {t(locale, "consent")}</label>
        <Turnstile config={config} /><button type="submit">{t(locale, "submit")}</button>
      </form>
    </Layout>);
  });

  app.post("/:locale/responses", async (context) => {
    const locale = localeParam(context.req.param("locale"));
    if (!locale) return context.notFound();
    if (!campaignEnabled(db)) return statusPage(context, locale, t(locale, "formDisabled"), 503);
    const body = await context.req.parseBody();
    if (!rateLimit(context, "responses", config.rateLimitResponses, 3600)) return statusPage(context, locale, "Too many requests", 429);
    if (!validCsrf(context, config, body) || !await validTurnstile(context, config, body)) return statusPage(context, locale, t(locale, "invalidForm"), 403);
    const recipientId = Number(text(body.recipientId));
    const receivedAt = text(body.receivedAt);
    const channel = text(body.channel).slice(0, 50);
    const responseText = text(body.responseText).slice(0, 20000);
    const email = text(body.email).toLowerCase();
    const file = body.file instanceof File && body.file.size ? body.file : undefined;
    if (!Number.isInteger(recipientId) || !db.prepare("SELECT 1 FROM recipients WHERE id = ? AND is_active = 1").get(recipientId)
      || !validDate(receivedAt) || receivedAt > new Date().toISOString().slice(0, 10)
      || !channel || !responseText || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || text(body.consent) !== "yes") {
      return statusPage(context, locale, t(locale, "invalidForm"), 422);
    }
    if (file && (file.size > 10 * 1024 * 1024 || !allowedFiles.has(file.type))) return statusPage(context, locale, t(locale, "invalidForm"), 422);
    if (file && !hasObjectStorage(config)) return statusPage(context, locale, t(locale, "storageUnavailable"), 503);
    let object: { key: string; mime: string; size: number } | undefined;
    if (file) {
      const extension = file.name.includes(".") ? `.${file.name.split(".").pop()!.toLowerCase()}` : "";
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!matchesMime(bytes, file.type)) return statusPage(context, locale, t(locale, "invalidForm"), 422);
      object = { key: `responses/${new Date().toISOString().slice(0, 10)}/${randomUUID()}${extension}`, mime: file.type, size: file.size };
      await putObject(config, object.key, object.mime, bytes);
    }
    const now = new Date().toISOString();
    db.exec("BEGIN IMMEDIATE");
    try {
      const response = db.prepare(`INSERT INTO submitted_responses
        (recipient_id, received_at, channel, response_text, submitter_email, consent_at, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'new', ?) RETURNING id`).get(recipientId, receivedAt, channel, responseText, email, now, now) as { id: number };
      if (object) db.prepare("INSERT INTO submitted_response_files (response_id, object_key, mime, size, uploaded_at) VALUES (?, ?, ?, ?, ?)").run(response.id, object.key, object.mime, object.size, now);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    return context.redirect(`/${locale}/responses/thanks`, 303);
  });

  app.get("/:locale/responses/thanks", (context) => {
    const locale = localeParam(context.req.param("locale"));
    if (!locale) return context.notFound();
    return context.html(<Layout locale={locale} title={t(locale, "thanksTitle")} path={context.req.path}><h1>{t(locale, "thanksTitle")}</h1><p>{t(locale, "thanksBody")}</p></Layout>);
  });
}

function localeParam(value: string) { return isLocale(value) ? value : undefined; }
function campaignEnabled(db: Db) { return db.prepare("SELECT responses_enabled AS enabled FROM campaigns WHERE status = 'active' LIMIT 1").get()?.enabled === 1; }
function statusPage(context: any, locale: Locale, message: string, status = 200) { return context.html(<Layout locale={locale} title={t(locale, "siteName")} path={`/${locale}`}><p role="status">{message}</p></Layout>, status); }
function validDate(value: string) { const date = new Date(`${value}T00:00:00.000Z`); return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value; }
function matchesMime(bytes: Uint8Array, mime: string) {
  if (mime === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === "image/png") return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte);
  if (mime === "image/webp") return Buffer.from(bytes.subarray(0, 4)).toString() === "RIFF" && Buffer.from(bytes.subarray(8, 12)).toString() === "WEBP";
  return mime === "application/pdf" && Buffer.from(bytes.subarray(0, 5)).toString() === "%PDF-";
}
