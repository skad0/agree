import { marked } from "marked";
import type { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import type { Config } from "./config.js";
import type { Db } from "./db.js";
import { isLocale, localeFromRequest, t, type Locale } from "./i18n.js";
import { Layout } from "./layout.js";
import { registerRequestRoutes } from "./requests.js";
import { registerResponseRoutes } from "./responses.js";
import { registerPrivacyRoutes } from "./privacy.js";
import { registerSupportRoutes } from "./support.js";

type Demand = { id: number; title: string | null; body: string | null };

export function registerPublicRoutes(app: Hono, db: Db, config: Config) {
  app.get("/assets/app.css", (context) => {
    context.header("Content-Type", "text/css; charset=utf-8");
    context.header("Cache-Control", "public, max-age=86400");
    return context.body(CSS);
  });
  app.get("/assets/app.js", (context) => {
    context.header("Content-Type", "text/javascript; charset=utf-8");
    context.header("Cache-Control", "public, max-age=86400");
    return context.body("document.addEventListener('click',async e=>{const id=e.target?.dataset?.copy;if(id){await navigator.clipboard.writeText(document.getElementById(id).value);}});");
  });

  registerSupportRoutes(app, db, config);
  registerRequestRoutes(app, db, config);
  registerResponseRoutes(app, db, config);
  registerPrivacyRoutes(app, db, config);

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
      <h1>{t(locale, "homeTitle")}</h1>
      <p>{t(locale, "problem")}</p>
      <p>{t(locale, "solution")}</p>
      <section class="metrics" aria-label={t(locale, "siteName")}>
        <p><strong>{counts.supporters}</strong><span>{t(locale, "supporters")}</span></p>
        <p><strong>{counts.generated}</strong><span>{t(locale, "generated")}</span></p>
        <p><strong>{counts.sent}</strong><span>{t(locale, "sent")}</span></p>
        <p><strong>{counts.responses}</strong><span>{t(locale, "responses")}</span></p>
      </section>
      <section><h2>{t(locale, "demandsTitle")}</h2>{demandList(locale, demands)}</section>
      <p><a role="button" href={`/${locale}/support`}>{t(locale, "cta")}</a></p>
    </Layout>);
  });

  app.get("/:locale/demands", (context) => {
    const locale = publicLocale(context.req.param("locale"));
    if (!locale) return context.notFound();
    rememberLocale(context, locale, config);
    publicCache(context);
    return context.html(<Layout locale={locale} title={t(locale, "demandsTitle")} path={context.req.path}>
      <h1>{t(locale, "demandsTitle")}</h1>
      {demandList(locale, demandRows(db, locale), true)}
    </Layout>);
  });
}

function demandRows(db: Db, locale: Locale) {
  return db.prepare(`SELECT d.id, dt.title, dt.body FROM demands d
    JOIN campaigns c ON c.id = d.campaign_id
    LEFT JOIN demand_translations dt ON dt.demand_id = d.id AND dt.locale = ?
    WHERE c.status = 'active' AND d.is_active = 1 ORDER BY d.sort_order`).all(locale) as Demand[];
}

function demandList(locale: Locale, demands: Demand[], full = false) {
  if (!demands.length) return <p role="status">{t(locale, "unavailable")}</p>;
  return <ol>{demands.map((demand) => <li>
    {demand.title ? <><strong>{demand.title}</strong>{full && demand.body ? <div dangerouslySetInnerHTML={{ __html: markdown(demand.body) }} /> : null}</> : <span role="status">{t(locale, "unavailable")}</span>}
  </li>)}</ol>;
}

marked.use({ walkTokens(token) {
  if ((token.type === "link" || token.type === "image") && !/^(https?:|mailto:|\/(?!\/)|#)/i.test(token.href ?? "")) token.href = "#";
} });

function markdown(value: string) {
  const escaped = value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return String(marked.parse(escaped));
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

const CSS = `
body { overflow-wrap: anywhere; }
.skip-link { position: absolute; inset-inline-start: -9999px; }
.skip-link:focus { inset-inline-start: 1rem; inset-block-start: 1rem; z-index: 2; background: var(--pico-background-color); padding: .5rem; }
header nav { flex-wrap: wrap; }
header nav ul { flex-wrap: wrap; }
.languages { max-inline-size: 12rem; margin-block-end: 1rem; }
.languages ul { display: grid; grid-template-columns: repeat(3, 1fr); }
.metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr)); gap: 1rem; margin-block: 2rem; }
.metrics p { border-inline-start: .25rem solid var(--pico-primary); padding-inline-start: .75rem; }
.metrics strong, .metrics span { display: block; }
bdi, [dir=ltr] { unicode-bidi: isolate; }
@media (max-width: 600px) { header nav { display: block; } header nav ul { padding-inline-start: 0; } }
`;
