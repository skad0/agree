import { randomBytes } from "node:crypto";
import type { Hono } from "hono";
import type { Config } from "./config.js";
import type { Db } from "./db.js";
import { isLocale, localeNames, locales, t, type Locale } from "./i18n.js";
import { Layout } from "./layout.js";
import { Callout, JourneyIntro, PrimaryAction, Surface } from "./components/public-ui.js";
import {
  activeDirectoryMeta,
  directoryPublicationRef,
  getContactableRecipient,
  listContactableRecipients,
  listDirectoryBrowse,
  mention,
  parseDirectoryQuery,
  recipientsByIds,
  searchDirectory,
  selectedHiddenByFilter,
  suggestDirectory,
  type DirectoryBrowseItem,
  type DirectoryPage,
  type DirectoryQuery,
  type DirectorySuggestion,
  type Recipient
} from "./recipients.js";
import { privateNoStore, rememberLocale } from "./public-state.js";
import {
  addRecipient,
  beginHandoff,
  completeCurrent,
  contactFingerprint,
  currentRecipientId,
  emptyBasket,
  issueContactProof,
  readBasket,
  removeRecipient,
  SELECTION_MAX,
  sharedMailboxGroups,
  signBasket,
  verifyContactProof,
  type ContactDestination,
  type SelectionBasket
} from "./recipient-selection.js";
import {
  currentQuestionVersionForDemand,
  displayStanceForRecipient,
  displayStancesForRecipients,
  listSelectableQuestions,
  type PublicClassification,
  type QuestionChoice,
  type StanceDisplay
} from "./stances.js";
import { createRateLimiter, issueCsrf, issueRequestCapability, text, Turnstile, validCsrf, validTurnstile, values, verifyRequestCapability } from "./security.js";

type Template = { channel: "email" | "whatsapp" | "social"; subject: string | null; body: string };

const shareActions = ["shared_x", "shared_facebook", "shared_whatsapp", "shared_telegram"];
const actionTypes = ["email_opened", "whatsapp_opened", "text_copied", ...shareActions];

