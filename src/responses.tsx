import { randomUUID } from "node:crypto";
import type { Hono } from "hono";
import type { Config } from "./config.js";
import type { Db } from "./db.js";
import { isLocale, t, type Locale } from "./i18n.js";
import { Layout } from "./layout.js";
import { hasObjectStorage, putObject, RESPONSE_PUT_TIMEOUT_MS } from "./s3.js";
import { drainResponseObjectWork, queueResponseObjectDelete } from "./response-storage.js";
import { createRateLimiter, hashResponseSubmissionToken, issueCsrf, issueResponseSubmissionToken, text, Turnstile, validCsrf, validTurnstile, verifyResponseSubmissionToken } from "./security.js";

const allowedFiles = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

export function registerResponseRoutes(app: Hono, db: Db, config: Config) {
  const rateLimit = createRateLimiter();

  app.get("/:locale/responses/new", (context) => {
    const locale = localeParam(context.req.param("locale"));
    if (!locale) return context.notFound();
    if (!campaignEnabled(db)) return statusPage(context, locale, t(locale, "formDisabled"), 503);
    const csrf = issueCsrf(context, config);
    const submissionToken = issueResponseSubmissionToken(config);
    const recipients = db.prepare(`SELECT r.id, rt.name FROM recipients r JOIN recipient_translations rt ON rt.recipient_id = r.id AND rt.locale = ? WHERE r.is_active = 1 ORDER BY rt.name`).all(locale) as { id: number; name: string }[];
    context.header("Cache-Control", "private, no-store");
    return context.html(<Layout locale={locale} title={t(locale, "responseTitle")} path={context.req.path}>
      <h1>{t(locale, "responseTitle")}</h1>
      <form method="post" action={`/${locale}/responses`} encType="multipart/form-data">
        <input type="hidden" name="csrf" value={csrf} /><input type="hidden" name="submissionToken" value={submissionToken} />
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
    const body = await context.req.parseBody();
    const submissionToken = text(body.submissionToken);
    const tokenHash = submissionToken ? hashResponseSubmissionToken(submissionToken) : "";
    const known = tokenHash ? db.prepare("SELECT outcome FROM response_submission_nonces WHERE token_hash = ?").get(tokenHash) : undefined;
    if (known) return confirmation(context, locale);
    if (!campaignEnabled(db)) return statusPage(context, locale, t(locale, "formDisabled"), 503);
    if (!rateLimit(context, "responses", config.rateLimitResponses, 3600)) return statusPage(context, locale, "Too many requests", 429);
    if (!validCsrf(context, config, body) || !verifyResponseSubmissionToken(submissionToken, config) || !await validTurnstile(context, config, body)) return statusPage(context, locale, t(locale, "invalidForm"), 403);
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
      object = await prepareUpload(db, tokenHash, object);
      try { await putObject(config, object.key, object.mime, bytes); }
      catch { await markUploadForDeletion(db, object.key, RESPONSE_PUT_TIMEOUT_MS * 2); void drainResponseObjectWork(db, config).catch(() => {}); return confirmation(context, locale); }
    }
    const now = new Date().toISOString();
    if (!object) {
      db.exec("BEGIN IMMEDIATE");
      try {
        const claim = db.prepare("INSERT OR IGNORE INTO response_submission_nonces (token_hash, outcome, created_at, updated_at) VALUES (?, 'completed', ?, ?)").run(tokenHash, now, now);
        if (claim.changes !== 1) { db.exec("ROLLBACK"); return confirmation(context, locale); }
        const response = insertResponse(db, recipientId, receivedAt, channel, responseText, email, now);
        db.prepare("UPDATE response_submission_nonces SET response_id = ?, updated_at = ? WHERE token_hash = ?").run(response.id, now, tokenHash);
        db.exec("COMMIT");
      } catch (error) { db.exec("ROLLBACK"); throw error; }
      return confirmation(context, locale);
    }
    db.exec("BEGIN IMMEDIATE");
    try {
      const work = db.prepare("SELECT object_key, state FROM response_object_work WHERE token_hash = ? AND object_key = ?").get(tokenHash, object.key) as { object_key: string; state: string } | undefined;
      const existingNonce = db.prepare("SELECT response_id FROM response_submission_nonces WHERE token_hash = ?").get(tokenHash) as { response_id: number | null } | undefined;
      if (existingNonce || !work || work.state !== "upload_pending") {
        if (!db.prepare("SELECT 1 FROM submitted_response_files WHERE object_key = ?").get(object.key)) queueResponseObjectDelete(db, object.key, now);
        db.exec("COMMIT"); void drainResponseObjectWork(db, config).catch(() => {}); return confirmation(context, locale);
      }
      const response = insertResponse(db, recipientId, receivedAt, channel, responseText, email, now);
      db.prepare("INSERT INTO submitted_response_files (response_id, object_key, mime, size, uploaded_at) VALUES (?, ?, ?, ?, ?)").run(response.id, object.key, object.mime, object.size, now);
      db.prepare("INSERT INTO response_submission_nonces (token_hash, response_id, outcome, created_at, updated_at) VALUES (?, ?, 'completed', ?, ?)").run(tokenHash, response.id, now, now);
      const removed = db.prepare("DELETE FROM response_object_work WHERE object_key = ? AND token_hash = ? AND state = 'upload_pending'").run(object.key, tokenHash);
      if (removed.changes !== 1) throw new Error("upload intent was not finalized");
      db.exec("COMMIT");
    } catch { db.exec("ROLLBACK"); await markUploadForDeletion(db, object.key); void drainResponseObjectWork(db, config).catch(() => {}); return confirmation(context, locale); }
    return confirmation(context, locale);
  });

  app.get("/:locale/responses/thanks", (context) => {
    const locale = localeParam(context.req.param("locale"));
    if (!locale) return context.notFound();
    context.header("Cache-Control", "private, no-store");
    return context.html(<Layout locale={locale} title={t(locale, "thanksTitle")} path={context.req.path}><h1>{t(locale, "thanksTitle")}</h1><p role="status">{t(locale, "thanksBody")}</p><p class="note">{t(locale, "thanksRefresh")}</p></Layout>);
  });
}

