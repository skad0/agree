import type { Hono } from "hono";
import { AMHARIC_BOLD, AMHARIC_REGULAR, CSS, JS, THEME_JS, amharicBoldPath, amharicRegularPath, cssPath, jsPath, themePath } from "./assets.js";
import { registerContentRoutes } from "./content.js";
import { markdown } from "./markdown.js";
import { getCookie, setCookie } from "hono/cookie";
import type { Config } from "./config.js";
import type { Db } from "./db.js";
import { dirOf, isLocale, localeFromRequest, localeNames, locales, t, type Locale } from "./i18n.js";
import { Layout } from "./layout.js";
import { registerRequestRoutes } from "./requests.js";
import { registerResponseRoutes } from "./responses.js";
import { registerPrivacyRoutes } from "./privacy.js";
import { registerSupportRoutes } from "./support.js";

type Demand = { id: number; title: string | null; body: string | null };

export function registerPublicRoutes(app: Hono, db: Db, config: Config) {
  // The URL carries the content hash, so these may be cached forever without stranding a deploy.
  const asset = (path: string, type: string, body: string) => app.get(path, (context) => {
    context.header("Content-Type", `${type}; charset=utf-8`);
    context.header("Cache-Control", "public, max-age=31536000, immutable");
    return context.body(body);
  });
  asset(cssPath, "text/css", CSS);
  asset(jsPath, "text/javascript", JS);
  asset(themePath, "text/javascript", THEME_JS);
  const font = (path: string, body: Uint8Array) => app.get(path, (context) => {
    context.header("Content-Type", "font/woff2");
    context.header("Cache-Control", "public, max-age=31536000, immutable");
    return context.body(body as any);
  });
  font(amharicRegularPath, AMHARIC_REGULAR);
  font(amharicBoldPath, AMHARIC_BOLD);

  registerSupportRoutes(app, db, config);
  registerRequestRoutes(app, db, config);
  registerResponseRoutes(app, db, config);
  registerPrivacyRoutes(app, db, config);
  registerContentRoutes(app, db);

  app.get("/", (context) => context.redirect(`/${localeFromRequest(getCookie(context, "locale"), context.req.header("Accept-Language"))}`));

  app.get("/:locale", (context) => {
    const locale = publicLocale(context.req.param("locale"));
    if (!locale) return context.notFound();
    rememberLocale(context, locale, config);
    const demands = demandRows(db, locale);
    const counts = {
      supporters: Number(db.prepare("SELECT count(*) AS count FROM supporters WHERE email_verified_at IS NOT NULL AND deleted_at IS NULL").get()?.count ?? 0),
      generated: Number(db.prepare("SELECT count(*) AS count FROM generated_requests").get()?.count ?? 0),
      sent: Number(db.prepare("SELECT count(*) AS count FROM request_actions WHERE action_type = 'reported_sent'").get()?.count ?? 0),
      responses: Number(db.prepare("SELECT count(*) AS count FROM submitted_responses").get()?.count ?? 0)
    };
    publicCache(context);
    return context.html(<Layout locale={locale} title={t(locale, "homeTitle")} path={context.req.path}>
      <nav class="scripts" aria-label={t(locale, "language")}>
        {locales.map((option) => <a href={`/${option}?lang=1`} hrefLang={option} lang={option} dir={dirOf(option)}
          aria-current={option === locale ? "true" : undefined}>{localeNames[option]}</a>)}
      </nav>
      <p class="eyebrow">{t(locale, "slogan")}</p>
      <h1 id="home-heading">{t(locale, "homeTitle")}</h1>
      <p class="lede">{t(locale, "subtitle")}</p>
      <p><a role="button" class="cta" href={`/${locale}/support`}>{t(locale, "cta")}</a></p>
      <p class="neutrality" role="note">{t(locale, "neutrality")}</p>

      <ul class="metrics" aria-label={t(locale, "supporters")}>
        {counts.supporters > 0 ? <li><strong>{counts.supporters}</strong><span>{t(locale, "supporters")}</span></li> : null}
        {counts.generated > 0 ? <li><strong>{counts.generated}</strong><span>{t(locale, "generated")}</span></li> : null}
        {counts.sent > 0 ? <li><strong>{counts.sent}</strong><span>{t(locale, "sent")}</span></li> : null}
        {counts.responses > 0 ? <li><strong>{counts.responses}</strong><span>{t(locale, "responses")}</span></li> : null}
      </ul>

      <p>{t(locale, "problem")}</p>
      <p>{t(locale, "solution")}</p>

      {/* The three actions in the order a supporter performs them, always numbered the same way. */}
      <h2 class="section-label">{t(locale, "howItWorks")}</h2>
      <ol class="journey">
        <li><a href={`/${locale}/support`}><strong>{t(locale, "navSupport")}</strong><span>{t(locale, "journeySupport")}</span></a></li>
        <li><a href={`/${locale}/request`}><strong>{t(locale, "navRequest")}</strong><span>{t(locale, "journeyRequest")}</span></a></li>
        <li><a href={`/${locale}/responses/new`}><strong>{t(locale, "navResponse")}</strong><span>{t(locale, "journeyResponse")}</span></a></li>
      </ol>

      <h2 class="section-label">{t(locale, "documentsTitle")}</h2>
      <ul class="documents">
        <li><a href={`/${locale}/standard`}><strong>{t(locale, "standardTitle")}</strong><span>{t(locale, "standardLede")}</span></a></li>
        <li><a href={`/${locale}/coalition-agreement`}><strong>{t(locale, "coalitionTitle")}</strong><span>{t(locale, "coalitionLede")}</span></a></li>
        <li><a href={`/${locale}/first-100-days`}><strong>{t(locale, "planTitle")}</strong><span>{t(locale, "planLede")}</span></a></li>
        <li><a href={`/${locale}/government-model`}><strong>{t(locale, "modelTitle")}</strong><span>{t(locale, "modelLede")}</span></a></li>
      </ul>

      <h2 class="section-label">{t(locale, "standardTitle")}</h2>
      {demandList(locale, demands)}
      <p><a href={`/${locale}/standard`}>{t(locale, "readFull")}</a></p>
    </Layout>);
  });
}