export function registerRequestRoutes(app: Hono, db: Db, config: Config) {
  const rateLimit = createRateLimiter();

  app.get("/:locale/request", (context) => {
    const locale = localeParam(context.req.param("locale"));
    if (!locale) return context.notFound();
    rememberLocale(context, locale, config);
    privateNoStore(context);
    if (!campaignEnabled(db)) return statusPage(context, locale, t(locale, "formDisabled"), 503);
    const csrf = issueCsrf(context, config);
    const query = parseDirectoryQuery({
      questionVersionId: String(positiveInteger(context.req.query("questionVersion")) ?? currentQuestionVersionForDemand(db, positiveInteger(context.req.query("demand"))) ?? "")
    });
    return context.html(directoryPage(locale, context.req.path, csrf, db, query, emptyBasket(Date.now(), directoryPublicationRef(db)), "", undefined));
  });

  app.post("/:locale/request", async (context) => {
    const locale = localeParam(context.req.param("locale"));
    if (!locale) return context.notFound();
    privateNoStore(context);
    const body = await context.req.parseBody();
    if (!rateLimit(context, "directory-search", 60, 3600)) return statusPage(context, locale, "Too many requests", 429);
    if (!validCsrf(context, config, body)) return statusPage(context, locale, t(locale, "invalidForm"), 403);
    if (!campaignEnabled(db)) return statusPage(context, locale, t(locale, "formDisabled"), 503);
    const csrf = issueCsrf(context, config);
    const loaded = loadBasket(db, config, body);
    const query = parseDirectoryQuery({
      q: text(body.q), listId: text(body.listId), partyId: text(body.partyId),
      personId: text(body.personId), page: text(body.page), currentPage: text(body.currentPage),
      clear: text(body.clear), questionVersionId: text(body.questionVersionId)
    });
    return context.html(directoryPage(locale, context.req.path, csrf, db, query, loaded.basket, loaded.token, selectionNotice(locale, loaded.reason)));
  });

  app.post("/:locale/request/selection", async (context) => {
    const locale = localeParam(context.req.param("locale"));
    if (!locale) return context.notFound();
    privateNoStore(context);
    const body = await context.req.parseBody();
    if (!rateLimit(context, "directory-selection", 60, 3600)) return statusPage(context, locale, "Too many requests", 429);
    if (!validCsrf(context, config, body)) return statusPage(context, locale, t(locale, "invalidForm"), 403);
    if (!campaignEnabled(db)) return statusPage(context, locale, t(locale, "formDisabled"), 503);
    const csrf = issueCsrf(context, config);
    const loaded = loadBasket(db, config, body);
    let basket = loaded.basket;
    let reason: SelectionNoticeReason | undefined = loaded.reason;
    const addId = positiveInteger(text(body.add));
    const removeId = positiveInteger(text(body.remove));
    if (addId) {
      const eligible = new Set(listContactableRecipients(db, locale).map((row) => row.id));
      const added = addRecipient(basket, addId, eligible);
      basket = added.basket;
      if (added.error === "limit") reason = "limit";
      else if (added.error === "ineligible" && !reason) reason = "ineligible";
    }
    if (removeId) basket = removeRecipient(basket, removeId);
    const query = parseDirectoryQuery({
      q: text(body.q), listId: text(body.listId), partyId: text(body.partyId),
      personId: text(body.personId), page: text(body.page), currentPage: text(body.currentPage),
      questionVersionId: text(body.questionVersionId)
    });
    return context.html(directoryPage(locale, `/${locale}/request`, csrf, db, query, basket, signedSelection(basket, config), selectionNotice(locale, reason)));
  });

  app.post("/:locale/request/review", async (context) => {
    const locale = localeParam(context.req.param("locale"));
    if (!locale) return context.notFound();
    privateNoStore(context);
    const body = await context.req.parseBody();
    if (!rateLimit(context, "directory-review", 60, 3600)) return statusPage(context, locale, "Too many requests", 429);
    if (!validCsrf(context, config, body)) return statusPage(context, locale, t(locale, "invalidForm"), 403);
    if (!campaignEnabled(db)) return statusPage(context, locale, t(locale, "formDisabled"), 503);
    const loaded = loadBasket(db, config, body);
    const questionVersionId = positiveInteger(text(body.questionVersionId)) ?? null;
    if (loaded.reason || !loaded.basket.ids.length) {
      const csrf = issueCsrf(context, config);
      return context.html(directoryPage(locale, `/${locale}/request`, csrf, db, parseDirectoryQuery({ questionVersionId: questionVersionId ? String(questionVersionId) : undefined }), loaded.basket, loaded.token, selectionNotice(locale, loaded.reason ?? "empty")));
    }
    const csrf = issueCsrf(context, config);
    return context.html(reviewDocument(locale, context.req.path, csrf, db, loaded.basket, loaded.token, questionVersionId));
  });

  app.post("/:locale/request/build", async (context) => {
    const locale = localeParam(context.req.param("locale"));
    if (!locale) return context.notFound();
    privateNoStore(context);
    const body = await context.req.parseBody();
    if (!rateLimit(context, "directory-build", 60, 3600)) return statusPage(context, locale, "Too many requests", 429);
    if (!validCsrf(context, config, body)) return statusPage(context, locale, t(locale, "invalidForm"), 403);
    if (!campaignEnabled(db)) return statusPage(context, locale, t(locale, "formDisabled"), 503);
    const loaded = loadBasket(db, config, body);
    if (loaded.reason || !loaded.basket.ids.length) return statusPage(context, locale, selectionNotice(locale, loaded.reason ?? "empty") ?? t(locale, "invalidForm"), 422);
    const currentId = currentRecipientId(loaded.basket);
    const recipient = currentId ? getContactableRecipient(db, locale, currentId) : undefined;
    if (!recipient) return statusPage(context, locale, t(locale, "directoryUnavailablePerson"), 422);
    const csrf = issueCsrf(context, config);
    const questionVersionId = positiveInteger(text(body.questionVersionId)) ?? null;
    return context.html(buildDocument(locale, context.req.path, csrf, db, recipient, config, loaded.token, loaded.basket.handoff?.demandIds ?? null, undefined, questionVersionId));
  });

  app.post("/:locale/request/suggest", async (context) => {
    const locale = localeParam(context.req.param("locale"));
    if (!locale) return context.notFound();
    privateNoStore(context);
    const body = await context.req.parseBody();
    const publicationId = directoryPublicationRef(db)?.publicationId ?? null;
    if (!rateLimit(context, "directory-suggest", 60, 60)) return context.json({ suggestions: null, error: "unavailable", publicationId }, 429);
    if (!validCsrf(context, config, body)) return context.json({ suggestions: null, error: "unavailable", publicationId }, 403);
    if (!campaignEnabled(db)) return context.json({ suggestions: null, error: "unavailable", publicationId }, 503);
    const query = parseDirectoryQuery({ q: text(body.q), listId: text(body.listId), partyId: text(body.partyId) });
    const suggestions = suggestDirectory(listDirectoryBrowse(db, locale), query).map((row) => publicSuggestion(locale, row));
    return context.json({ suggestions, publicationId });
  });

  app.get("/:locale/request/build", (context) => {
    const locale = localeParam(context.req.param("locale"));
    if (!locale) return context.notFound();
    rememberLocale(context, locale, config);
    if (!campaignEnabled(db)) return statusPage(context, locale, t(locale, "formDisabled"), 503);
    const recipientId = positiveInteger(context.req.query("recipient"));
    const recipient = recipientId ? getContactableRecipient(db, locale, recipientId) : undefined;
    if (!recipient) return context.redirect(`/${locale}/request`);
    const demandId = positiveInteger(context.req.query("demand"));
    const questionVersionId = positiveInteger(context.req.query("questionVersion")) ?? currentQuestionVersionForDemand(db, demandId);
    const csrf = issueCsrf(context, config);
    privateNoStore(context);
    const languageParts = [`recipient=${recipient.id}`];
    if (questionVersionId) languageParts.push(`questionVersion=${questionVersionId}`);
    if (demandId) languageParts.push(`demand=${demandId}`);
    const selectedDemands = demandId ? [demandId] : null;
    return context.html(buildDocument(locale, context.req.path, csrf, db, recipient, config, "", selectedDemands, languageParts.join("&"), questionVersionId));
  });

  app.post("/:locale/request/preview", async (context) => {
    const pageLocale = localeParam(context.req.param("locale"));
    if (!pageLocale) return context.notFound();
    privateNoStore(context);
    const body = await context.req.parseBody({ all: true });
    if (!rateLimit(context, "preview", config.rateLimitPreview, 3600)) return statusPage(context, pageLocale, "Too many requests", 429);
    if (!validCsrf(context, config, body) || !await validTurnstile(context, config, body)) return statusPage(context, pageLocale, t(pageLocale, "invalidForm"), 403);
    if (!campaignEnabled(db)) return statusPage(context, pageLocale, t(pageLocale, "formDisabled"), 503);
    const messageLocale = localeParam(text(body.messageLocale));
    const recipientId = positiveInteger(text(body.recipientId));
    const demandIds = values(body.demandId).map(positiveInteger).filter((id): id is number => Boolean(id));
    if (!messageLocale || !recipientId || !demandIds.length) return statusPage(context, pageLocale, t(pageLocale, "invalidForm"), 422);
    const recipient = getContactableRecipient(db, messageLocale, recipientId);
    const placeholders = demandIds.map(() => "?").join(",");
    const demands = db.prepare(`SELECT dt.title FROM demands d JOIN campaigns c ON c.id = d.campaign_id
      JOIN demand_translations dt ON dt.demand_id = d.id AND dt.locale = ?
      WHERE c.status = 'active' AND d.is_active = 1 AND d.document = 'standard' AND d.id IN (${placeholders}) ORDER BY d.sort_order`).all(messageLocale, ...demandIds) as { title: string }[];
    const templates = db.prepare("SELECT channel, subject, body FROM message_templates WHERE locale = ?").all(messageLocale) as Template[];
    const email = templates.find((template) => template.channel === "email");
    const whatsapp = templates.find((template) => template.channel === "whatsapp");
    const social = templates.find((template) => template.channel === "social");
    if (!recipient || !email || !whatsapp || !social || demands.length !== new Set(demandIds).size) return statusPage(context, pageLocale, t(pageLocale, "unavailable"), 422);
    const loaded = loadBasket(db, config, body);
    let selectionToken = "";
    if (text(body.selection)) {
      if (loaded.reason || !loaded.basket.ids.length) return statusPage(context, pageLocale, selectionNotice(pageLocale, loaded.reason ?? "empty") ?? t(pageLocale, "invalidForm"), 422);
      const withHandoff = loaded.basket.handoff
        ? { ...loaded.basket, handoff: { ...loaded.basket.handoff, demandIds: [...new Set(demandIds)] } }
        : beginHandoff(loaded.basket, demandIds);
      if (!withHandoff || currentRecipientId(withHandoff) !== recipientId) return statusPage(context, pageLocale, t(pageLocale, "invalidForm"), 422);
      selectionToken = signBasket(withHandoff, config);
    }
    const created = createGeneratedRequest(db, recipient.id, messageLocale, JSON.stringify([...new Set(demandIds)]));
    const campaignLink = `${config.appBaseUrl}/${messageLocale}`;
    const resultLink = `${config.appBaseUrl}/${messageLocale}/request/result?request=${created.public_id}`;
    const fields = {
      recipient: recipient.name,
      demands: demands.map((demand) => `• ${demand.title}`).join("\n"),
      handle: mention(recipient),
      name: text(body.name).slice(0, 100), city: text(body.city).slice(0, 100), context: text(body.context).slice(0, 500)
    };
    // Email/WhatsApp {link} points at the campaign; social {link} is the public result URL for sharing.
    const subject = fill(email.subject ?? "", { ...fields, link: campaignLink });
    const emailBody = fill(email.body, { ...fields, link: campaignLink });
    const whatsappBody = fill(whatsapp.body, { ...fields, link: campaignLink });
    const socialBody = fill(social.body, { ...fields, link: resultLink });
    const capability = issueRequestCapability(created.id, config);
    const contactProof = issueContactProof(created.id, contactFingerprint(recipient), config);
    privateNoStore(context);
    return context.html(<Layout locale={pageLocale} title={t(pageLocale, "previewTitle")} path={context.req.path}>
      <div class="request-page request-preview-page">
      <JourneyIntro eyebrow={<>{t(pageLocale, "stepSend")} · <bdi>3/3</bdi></>} title={t(pageLocale, "previewTitle")} headingId="preview-heading" />
      <p role="note">{t(pageLocale, "editHint")}</p>
      <Callout tone="muted"><p class="note">{t(pageLocale, "requestPreparedNote")}</p></Callout>
      <form class="request-form letter-ready-form" method="post" action={`/${pageLocale}/request/action`} aria-labelledby="preview-heading">
        <input type="hidden" name="csrf" value={text(body.csrf)} /><input type="hidden" name="requestId" value={created.id} /><input type="hidden" name="capability" value={capability} /><input type="hidden" name="contactProof" value={contactProof} />
        {selectionToken ? <input type="hidden" name="selection" value={selectionToken} /> : null}
        <label>{t(pageLocale, "emailSubject")}<input name="subject" value={subject} maxLength={200} /></label>
        <label>{t(pageLocale, "emailBody")}<textarea id="copy-message" name="message" rows={10} maxLength={5000}>{emailBody}</textarea></label>
        <label>{t(pageLocale, "whatsappText")}<textarea name="whatsappMessage" rows={4} maxLength={2000}>{whatsappBody}</textarea></label>
        <label>{t(pageLocale, "socialText")}<textarea name="socialMessage" rows={6} maxLength={2000}>{socialBody}</textarea></label>
        <Turnstile config={config} />
        {/* Reaching the official is the substantive act, so it is the only filled button here. */}
        <h2 id="send-heading" class="section-label">{t(pageLocale, "stepSend")}</h2>
        <div class="actions request-actions" role="group" aria-labelledby="send-heading">
          {recipient.email?.trim() ? <button type="submit" name="action" value="email_opened">{t(pageLocale, "openEmail")}</button> : null}
          {recipient.whatsapp?.trim() ? <button type="submit" name="action" value="whatsapp_opened" class="ghost">{t(pageLocale, "openWhatsapp")}</button> : null}
          <button type="submit" name="action" value="text_copied" class="ghost" data-copy="copy-message" data-copy-endpoint={`/${pageLocale}/request/copy`}>{t(pageLocale, "copyText")}</button>
        </div>
        <div class="confirm report-sent-action">
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
      </div>
    </Layout>);
  });

  app.post("/:locale/request/action", async (context) => {
    const locale = localeParam(context.req.param("locale"));
    if (!locale) return context.notFound();
    privateNoStore(context);
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
    if (action === "email_opened" || action === "whatsapp_opened") {
      const contactError = openedContactError(db, config, requestId, text(body.contactProof), locale);
      if (contactError) return statusPage(context, locale, contactError, 422);
      if (!target) return statusPage(context, locale, t(locale, "unavailable"), 422);
    }
    const publicId = publicRequestId(db, requestId);
    if (!publicId) return statusPage(context, locale, t(locale, "invalidForm"), 422);
    db.prepare("INSERT INTO request_actions (generated_request_id, action_type, created_at) VALUES (?, ?, ?)").run(requestId, action, new Date().toISOString());
    const csrf = issueCsrf(context, config);
    privateNoStore(context);
    return context.html(<Layout locale={locale} title={t(locale, "actionReady")} path={context.req.path}>
      <div class="request-page action-ready-page">
      <JourneyIntro title={t(locale, "actionReady")} />
      <Surface class="action-ready-surface">
      {target ? <p><a class="primary-action" role="button" href={target.href} dir="ltr" target={target.href.startsWith("https:") ? "_blank" : undefined} rel="noopener noreferrer">{target.label}</a></p> : null}
      {action === "shared_facebook" ? <p role="note">{t(locale, "facebookNote")}</p> : null}
      {action === "text_copied" || action === "shared_facebook" ? <><textarea id="copy-message" readOnly>{message}</textarea><button type="button" data-copy="copy-message">{t(locale, "copyText")}</button></> : null}
      {nextPersonForm(locale, csrf, db, config, body)}
      <p><a href={`/${locale}/request/result?request=${publicId}`}>{t(locale, "next")}</a></p>
      </Surface>
      </div>
    </Layout>);
  });

  app.post("/:locale/request/copy", async (context) => {
    const locale = localeParam(context.req.param("locale"));
    if (!locale) return context.notFound();
    privateNoStore(context);
    const body = await context.req.parseBody();
    const keys = Object.keys(body).filter((key) => body[key] !== undefined);
    const requestId = positiveInteger(text(body.requestId));
    if (!campaignEnabled(db)) return statusPage(context, locale, t(locale, "formDisabled"), 503);
    if (!rateLimit(context, "copy", config.rateLimitAction, 3600) || keys.some((key) => !["csrf", "requestId", "capability", "selection", "contactProof"].includes(key)) || !validCsrf(context, config, body) || !requestId || !requestExists(db, requestId) || !verifyRequestCapability(text(body.capability), requestId, config)) return statusPage(context, locale, t(locale, "invalidForm"), 422);
    db.prepare("INSERT INTO request_actions (generated_request_id, action_type, created_at) VALUES (?, 'text_copied', ?)").run(requestId, new Date().toISOString());
    return context.body(null, 204);
  });

  app.post("/:locale/request/report-sent", async (context) => {
    const locale = localeParam(context.req.param("locale"));
    if (!locale) return context.notFound();
    privateNoStore(context);
    const body = await context.req.parseBody();
    if (!campaignEnabled(db)) return statusPage(context, locale, t(locale, "formDisabled"), 503);
    if (!rateLimit(context, "action", config.rateLimitAction, 3600) || !validCsrf(context, config, body) || !await validTurnstile(context, config, body)) return statusPage(context, locale, t(locale, "invalidForm"), 403);
    const requestId = positiveInteger(text(body.requestId));
    if (!requestId || !requestExists(db, requestId) || !verifyRequestCapability(text(body.capability), requestId, config)) return statusPage(context, locale, t(locale, "invalidForm"), 422);
    const publicId = publicRequestId(db, requestId);
    if (!publicId) return statusPage(context, locale, t(locale, "invalidForm"), 422);
    db.prepare("INSERT INTO request_actions (generated_request_id, action_type, created_at) VALUES (?, 'reported_sent', ?)").run(requestId, new Date().toISOString());
    const next = nextPersonForm(locale, issueCsrf(context, config), db, config, body);
    if (next) {
      privateNoStore(context);
      return context.html(<Layout locale={locale} title={t(locale, "afterReport")} path={context.req.path}>
        <div class="request-page action-ready-page">
          <JourneyIntro title={t(locale, "afterReport")} />
          <Surface class="action-ready-surface">{next}<p><a href={`/${locale}/request/result?request=${publicId}`}>{t(locale, "next")}</a></p></Surface>
        </div>
      </Layout>);
    }
    return context.redirect(`/${locale}/request/result?request=${publicId}`, 303);
  });

  app.get("/:locale/request/result", (context) => {
    const locale = localeParam(context.req.param("locale"));
    if (!locale) return context.notFound();
    rememberLocale(context, locale, config);
    const publicId = context.req.query("request") ?? "";
    const request = publicId ? db.prepare(`SELECT g.id, g.public_id AS publicId, g.locale, r.type, r.social_handle AS socialHandle, rt.name AS recipient, g.selected_demands
      FROM generated_requests g JOIN recipients r ON r.id = g.recipient_id JOIN recipient_translations rt ON rt.recipient_id = g.recipient_id AND rt.locale = g.locale WHERE g.public_id = ?`).get(publicId) as { id: number; publicId: string; locale: string; type: "party" | "politician"; socialHandle: string | null; recipient: string; selected_demands: string } | undefined : undefined;
    if (!request || !isLocale(request.locale)) return statusPage(context, locale, t(locale, "invalidForm"), 422);
    const demandIds = JSON.parse(request.selected_demands) as number[];
    const placeholders = demandIds.map(() => "?").join(",");
    const demands = placeholders ? db.prepare(`SELECT dt.title FROM demand_translations dt WHERE dt.locale = ? AND dt.demand_id IN (${placeholders}) ORDER BY dt.demand_id`).all(request.locale, ...demandIds) as { title: string }[] : [];
    const social = db.prepare("SELECT body FROM message_templates WHERE locale = ? AND channel = 'social'").get(request.locale) as { body: string } | undefined;
    const recipient = { id: 0, type: request.type, name: request.recipient, email: null, whatsapp: null, socialHandle: request.socialHandle } satisfies Recipient;
    const resultUrl = `${config.appBaseUrl}/${request.locale}/request/result?request=${request.publicId}`;
    const message = social ? fill(social.body, { recipient: request.recipient, demands: demands.map((demand) => `• ${demand.title}`).join("\n"), handle: mention(recipient), link: resultUrl, name: "", city: "", context: "" }) : `${mention(recipient)}\n\n${demands.map((demand) => `• ${demand.title}`).join("\n")}`;
    const share = encodeURIComponent(message);
    const link = encodeURIComponent(resultUrl);
    privateNoStore(context);
    return context.html(<Layout locale={locale} title={t(locale, "resultTitle")} path={context.req.path} languageQuery={`request=${request.publicId}`}
      shareMeta={{ url: resultUrl, description: message.slice(0, 300) }}>
      <div class="request-page request-result-page">
      <JourneyIntro title={t(locale, "resultTitle")} />
      <Surface class="result-surface">
        <p>{t(locale, "shareForRecipient")} <strong><bdi dir="auto">{request.recipient}</bdi></strong>.</p>
        <nav class="result-actions" aria-label={t(locale, "shareForRecipient")}>
          <a href={`https://x.com/intent/post?text=${share}`}>X</a> ·
          <a href={`https://wa.me/?text=${share}`}>WhatsApp</a> ·
          <a href={`https://t.me/share/url?url=${link}&text=${share}`}>Telegram</a> ·
          <a href={`https://www.facebook.com/sharer/sharer.php?u=${link}`}>Facebook</a> ·
          <a href={resultUrl}>Link</a>
        </nav>
        <Callout tone="muted"><p>{t(locale, "requestPreparedNote")}</p></Callout>
      </Surface>
      </div>
    </Layout>);
  });
}

