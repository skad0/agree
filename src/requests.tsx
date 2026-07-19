import type { Hono } from "hono";
import type { Config } from "./config.js";
import type { Db } from "./db.js";
import { isLocale, locales, t, type Locale } from "./i18n.js";
import { Layout } from "./layout.js";
import { createRateLimiter, issueCsrf, text, Turnstile, validCsrf, validTurnstile, values } from "./security.js";

type Recipient = { id: number; name: string; email: string | null; whatsapp: string | null };
type Template = { channel: "email" | "whatsapp"; subject: string | null; body: string };

export function registerRequestRoutes(app: Hono, db: Db, config: Config) {
  const rateLimit = createRateLimiter();

  app.get("/:locale/request", (context) => {
    const locale = localeParam(context.req.param("locale"));
    if (!locale) return context.notFound();
    if (!campaignEnabled(db)) return statusPage(context, locale, t(locale, "formDisabled"), 503);
    const recipients = recipientRows(db, locale);
    return context.html(<Layout locale={locale} title={t(locale, "requestTitle")} path={context.req.path}>
      <h1>{t(locale, "chooseRecipient")}</h1>
      <ul>{recipients.map((recipient) => <li><a href={`/${locale}/request/build?recipient=${recipient.id}`}>{recipient.name}</a></li>)}</ul>
    </Layout>);
  });

  app.get("/:locale/request/build", (context) => {
    const locale = localeParam(context.req.param("locale"));
    if (!locale) return context.notFound();
    if (!campaignEnabled(db)) return statusPage(context, locale, t(locale, "formDisabled"), 503);
    const recipientId = positiveInteger(context.req.query("recipient"));
    const recipient = recipientId ? recipientRows(db, locale).find((row) => row.id === recipientId) : undefined;
    if (!recipient) return context.redirect(`/${locale}/request`);
    const demands = db.prepare(`SELECT d.id, dt.title FROM demands d JOIN campaigns c ON c.id = d.campaign_id
      LEFT JOIN demand_translations dt ON dt.demand_id = d.id AND dt.locale = ?
      WHERE c.status = 'active' AND d.is_active = 1 ORDER BY d.sort_order`).all(locale) as { id: number; title: string | null }[];
    const csrf = issueCsrf(context, config);
    context.header("Cache-Control", "private, no-store");
    return context.html(<Layout locale={locale} title={t(locale, "buildTitle")} path={context.req.path}>
      <h1>{t(locale, "buildTitle")}</h1><p>{t(locale, "recipient")}: <strong>{recipient.name}</strong></p>
      <form method="post" action={`/${locale}/request/preview`}>
        <input type="hidden" name="csrf" value={csrf} /><input type="hidden" name="recipientId" value={recipient.id} />
        <fieldset><legend>{t(locale, "selectDemand")}</legend>{demands.map((demand) => demand.title
          ? <label><input type="checkbox" name="demandId" value={demand.id} /> {demand.title}</label>
          : <p role="status">{t(locale, "unavailable")}</p>)}</fieldset>
        <label>{t(locale, "messageLanguage")}<select name="messageLocale">{locales.map((option) => <option value={option} selected={option === locale}>{option.toUpperCase()}</option>)}</select></label>
        <label>{t(locale, "name")}<input name="name" maxLength={100} /></label>
        <label>{t(locale, "city")}<input name="city" maxLength={100} /></label>
        <label>{t(locale, "personalContext")}<textarea name="context" maxLength={500}></textarea></label>
        <Turnstile config={config} /><button type="submit">{t(locale, "next")}</button>
      </form>
    </Layout>);
  });

  app.post("/:locale/request/preview", async (context) => {
    const pageLocale = localeParam(context.req.param("locale"));
    if (!pageLocale) return context.notFound();
    const body = await context.req.parseBody({ all: true });
    if (!rateLimit(context, "preview", config.rateLimitPreview, 3600)) return statusPage(context, pageLocale, "Too many requests", 429);
    if (!validCsrf(context, config, body) || !await validTurnstile(context, config, body)) return statusPage(context, pageLocale, t(pageLocale, "invalidForm"), 403);
    if (!campaignEnabled(db)) return statusPage(context, pageLocale, t(pageLocale, "formDisabled"), 503);
    const messageLocale = localeParam(text(body.messageLocale));
    const recipientId = positiveInteger(text(body.recipientId));
    const demandIds = values(body.demandId).map(positiveInteger).filter((id): id is number => Boolean(id));
    if (!messageLocale || !recipientId || !demandIds.length) return statusPage(context, pageLocale, t(pageLocale, "invalidForm"), 422);
    const recipient = recipientRows(db, messageLocale).find((row) => row.id === recipientId);
    const placeholders = demandIds.map(() => "?").join(",");
    const demands = db.prepare(`SELECT dt.title FROM demands d JOIN campaigns c ON c.id = d.campaign_id
      JOIN demand_translations dt ON dt.demand_id = d.id AND dt.locale = ?
      WHERE c.status = 'active' AND d.is_active = 1 AND d.id IN (${placeholders}) ORDER BY d.sort_order`).all(messageLocale, ...demandIds) as { title: string }[];
    const templates = db.prepare("SELECT channel, subject, body FROM message_templates WHERE locale = ?").all(messageLocale) as Template[];
    if (!recipient || demands.length !== new Set(demandIds).size || templates.length !== 2) return statusPage(context, pageLocale, t(pageLocale, "unavailable"), 422);
    const fields = {
      recipient: recipient.name,
      demands: demands.map((demand) => `• ${demand.title}`).join("\n"),
      name: text(body.name).slice(0, 100), city: text(body.city).slice(0, 100), context: text(body.context).slice(0, 500)
    };
    const email = templates.find((template) => template.channel === "email")!;
    const whatsapp = templates.find((template) => template.channel === "whatsapp")!;
    const subject = fill(email.subject ?? "", fields);
    const emailBody = fill(email.body, fields);
    const whatsappBody = fill(whatsapp.body, fields);
    const created = db.prepare("INSERT INTO generated_requests (recipient_id, locale, selected_demands, created_at) VALUES (?, ?, ?, ?) RETURNING id")
      .get(recipient.id, messageLocale, JSON.stringify([...new Set(demandIds)]), new Date().toISOString()) as { id: number };
    return context.html(<Layout locale={pageLocale} title={t(pageLocale, "previewTitle")} path={context.req.path}>
      <h1>{t(pageLocale, "previewTitle")}</h1>
      <h2>{t(pageLocale, "emailSubject")}</h2><p>{subject}</p>
      <h2>{t(pageLocale, "emailBody")}</h2><pre class="message-preview">{emailBody}</pre>
      <h2>{t(pageLocale, "whatsappText")}</h2><pre class="message-preview">{whatsappBody}</pre>
      <div class="actions">
        {actionForm(pageLocale, config, body.csrf, created.id, "email_opened", t(pageLocale, "openEmail"), subject, emailBody)}
        {actionForm(pageLocale, config, body.csrf, created.id, "whatsapp_opened", t(pageLocale, "openWhatsapp"), "", whatsappBody)}
        {actionForm(pageLocale, config, body.csrf, created.id, "text_copied", t(pageLocale, "copyText"), subject, emailBody)}
        <form method="post" action={`/${pageLocale}/request/report-sent`}><input type="hidden" name="csrf" value={text(body.csrf)} /><input type="hidden" name="requestId" value={created.id} /><Turnstile config={config} /><button type="submit">{t(pageLocale, "reportSent")}</button></form>
      </div>
    </Layout>);
  });

  app.post("/:locale/request/action", async (context) => {
    const locale = localeParam(context.req.param("locale"));
    if (!locale) return context.notFound();
    const body = await context.req.parseBody();
    if (!rateLimit(context, "action", config.rateLimitAction, 3600)) return statusPage(context, locale, "Too many requests", 429);
    if (!validCsrf(context, config, body) || !await validTurnstile(context, config, body)) return statusPage(context, locale, t(locale, "invalidForm"), 403);
    const requestId = positiveInteger(text(body.requestId));
    const action = text(body.action);
    if (!requestId || !["email_opened", "whatsapp_opened", "text_copied"].includes(action) || !requestExists(db, requestId)) return statusPage(context, locale, t(locale, "invalidForm"), 422);
    db.prepare("INSERT INTO request_actions (generated_request_id, action_type, created_at) VALUES (?, ?, ?)").run(requestId, action, new Date().toISOString());
    const target = actionTarget(db, requestId, action, text(body.subject), text(body.message));
    return context.html(<Layout locale={locale} title={t(locale, "actionReady")} path={context.req.path}>
      <h1>{t(locale, "actionReady")}</h1>{target ? <p><a role="button" href={target.href} dir="ltr">{target.label}</a></p> : null}
      {action === "text_copied" ? <><textarea id="copy-message" readOnly>{text(body.message)}</textarea><button type="button" data-copy="copy-message">{t(locale, "copyText")}</button></> : null}
      <p><a href={`/${locale}/request/result?request=${requestId}`}>{t(locale, "next")}</a></p>
    </Layout>);
  });

  app.post("/:locale/request/report-sent", async (context) => {
    const locale = localeParam(context.req.param("locale"));
    if (!locale) return context.notFound();
    const body = await context.req.parseBody();
    if (!rateLimit(context, "action", config.rateLimitAction, 3600) || !validCsrf(context, config, body) || !await validTurnstile(context, config, body)) return statusPage(context, locale, t(locale, "invalidForm"), 403);
    const requestId = positiveInteger(text(body.requestId));
    if (!requestId || !requestExists(db, requestId)) return statusPage(context, locale, t(locale, "invalidForm"), 422);
    db.prepare("INSERT INTO request_actions (generated_request_id, action_type, created_at) VALUES (?, 'reported_sent', ?)").run(requestId, new Date().toISOString());
    return context.redirect(`/${locale}/request/result?request=${requestId}`, 303);
  });

  app.get("/:locale/request/result", (context) => {
    const locale = localeParam(context.req.param("locale"));
    if (!locale) return context.notFound();
    const share = encodeURIComponent(`${t(locale, "siteName")} ${config.appBaseUrl}/${locale}`);
    return context.html(<Layout locale={locale} title={t(locale, "resultTitle")} path={context.req.path}>
      <h1>{t(locale, "resultTitle")}</h1><p>{t(locale, "share")}</p>
      <nav><a href={`https://wa.me/?text=${share}`}>WhatsApp</a> · <a href={`https://t.me/share/url?url=${share}`}>Telegram</a> · <a href={`https://www.facebook.com/sharer/sharer.php?u=${share}`}>Facebook</a> · <a href={`${config.appBaseUrl}/${locale}`}>Link</a></nav>
    </Layout>);
  });
}

