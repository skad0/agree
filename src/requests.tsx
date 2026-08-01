import { randomBytes } from "node:crypto";
import type { Hono } from "hono";
import type { Config } from "./config.js";
import type { Db } from "./db.js";
import { isLocale, localeNames, locales, t, type Locale } from "./i18n.js";
import { Layout } from "./layout.js";
import { createRateLimiter, issueCsrf, issueRequestCapability, text, Turnstile, validCsrf, validTurnstile, values, verifyRequestCapability } from "./security.js";

type Recipient = { id: number; type: "party" | "politician"; name: string; email: string | null; whatsapp: string | null; socialHandle: string | null };
type Template = { channel: "email" | "whatsapp" | "social"; subject: string | null; body: string };

const shareActions = ["shared_x", "shared_facebook", "shared_whatsapp", "shared_telegram"];
const actionTypes = ["email_opened", "whatsapp_opened", "text_copied", ...shareActions];

export function registerRequestRoutes(app: Hono, db: Db, config: Config) {
  const rateLimit = createRateLimiter();

  app.get("/:locale/request", (context) => {
    const locale = localeParam(context.req.param("locale"));
    if (!locale) return context.notFound();
    if (!campaignEnabled(db)) return statusPage(context, locale, t(locale, "formDisabled"), 503);
    const recipients = recipientRows(db, locale);
    return context.html(<Layout locale={locale} title={t(locale, "requestTitle")} path={context.req.path}>
      <p class="eyebrow">{t(locale, "stepChoose")} · 1/3</p>
      <h1 id="recipient-heading">{t(locale, "chooseRecipient")}</h1>
      {/* Same card treatment as the rest of the site: bare links here were below the 24px target. */}
      <ul class="documents">{recipients.map((recipient) =>
        <li><a href={`/${locale}/request/build?recipient=${recipient.id}`}><strong>{recipient.name}</strong></a></li>)}</ul>
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
      WHERE c.status = 'active' AND d.is_active = 1 AND d.document = 'standard' ORDER BY d.sort_order`).all(locale) as { id: number; title: string | null }[];
    const csrf = issueCsrf(context, config);
    context.header("Cache-Control", "private, no-store");
    return context.html(<Layout locale={locale} title={t(locale, "buildTitle")} path={context.req.path}>
      <p class="eyebrow">{t(locale, "stepBuild")} · 2/3</p>
      <h1 id="build-heading">{t(locale, "buildTitle")}</h1><p>{t(locale, "recipient")}: <strong>{recipient.name}</strong></p>
      <form method="post" action={`/${locale}/request/preview`} aria-labelledby="build-heading">
        <input type="hidden" name="csrf" value={csrf} /><input type="hidden" name="recipientId" value={recipient.id} />
        <fieldset><legend>{t(locale, "selectDemand")}</legend>{demands.map((demand) => demand.title
          ? <label><input type="checkbox" name="demandId" value={demand.id} /> {demand.title}</label>
          : <p role="status">{t(locale, "unavailable")}</p>)}</fieldset>
        <label>{t(locale, "messageLanguage")}<select name="messageLocale">{locales.map((option) => <option value={option} selected={option === locale} lang={option}>{localeNames[option]}</option>)}</select></label>
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
      WHERE c.status = 'active' AND d.is_active = 1 AND d.document = 'standard' AND d.id IN (${placeholders}) ORDER BY d.sort_order`).all(messageLocale, ...demandIds) as { title: string }[];
    const templates = db.prepare("SELECT channel, subject, body FROM message_templates WHERE locale = ?").all(messageLocale) as Template[];
    const email = templates.find((template) => template.channel === "email");
    const whatsapp = templates.find((template) => template.channel === "whatsapp");
    const social = templates.find((template) => template.channel === "social");
    if (!recipient || !email || !whatsapp || !social || demands.length !== new Set(demandIds).size) return statusPage(context, pageLocale, t(pageLocale, "unavailable"), 422);
    const fields = {
      recipient: recipient.name,
      demands: demands.map((demand) => `• ${demand.title}`).join("\n"),
      handle: mention(recipient, messageLocale),
      link: `${config.appBaseUrl}/${messageLocale}`,
      name: text(body.name).slice(0, 100), city: text(body.city).slice(0, 100), context: text(body.context).slice(0, 500)
    };
    const subject = fill(email.subject ?? "", fields);
    const emailBody = fill(email.body, fields);
    const whatsappBody = fill(whatsapp.body, fields);
    const socialBody = fill(social.body, fields);
    const created = createGeneratedRequest(db, recipient.id, messageLocale, JSON.stringify([...new Set(demandIds)]));
    const capability = issueRequestCapability(created.id, config);
    context.header("Cache-Control", "private, no-store");
    return context.html(<Layout locale={pageLocale} title={t(pageLocale, "previewTitle")} path={context.req.path}>
      <p class="eyebrow">{t(pageLocale, "stepSend")} · 3/3</p>
      <h1 id="preview-heading">{t(pageLocale, "previewTitle")}</h1>
      <p role="note">{t(pageLocale, "editHint")}</p>
      <p class="note">{t(pageLocale, "requestPreparedNote")}</p>
      <form method="post" action={`/${pageLocale}/request/action`} aria-labelledby="preview-heading">
        <input type="hidden" name="csrf" value={text(body.csrf)} /><input type="hidden" name="requestId" value={created.id} /><input type="hidden" name="capability" value={capability} />
        <label>{t(pageLocale, "emailSubject")}<input name="subject" value={subject} maxLength={200} /></label>
        <label>{t(pageLocale, "emailBody")}<textarea id="copy-message" name="message" rows={10} maxLength={5000}>{emailBody}</textarea></label>
        <label>{t(pageLocale, "whatsappText")}<textarea name="whatsappMessage" rows={4} maxLength={2000}>{whatsappBody}</textarea></label>
        <label>{t(pageLocale, "socialText")}<textarea name="socialMessage" rows={6} maxLength={2000}>{socialBody}</textarea></label>
        <Turnstile config={config} />
        {/* Reaching the official is the substantive act, so it is the only filled button here. */}
        <h2 id="send-heading" class="section-label">{t(pageLocale, "stepSend")}</h2>
        <div class="actions" role="group" aria-labelledby="send-heading">
          {recipient.email?.trim() ? <button type="submit" name="action" value="email_opened">{t(pageLocale, "openEmail")}</button> : null}
          {recipient.whatsapp?.trim() ? <button type="submit" name="action" value="whatsapp_opened" class="ghost">{t(pageLocale, "openWhatsapp")}</button> : null}
          <button type="submit" name="action" value="text_copied" class="ghost" data-copy="copy-message" data-copy-endpoint={`/${pageLocale}/request/copy`}>{t(pageLocale, "copyText")}</button>
        </div>
        <div class="confirm">
          <p class="eyebrow">{t(pageLocale, "reportSentHint")}</p>
          <button type="submit" formaction={`/${pageLocale}/request/report-sent`}>{t(pageLocale, "reportSent")}</button>
        </div>
        <h2 class="section-label" id="share-heading">{t(pageLocale, "shareHeading")}</h2>
        <div class="actions share">
          <button type="submit" name="action" value="shared_x">X</button>
          <button type="submit" name="action" value="shared_facebook">Facebook</button>
          <button type="submit" name="action" value="shared_whatsapp">WhatsApp</button>
          <button type="submit" name="action" value="shared_telegram">Telegram</button>
        </div>
        <p class="note">{t(pageLocale, "facebookNote")}</p>
      </form>
    </Layout>);
  });

  app.post("/:locale/request/action", async (context) => {
    const locale = localeParam(context.req.param("locale"));
    if (!locale) return context.notFound();
    const body = await context.req.parseBody();
    if (!campaignEnabled(db)) return statusPage(context, locale, t(locale, "formDisabled"), 503);
    if (!rateLimit(context, "action", config.rateLimitAction, 3600)) return statusPage(context, locale, "Too many requests", 429);
    if (!validCsrf(context, config, body) || !await validTurnstile(context, config, body)) return statusPage(context, locale, t(locale, "invalidForm"), 403);
    const requestId = positiveInteger(text(body.requestId));
    const action = text(body.action);
    if (!requestId || !actionTypes.includes(action) || !requestExists(db, requestId) || !verifyRequestCapability(text(body.capability), requestId, config)) return statusPage(context, locale, t(locale, "invalidForm"), 422);
    const message = action === "whatsapp_opened" ? text(body.whatsappMessage)
      : shareActions.includes(action) ? text(body.socialMessage) : text(body.message);
    const target = actionTarget(db, config, requestId, action, text(body.subject), message);
    // Do not record an attempted direct contact when the recipient has no destination. Copy and
    // share actions intentionally remain valid without a direct-contact target.
    if ((action === "email_opened" || action === "whatsapp_opened") && !target) return statusPage(context, locale, t(locale, "unavailable"), 422);
    const publicId = publicRequestId(db, requestId);
    if (!publicId) return statusPage(context, locale, t(locale, "invalidForm"), 422);
    db.prepare("INSERT INTO request_actions (generated_request_id, action_type, created_at) VALUES (?, ?, ?)").run(requestId, action, new Date().toISOString());
    context.header("Cache-Control", "private, no-store");
    return context.html(<Layout locale={locale} title={t(locale, "actionReady")} path={context.req.path}>
      <h1>{t(locale, "actionReady")}</h1>
      {target ? <p><a role="button" href={target.href} dir="ltr" target={target.href.startsWith("https:") ? "_blank" : undefined} rel="noopener noreferrer">{target.label}</a></p> : null}
      {/* Facebook's sharer accepts a URL only, so the post text has to be pasted by hand. */}
      {action === "shared_facebook" ? <p role="note">{t(locale, "facebookNote")}</p> : null}
      {action === "text_copied" || action === "shared_facebook" ? <><textarea id="copy-message" readOnly>{message}</textarea><button type="button" data-copy="copy-message">{t(locale, "copyText")}</button></> : null}
      <p><a href={`/${locale}/request/result?request=${publicId}`}>{t(locale, "next")}</a></p>
    </Layout>);
  });

  app.post("/:locale/request/copy", async (context) => {
    const locale = localeParam(context.req.param("locale"));
    if (!locale) return context.notFound();
    const body = await context.req.parseBody();
    const keys = Object.keys(body).filter((key) => body[key] !== undefined);
    const requestId = positiveInteger(text(body.requestId));
    if (!campaignEnabled(db)) return statusPage(context, locale, t(locale, "formDisabled"), 503);
    if (!rateLimit(context, "copy", config.rateLimitAction, 3600) || keys.some((key) => !["csrf", "requestId", "capability"].includes(key)) || !validCsrf(context, config, body) || !requestId || !requestExists(db, requestId) || !verifyRequestCapability(text(body.capability), requestId, config)) return statusPage(context, locale, t(locale, "invalidForm"), 422);
    db.prepare("INSERT INTO request_actions (generated_request_id, action_type, created_at) VALUES (?, 'text_copied', ?)").run(requestId, new Date().toISOString());
    return context.body(null, 204);
  });

  app.post("/:locale/request/report-sent", async (context) => {
    const locale = localeParam(context.req.param("locale"));
    if (!locale) return context.notFound();
    const body = await context.req.parseBody();
    if (!campaignEnabled(db)) return statusPage(context, locale, t(locale, "formDisabled"), 503);
    if (!rateLimit(context, "action", config.rateLimitAction, 3600) || !validCsrf(context, config, body) || !await validTurnstile(context, config, body)) return statusPage(context, locale, t(locale, "invalidForm"), 403);
    const requestId = positiveInteger(text(body.requestId));
    if (!requestId || !requestExists(db, requestId) || !verifyRequestCapability(text(body.capability), requestId, config)) return statusPage(context, locale, t(locale, "invalidForm"), 422);
    const publicId = publicRequestId(db, requestId);
    if (!publicId) return statusPage(context, locale, t(locale, "invalidForm"), 422);
    db.prepare("INSERT INTO request_actions (generated_request_id, action_type, created_at) VALUES (?, 'reported_sent', ?)").run(requestId, new Date().toISOString());
    return context.redirect(`/${locale}/request/result?request=${publicId}`, 303);
  });

  app.get("/:locale/request/result", (context) => {
    const locale = localeParam(context.req.param("locale"));
    if (!locale) return context.notFound();
    const publicId = context.req.query("request") ?? "";
    const request = publicId ? db.prepare(`SELECT g.id, g.public_id AS publicId, g.locale, r.type, r.social_handle AS socialHandle, rt.name AS recipient, g.selected_demands
      FROM generated_requests g JOIN recipients r ON r.id = g.recipient_id JOIN recipient_translations rt ON rt.recipient_id = g.recipient_id AND rt.locale = g.locale WHERE g.public_id = ?`).get(publicId) as { id: number; publicId: string; locale: string; type: "party" | "politician"; socialHandle: string | null; recipient: string; selected_demands: string } | undefined : undefined;
    if (!request || !isLocale(request.locale)) return statusPage(context, locale, t(locale, "invalidForm"), 422);
    const demandIds = JSON.parse(request.selected_demands) as number[];
    const placeholders = demandIds.map(() => "?").join(",");
    const demands = placeholders ? db.prepare(`SELECT dt.title FROM demand_translations dt WHERE dt.locale = ? AND dt.demand_id IN (${placeholders}) ORDER BY dt.demand_id`).all(request.locale, ...demandIds) as { title: string }[] : [];
    const social = db.prepare("SELECT body FROM message_templates WHERE locale = ? AND channel = 'social'").get(request.locale) as { body: string } | undefined;
    const recipient = { id: 0, type: request.type, name: request.recipient, email: null, whatsapp: null, socialHandle: request.socialHandle } satisfies Recipient;
    const message = social ? fill(social.body, { recipient: request.recipient, demands: demands.map((demand) => `• ${demand.title}`).join("\n"), handle: mention(recipient, request.locale), link: `${config.appBaseUrl}/${request.locale}/request/result?request=${request.publicId}`, name: "", city: "", context: "" }) : `${mention(recipient, request.locale)}\n\n${demands.map((demand) => `• ${demand.title}`).join("\n")}`;
    const share = encodeURIComponent(message);
    const link = encodeURIComponent(`${config.appBaseUrl}/${request.locale}/request/result?request=${request.publicId}`);
    context.header("Cache-Control", "private, no-store");
    return context.html(<Layout locale={locale} title={t(locale, "resultTitle")} path={context.req.path} languageQuery={`request=${request.publicId}`}>
      <h1>{t(locale, "resultTitle")}</h1><p>{t(locale, "shareForRecipient")} <strong>{request.recipient}</strong>.</p>
      <nav><a href={`https://wa.me/?text=${share}`}>WhatsApp</a> · <a href={`https://t.me/share/url?url=${link}&text=${share}`}>Telegram</a> · <a href={`https://www.facebook.com/sharer/sharer.php?u=${link}`}>Facebook</a> · <a href={`${config.appBaseUrl}/${request.locale}/request/result?request=${request.publicId}`}>Link</a></nav>
    </Layout>);
  });
}