function directoryPage(locale: Locale, path: string, csrf: string, db: Db, query: DirectoryQuery, basket: SelectionBasket, token: string, notice?: string) {
  const items = listDirectoryBrowse(db, locale);
  const page = searchDirectory(items, query);
  const questions = listSelectableQuestions(db, locale);
  const stances = displayStancesForRecipients(db, page.rows.map((row) => row.id), query.questionVersionId, locale);
  return directoryDocument(locale, path, csrf, query, page, items, basket, token, questions, stances, notice, activeDirectoryMeta(db));
}

function directoryDocument(locale: Locale, path: string, csrf: string, query: DirectoryQuery, page: DirectoryPage, items: DirectoryBrowseItem[], basket: SelectionBasket, token: string, questions: QuestionChoice[], stances: Map<number, StanceDisplay>, notice?: string, directoryMeta: ReturnType<typeof activeDirectoryMeta> = null) {
  const selected = query.personId ? items.find((item) => item.id === query.personId) : undefined;
  const selectedIds = new Set(basket.ids);
  const selectedPeople = basket.ids.map((id) => items.find((item) => item.id === id));
  const hidden = selectedHiddenByFilter(items, query, basket.ids);
  const selectedQuestion = questions.find((row) => row.versionId === query.questionVersionId);
  const electionNotice = directoryMeta
    ? t(locale, "directoryElectionActive")
      .replace("{n}", String(directoryMeta.electionNumber))
      .replace("{date}", directoryMeta.activatedAt ? directoryMeta.activatedAt.slice(0, 10) : "—")
    : t(locale, "directoryNoElection");
  return <Layout locale={locale} title={t(locale, "requestTitle")} path={path}>
    <div class="request-page request-recipient-page">
      <JourneyIntro eyebrow={<>{t(locale, "stepChoose")} · <bdi>1/3</bdi></>} title={t(locale, "directoryTitle")} />
      <Callout tone="muted"><p>{electionNotice}</p></Callout>
      {notice ? <Callout tone="caution"><p role="status">{notice}</p></Callout> : null}
      <Surface class="recipient-panel">
        <form class="directory-search" method="post" action={`/${locale}/request`} data-directory-search data-suggest={`/${locale}/request/suggest`} data-suggest-unavailable={t(locale, "directorySuggestUnavailable")}>
          <input type="hidden" name="csrf" value={csrf} />
          <input type="hidden" name="currentPage" value={page.page} />
          {token ? <input type="hidden" name="selection" value={token} /> : null}
          {query.personId ? <input type="hidden" name="personId" value={query.personId} /> : null}
          <label>{t(locale, "directorySearchLabel")}
            <input id="directory-q" name="q" type="search" value={query.q} maxLength={100} autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="directory-suggest" />
          </label>
          <ul id="directory-suggest" class="directory-suggest" role="listbox" hidden></ul>
          {page.filters.lists.length ? <label>{t(locale, "directoryListFilter")}
            <select name="listId"><option value="">{t(locale, "directoryFilterAll")}</option>
              {page.filters.lists.map((option) => <option value={option.id} selected={option.id === query.listId}>{option.label}{option.ballotLetters ? ` (${option.ballotLetters})` : ""}</option>)}
            </select>
          </label> : null}
          {page.filters.parties.length ? <label>{t(locale, "directoryPartyFilter")}
            <select name="partyId"><option value="">{t(locale, "directoryFilterAll")}</option>
              {page.filters.parties.map((option) => <option value={option.id} selected={option.id === query.partyId}>{option.label}</option>)}
            </select>
          </label> : null}
          {questions.length ? <label>{t(locale, "stancePositionOn")}
            <select name="questionVersionId">
              <option value="">{t(locale, "stanceNone")}</option>
              {questions.map((question) => <option value={question.versionId} selected={question.versionId === query.questionVersionId}>{question.title}</option>)}
            </select>
          </label> : null}
          {selectedQuestion ? <QuestionHelp locale={locale} body={selectedQuestion.body} rationale={selectedQuestion.rationale} /> : null}
          {questions.length ? <p class="stance-methodology">{t(locale, "stanceMethodology")} <a href={`/${locale}/methodology`}>{t(locale, "navMethodology")}</a></p> : null}
          {!page.filters.lists.length && !page.filters.parties.length ? <p class="directory-filter-note">{t(locale, "directoryFiltersUnavailable")}</p> : null}
          <div class="directory-search-actions">
            <button type="submit" name="page" value="1">{t(locale, "directorySearch")}</button>
            {query.q || query.personId || query.listId || query.partyId ? <button type="submit" name="clear" value="1">{t(locale, "directoryClear")}</button> : null}
            {basket.ids.length ? <button type="submit" class="primary-action" formaction={`/${locale}/request/review`}>{t(locale, "directoryReview")}</button> : null}
          </div>
          {selected ? <p class="directory-chip">{selected.name}</p> : null}
          {basket.ids.length ? <div class="directory-basket">
            <p class="directory-status" role="status">{t(locale, "directoryPeopleSelected").replace("{n}", String(basket.ids.length))}</p>
            <ul>{selectedPeople.map((person) => person ? <li>{person.name} <button type="submit" formaction={`/${locale}/request/selection`} name="remove" value={person.id}>{t(locale, "directoryRemove")}</button></li> : null)}</ul>
          </div> : null}
          <p class="directory-status" role="status">{page.total} {t(locale, "directoryMatches")}{page.pageCount > 1 ? ` · ${t(locale, "directoryPage")} ${page.page}` : ""}{basket.ids.length ? ` · ${t(locale, "directoryPeopleSelected").replace("{n}", String(basket.ids.length))}` : ""}{hidden ? ` · ${t(locale, "directoryHiddenSelected").replace("{n}", String(hidden))}` : ""}</p>
          {page.rows.length ? <ul class="recipient-list">{page.rows.map((item) => <li class={selectedIds.has(item.id) ? "recipient-row recipient-row-selected" : "recipient-row"}>
            <div class="recipient-copy">
              <strong class="recipient-name">{item.name}</strong>
              <p class="recipient-meta">{item.type === "party" ? t(locale, "directoryRoleParty") : t(locale, "directoryRolePerson")}
                {item.list ? ` · ${item.list.label}${item.list.ballotLetters ? ` (${item.list.ballotLetters})` : ""}` : ""}
                {item.party ? ` · ${item.party.label}` : ""}
                {" · "}{item.contactable ? t(locale, "directoryContactable") : t(locale, "directoryNotContactable")}
              </p>
              <StanceSummary locale={locale} display={stances.get(item.id) ?? { state: "none" }} />
            </div>
            <div class="recipient-actions">
              {item.contactable && selectedIds.has(item.id) ? <button type="submit" formaction={`/${locale}/request/selection`} name="remove" value={item.id}>{t(locale, "directoryRemove")}</button> : null}
              {item.contactable && !selectedIds.has(item.id) ? <button type="submit" formaction={`/${locale}/request/selection`} name="add" value={item.id}>{t(locale, "directoryAdd")}</button> : null}
              {item.contactable ? <a class="recipient-ask" href={`/${locale}/request/build?recipient=${item.id}${query.questionVersionId ? `&questionVersion=${query.questionVersionId}` : ""}`}>{t(locale, "directoryAsk")}</a> : null}
            </div>
          </li>)}</ul> : <p>{t(locale, "directoryEmpty")}</p>}
          {page.pageCount > 1 ? <div class="directory-pager">
            {page.page > 1 ? <button type="submit" name="page" value={page.page - 1}>{t(locale, "directoryPrevious")}</button> : null}
            {page.page < page.pageCount ? <button type="submit" name="page" value={page.page + 1}>{t(locale, "next")}</button> : null}
          </div> : null}
        </form>
      </Surface>
    </div>
  </Layout>;
}