function confirmation(context: any, locale: Locale) { context.header("Cache-Control", "private, no-store"); return context.redirect(`/${locale}/responses/thanks`, 303); }
function insertResponse(db: Db, recipientId: number, receivedAt: string, channel: string, responseText: string, email: string, now: string) {
  return db.prepare(`INSERT INTO submitted_responses
    (recipient_id, received_at, channel, response_text, submitter_email, consent_at, status, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'new', ?) RETURNING id`).get(recipientId, receivedAt, channel, responseText, email, now, now) as { id: number };
}
async function prepareUpload(db: Db, tokenHash: string, object: { key: string; mime: string; size: number }) {
  const now = new Date().toISOString(); db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("INSERT INTO response_object_work (object_key, token_hash, state, mime, size, next_attempt_at, created_at, updated_at) VALUES (?, ?, 'upload_pending', ?, ?, ?, ?, ?)").run(object.key, tokenHash, object.mime, object.size, now, now, now);
    db.exec("COMMIT"); return object;
  } catch (error) { db.exec("ROLLBACK"); throw error; }
}
async function markUploadForDeletion(db: Db, objectKey: string, delayMs = 0) {
  const now = new Date(); const next = new Date(now.getTime() + delayMs).toISOString(); const nowIso = now.toISOString(); db.exec("BEGIN IMMEDIATE");
  try { db.prepare("UPDATE response_object_work SET state = 'delete_pending', next_attempt_at = ?, updated_at = ? WHERE object_key = ?").run(next, nowIso, objectKey); db.exec("COMMIT"); }
  catch (error) { db.exec("ROLLBACK"); throw error; }
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