function demandRows(db: Db, locale: Locale) {
  return db.prepare(`SELECT d.id, dt.title, dt.body FROM demands d
    JOIN campaigns c ON c.id = d.campaign_id
    LEFT JOIN demand_translations dt ON dt.demand_id = d.id AND dt.locale = ?
    WHERE c.status = 'active' AND d.is_active = 1 AND d.document = 'standard' ORDER BY d.sort_order`).all(locale) as Demand[];
}

function demandList(locale: Locale, demands: Demand[], full = false) {
  if (!demands.length) return <p role="status">{t(locale, "unavailable")}</p>;
  return <ol>{demands.map((demand) => <li>
    {demand.title ? <><strong>{demand.title}</strong>{full && demand.body ? <div dangerouslySetInnerHTML={{ __html: markdown(demand.body) }} /> : null}</> : <span role="status">{t(locale, "unavailable")}</span>}
  </li>)}</ol>;
}

function publicLocale(value: string) {
  return isLocale(value) ? value : undefined;
}

function rememberLocale(context: any, locale: Locale, config: Config) {
  if (context.req.query("lang") === "1") {
    setCookie(context, "locale", locale, { httpOnly: true, secure: config.nodeEnv === "production", sameSite: "Lax", maxAge: 31_536_000, path: "/" });
    context.header("Cache-Control", "private, no-store");
  }
}

function publicCache(context: any) {
  if (!context.res.headers.has("Cache-Control")) context.header("Cache-Control", "public, max-age=0, s-maxage=60");
}