function reviewDocument(locale: Locale, path: string, csrf: string, db: Db, basket: SelectionBasket, token: string, questionVersionId: number | null) {
  const people = reviewPeople(db, locale, basket.ids);
  const shared = sharedMailboxGroups(people.filter((row) => row.contactable));
  return <Layout locale={locale} title={t(locale, "directoryReview")} path={path}>
    <div class="request-page request-review-page">
      <JourneyIntro eyebrow={<>{t(locale, "stepChoose")} · <bdi>1/3</bdi></>} title={t(locale, "directoryReview")} headingId="review-heading" />
      {shared.map((group) => <Callout tone="caution"><p role="status">{t(locale, "directorySharedMailbox").replace("{n}", String(group.count))}</p></Callout>)}
      <Surface class="recipient-panel">
        <form method="post" action={`/${locale}/request/build`}>
          <input type="hidden" name="csrf" value={csrf} />
          <input type="hidden" name="selection" value={token} />
          {questionVersionId ? <input type="hidden" name="questionVersionId" value={questionVersionId} /> : null}
          <ul class="recipient-list">{people.map((person) => <li class="recipient-row">
            <div class="recipient-copy">
              <strong class="recipient-name">{person.name}</strong>
              <p class="recipient-meta">{destinationLine(locale, person)}</p>
            </div>
            <button type="submit" formaction={`/${locale}/request/selection`} name="remove" value={person.id}>{t(locale, "directoryRemove")}</button>
          </li>)}</ul>
          {people.some((row) => row.contactable) ? <PrimaryAction>{t(locale, "directoryPrepare")}</PrimaryAction> : null}
        </form>
      </Surface>
    </div>
  </Layout>;
}