function recipientRows(db: Db, locale: Locale) {
  return db.prepare(`SELECT r.id, r.type, rt.name, r.email, r.whatsapp, r.social_handle AS socialHandle FROM recipients r
    JOIN recipient_translations rt ON rt.recipient_id = r.id AND rt.locale = ?
    WHERE r.is_active = 1 AND (NULLIF(TRIM(r.email), '') IS NOT NULL OR NULLIF(TRIM(r.whatsapp), '') IS NOT NULL) ORDER BY rt.name`).all(locale) as Recipient[];
}
function mention(recipient: Recipient, locale: Locale) {
  if (recipient.socialHandle) return recipient.socialHandle;
  return recipient.type === "politician" ? `${t(locale, "knesset")} ${recipient.name}` : recipient.name;
}
function createGeneratedRequest(db: Db, recipientId: number, locale: Locale, selectedDemands: string) {
  for (;;) {
    const publicId = randomBytes(32).toString("base64url");
    try {
      return db.prepare("INSERT INTO generated_requests (public_id, recipient_id, locale, selected_demands, created_at) VALUES (?, ?, ?, ?, ?) RETURNING id, public_id")
        .get(publicId, recipientId, locale, selectedDemands, new Date().toISOString()) as { id: number; public_id: string };
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("generated_requests.public_id")) throw error;
    }
  }
}
function publicRequestId(db: Db, id: number) { return (db.prepare("SELECT public_id FROM generated_requests WHERE id = ?").get(id) as { public_id: string } | undefined)?.public_id ?? ""; }
function requestExists(db: Db, id: number) { return Boolean(db.prepare("SELECT 1 FROM generated_requests WHERE id = ?").get(id)); }
function campaignEnabled(db: Db) { return db.prepare("SELECT requests_enabled AS enabled FROM campaigns WHERE status = 'active' LIMIT 1").get()?.enabled === 1; }
function localeParam(value: string) { return isLocale(value) ? value : undefined; }
function positiveInteger(value: string | undefined) { const number = Number(value); return Number.isInteger(number) && number > 0 ? number : undefined; }
function fill(template: string, fields: Record<string, string>) { return template.replace(/\{(recipient|demands|handle|link|name|city|context)\}/g, (_, key: string) => fields[key] ?? "").replace(/\n{3,}/g, "\n\n").trim(); }
function statusPage(context: any, locale: Locale, message: string, status = 200) { return context.html(<Layout locale={locale} title={t(locale, "siteName")} path={`/${locale}`}><p role="status">{message}</p></Layout>, status); }
function actionTarget(db: Db, config: Config, requestId: number, action: string, subject: string, message: string) {
  const row = db.prepare(`SELECT r.email, r.whatsapp, g.locale FROM generated_requests g JOIN recipients r ON r.id = g.recipient_id WHERE g.id = ?`)
    .get(requestId) as { email: string | null; whatsapp: string | null; locale: string } | undefined;
  if (!row) return undefined;
  const share = encodeURIComponent(message);
  const link = encodeURIComponent(`${config.appBaseUrl}/${row.locale}`);
  const email = row.email?.trim();
  const whatsapp = row.whatsapp?.trim();
  if (action === "email_opened" && email) return { href: `mailto:${email}?${new URLSearchParams({ subject, body: message })}`, label: email };
  if (action === "whatsapp_opened" && whatsapp) return { href: `https://wa.me/${whatsapp}?text=${share}`, label: "WhatsApp" };
  if (action === "shared_x") return { href: `https://x.com/intent/post?text=${share}`, label: "X" };
  if (action === "shared_facebook") return { href: `https://www.facebook.com/sharer/sharer.php?u=${link}`, label: "Facebook" };
  if (action === "shared_whatsapp") return { href: `https://wa.me/?text=${share}`, label: "WhatsApp" };
  if (action === "shared_telegram") return { href: `https://t.me/share/url?url=${link}&text=${share}`, label: "Telegram" };
  return undefined;
}