function actionForm(locale: Locale, config: Config, csrf: unknown, requestId: number, action: string, label: string, subject: string, message: string) {
  return <form method="post" action={`/${locale}/request/action`}>
    <input type="hidden" name="csrf" value={text(csrf)} /><input type="hidden" name="requestId" value={requestId} /><input type="hidden" name="action" value={action} />
    <input type="hidden" name="subject" value={subject} /><input type="hidden" name="message" value={message} /><Turnstile config={config} /><button type="submit">{label}</button>
  </form>;
}

function recipientRows(db: Db, locale: Locale) {
  return db.prepare(`SELECT r.id, rt.name, r.email, r.whatsapp FROM recipients r
    JOIN recipient_translations rt ON rt.recipient_id = r.id AND rt.locale = ? WHERE r.is_active = 1 ORDER BY rt.name`).all(locale) as Recipient[];
}
function requestExists(db: Db, id: number) { return Boolean(db.prepare("SELECT 1 FROM generated_requests WHERE id = ?").get(id)); }
function campaignEnabled(db: Db) { return db.prepare("SELECT requests_enabled AS enabled FROM campaigns WHERE status = 'active' LIMIT 1").get()?.enabled === 1; }
function localeParam(value: string) { return isLocale(value) ? value : undefined; }
function positiveInteger(value: string | undefined) { const number = Number(value); return Number.isInteger(number) && number > 0 ? number : undefined; }
function fill(template: string, fields: Record<string, string>) { return template.replace(/\{(recipient|demands|name|city|context)\}/g, (_, key: string) => fields[key] ?? "").replace(/\n{3,}/g, "\n\n").trim(); }
function statusPage(context: any, locale: Locale, message: string, status = 200) { return context.html(<Layout locale={locale} title={t(locale, "siteName")} path={`/${locale}`}><p role="status">{message}</p></Layout>, status); }
function actionTarget(db: Db, requestId: number, action: string, subject: string, message: string) {
  const recipient = db.prepare(`SELECT r.email, r.whatsapp FROM generated_requests g JOIN recipients r ON r.id = g.recipient_id WHERE g.id = ?`).get(requestId) as { email: string | null; whatsapp: string | null };
  if (action === "email_opened" && recipient.email) return { href: `mailto:${recipient.email}?${new URLSearchParams({ subject, body: message })}`, label: recipient.email };
  if (action === "whatsapp_opened" && recipient.whatsapp) return { href: `https://wa.me/${recipient.whatsapp}?text=${encodeURIComponent(message)}`, label: "WhatsApp" };
  return undefined;
}