function buildDocument(locale: Locale, path: string, csrf: string, db: Db, recipient: Recipient, config: Config, selection: string, selectedDemands: number[] | null, languageQuery?: string, questionVersionId: number | null = null) {
  const demands = db.prepare(`SELECT d.id, dt.title, dt.body, dt.rationale FROM demands d JOIN campaigns c ON c.id = d.campaign_id
    LEFT JOIN demand_translations dt ON dt.demand_id = d.id AND dt.locale = ?
    WHERE c.status = 'active' AND d.is_active = 1 AND d.document = 'standard' ORDER BY d.sort_order`).all(locale) as { id: number; title: string | null; body: string | null; rationale: string | null }[];
  const translatedIds = demands.flatMap((demand) => demand.title ? [demand.id] : []);
  const checked = new Set(selectedDemands === null ? translatedIds : selectedDemands);
  const questions = listSelectableQuestions(db, locale);
  const selectedQuestion = questions.find((row) => row.versionId === questionVersionId);
  const stance = displayStanceForRecipient(db, recipient.id, questionVersionId, locale);
  return <Layout locale={locale} title={t(locale, "buildTitle")} path={path} languageQuery={languageQuery}>
    <div class="request-page request-build-page">
      <JourneyIntro eyebrow={<>{t(locale, "stepBuild")} · <bdi>2/3</bdi></>} title={t(locale, "buildTitle")} headingId="build-heading" />
      <p class="request-recipient-line">{t(locale, "recipient")}: <strong>{recipient.name}</strong></p>
      {questions.length ? <form class="stance-question" method="get" action={`/${locale}/request/build`}>
        <input type="hidden" name="recipient" value={recipient.id} />
        <label>{t(locale, "stancePositionOn")}
          <select name="questionVersion">
            <option value="">{t(locale, "stanceNone")}</option>
            {questions.map((question) => <option value={question.versionId} selected={question.versionId === questionVersionId}>{question.title}</option>)}
          </select>
        </label>
        {selectedQuestion ? <QuestionHelp locale={locale} body={selectedQuestion.body} rationale={selectedQuestion.rationale} /> : null}
        <button type="submit">{t(locale, "directorySearch")}</button>
      </form> : null}
      <StanceSummary locale={locale} display={stance} />
      <form class="request-form wording-panel" method="post" action={`/${locale}/request/preview`} aria-labelledby="build-heading">
        <input type="hidden" name="csrf" value={csrf} /><input type="hidden" name="recipientId" value={recipient.id} />
        {selection ? <input type="hidden" name="selection" value={selection} /> : null}
        <fieldset class="demand-fieldset"><legend>{t(locale, "selectDemand")}</legend>{demands.map((demand) => demand.title
          ? <div class="demand-option">
              <label>{checked.has(demand.id)
                ? <input type="checkbox" name="demandId" value={demand.id} checked />
                : <input type="checkbox" name="demandId" value={demand.id} />} {demand.title}</label>
              <QuestionHelp locale={locale} body={demand.body} rationale={demand.rationale} />
            </div>
          : <p role="status">{t(locale, "unavailable")}</p>)}</fieldset>
        <label>{t(locale, "messageLanguage")}<select name="messageLocale">{locales.map((option) => <option value={option} selected={option === locale} lang={option}>{localeNames[option]}</option>)}</select></label>
        <label>{t(locale, "name")}<input name="name" maxLength={100} /></label>
        <label>{t(locale, "city")}<input name="city" maxLength={100} /></label>
        <label>{t(locale, "personalContext")}<textarea name="context" maxLength={500}></textarea></label>
        <Turnstile config={config} /><button type="submit">{t(locale, "next")}</button>
      </form>
    </div>
  </Layout>;
}

function reviewPeople(db: Db, locale: Locale, ids: number[]): ContactDestination[] {
  const named = recipientsByIds(db, locale, ids);
  const sendable = new Set(listContactableRecipients(db, locale).map((row) => row.id));
  return named.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
    whatsapp: row.whatsapp,
    contactable: sendable.has(row.id)
  }));
}

function destinationLine(locale: Locale, person: ContactDestination) {
  if (person.email?.trim()) return `${t(locale, "directoryDirectEmail")}: ${person.email.trim()}`;
  if (person.whatsapp?.trim()) return `${t(locale, "directoryDirectWhatsapp")}: ${person.whatsapp.trim()}`;
  return t(locale, "directoryUnavailablePerson");
}

type SelectionNoticeReason = "tampered" | "expired" | "version" | "limit" | "ineligible" | "empty";

function loadBasket(db: Db, config: Config, body: Record<string, unknown>) {
  const publication = directoryPublicationRef(db);
  const parsed = readBasket(text(body.selection), config, { publication });
  return { basket: parsed.basket, token: parsed.ok && parsed.basket.ids.length ? signBasket(parsed.basket, config) : "", reason: parsed.ok ? undefined : parsed.reason };
}

function signedSelection(basket: SelectionBasket, config: Config) {
  return basket.ids.length ? signBasket(basket, config) : "";
}

function selectionNotice(locale: Locale, reason?: SelectionNoticeReason) {
  switch (reason) {
    case undefined: return undefined;
    case "limit": return t(locale, "directorySelectionMax").replace("{n}", String(SELECTION_MAX));
    case "expired":
    case "version": return t(locale, "directorySelectionExpired");
    case "ineligible": return t(locale, "directoryNotContactable");
    case "empty": return t(locale, "directorySelectionInvalid");
    case "tampered": return t(locale, "directorySelectionInvalid");
    default: {
      const _never: never = reason;
      return _never;
    }
  }
}

function openedContactError(db: Db, config: Config, requestId: number, proof: string, locale: Locale) {
  const row = db.prepare(`SELECT g.recipient_id AS recipientId, g.locale FROM generated_requests g WHERE g.id = ?`).get(requestId) as { recipientId: number; locale: string } | undefined;
  if (!row || !isLocale(row.locale)) return t(locale, "unavailable");
  const recipient = getContactableRecipient(db, row.locale, row.recipientId);
  if (!recipient) return t(locale, "directoryUnavailablePerson");
  if (!verifyContactProof(proof, requestId, contactFingerprint(recipient), config)) return t(locale, "directoryContactChanged");
  return undefined;
}

function nextPersonForm(locale: Locale, csrf: string, db: Db, config: Config, body: Record<string, unknown>) {
  const loaded = loadBasket(db, config, body);
  if (loaded.reason || !loaded.basket.handoff) return null;
  const next = completeCurrent(loaded.basket);
  if (!next.handoff?.remainingIds.length) return null;
  return <form method="post" action={`/${locale}/request/build`}>
    <input type="hidden" name="csrf" value={csrf} />
    <input type="hidden" name="selection" value={signBasket(next, config)} />
    {text(body.questionVersionId) ? <input type="hidden" name="questionVersionId" value={text(body.questionVersionId)} /> : null}
    <button type="submit" class="primary-action">{t(locale, "directoryNextPerson")}</button>
  </form>;
}

function QuestionHelp({ locale, body, rationale }: { locale: Locale; body: string | null; rationale: string | null }) {
  const explanation = body
    ? <><p><strong>{t(locale, "directoryQuestionWhat")}</strong> {body}</p>{rationale ? <p><strong>{t(locale, "directoryQuestionAnswer")}</strong> {rationale}</p> : null}</>
    : <p>{t(locale, "unavailable")}</p>;
  return <div class="question-help">
    <details>
      <summary>{t(locale, "directoryQuestionHelp")}</summary>
      <div class="question-help-panel">{explanation}</div>
    </details>
    {body ? <div class="question-help-tooltip" role="tooltip" aria-hidden="true"><p>{body}</p>{rationale ? <p>{rationale}</p> : null}</div> : null}
  </div>;
}

function StanceSummary({ locale, display }: { locale: Locale; display: StanceDisplay }) {
  switch (display.state) {
    case "none": return null;
    case "unknown": return <p class="recipient-stance">{t(locale, "stanceUnknown")}</p>;
    case "under_review": return <p class="recipient-stance">{t(locale, "stanceUnderReview")}</p>;
    case "published": return <div class="recipient-stance">
      <p>{publishedHeadline(locale, display)}</p>
      {display.summary ? <p>{display.summary}</p> : null}
      {display.sourceUrl ? <p>
        <a href={display.sourceUrl} rel="nofollow noopener" dir="ltr">{t(locale, "stanceSource")}</a>
        {display.statementAt ? <> · <time datetime={display.statementAt}>{display.statementAt.slice(0, 10)}</time></> : null}
      </p> : null}
    </div>;
    default: {
      const _never: never = display;
      return _never;
    }
  }
}

function publishedHeadline(locale: Locale, display: Extract<StanceDisplay, { state: "published" }>): string {
  const parts: string[] = [];
  if (display.historical) parts.push(t(locale, "stanceHistorical"));
  if (display.individualUnknown) parts.push(display.attribution === "list" ? t(locale, "stanceListOnly") : t(locale, "stancePartyOnly"));
  else parts.push(classificationLabel(locale, display.classification));
  return parts.join(" · ");
}

function classificationLabel(locale: Locale, classification: PublicClassification): string {
  switch (classification) {
    case "supports": return t(locale, "stanceSupports");
    case "supports_with_reservations": return t(locale, "stanceSupportsWithReservations");
    case "opposes": return t(locale, "stanceOpposes");
    case "statement_available": return t(locale, "stanceStatementAvailable");
    case "multiple": return t(locale, "stanceMultiple");
    default: {
      const _never: never = classification;
      return _never;
    }
  }
}

function publicSuggestion(locale: Locale, suggestion: DirectorySuggestion) {
  switch (suggestion.kind) {
    case "person":
      return {
        kind: suggestion.kind,
        id: suggestion.id,
        label: suggestion.label,
        context: suggestion.context,
        contactable: suggestion.contactable,
        typeLabel: suggestion.role === "party" ? t(locale, "directorySuggestParty") : t(locale, "directorySuggestPerson"),
        statusLabel: suggestion.contactable ? null : t(locale, "directoryNotContactable")
      };
    case "party":
      return { kind: suggestion.kind, id: suggestion.id, label: suggestion.label, context: suggestion.context, typeLabel: t(locale, "directorySuggestParty") };
    case "list":
      return { kind: suggestion.kind, id: suggestion.id, label: suggestion.label, context: suggestion.context, typeLabel: t(locale, "directorySuggestList") };
    default: {
      const _never: never = suggestion;
      return _never;
    }
  }
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
function fill(template: string, fields: Record<string, string>) {
  return template.replace(/\r\n/g, "\n").replace(/\{(recipient|demands|handle|link|name|city|context)\}/g, (_, key: string) => fields[key] ?? "").replace(/\n{3,}/g, "\n\n").trim();
}
function statusPage(context: any, locale: Locale, message: string, status = 200) { privateNoStore(context); return context.html(<Layout locale={locale} title={t(locale, "siteName")} path={`/${locale}`}><div class="status-page"><h1>{t(locale, "siteName")}</h1><p role="status">{message}</p></div></Layout>, status); }
function actionTarget(db: Db, config: Config, requestId: number, action: string, subject: string, message: string) {
  const row = db.prepare(`SELECT r.email, r.whatsapp, g.locale, g.public_id AS publicId FROM generated_requests g JOIN recipients r ON r.id = g.recipient_id WHERE g.id = ?`)
    .get(requestId) as { email: string | null; whatsapp: string | null; locale: string; publicId: string } | undefined;
  if (!row) return undefined;
  const share = encodeURIComponent(message.replace(/\r\n/g, "\n"));
  const resultUrl = `${config.appBaseUrl}/${row.locale}/request/result?request=${row.publicId}`;
  const link = encodeURIComponent(resultUrl);
  const email = row.email?.trim();
  const whatsapp = row.whatsapp?.trim();
  if (action === "email_opened" && email) return { href: `mailto:${email}?${new URLSearchParams({ subject, body: message.replace(/\r\n/g, "\n") })}`, label: email };
  if (action === "whatsapp_opened" && whatsapp) return { href: `https://wa.me/${whatsapp}?text=${share}`, label: "WhatsApp" };
  if (action === "shared_x") return { href: `https://x.com/intent/post?text=${share}`, label: "X" };
  if (action === "shared_facebook") return { href: `https://www.facebook.com/sharer/sharer.php?u=${link}`, label: "Facebook" };
  if (action === "shared_whatsapp") return { href: `https://wa.me/?text=${share}`, label: "WhatsApp" };
  if (action === "shared_telegram") return { href: `https://t.me/share/url?url=${link}&text=${share}`, label: "Telegram" };
  return undefined;
}
