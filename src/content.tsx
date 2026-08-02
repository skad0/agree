import type { Hono } from "hono";
import type { Db } from "./db.js";
import { dirOf, isLocale, t, type Locale } from "./i18n.js";
import { Layout } from "./layout.js";
import { markdown } from "./markdown.js";
import { AskPanel, DocumentIntro, DocumentSurface } from "./components/public-ui.js";
import type { Config } from "./config.js";
import { privateNoStore, publicCache, publicCampaignActive, publicRequestsEnabled, rememberLocale } from "./public-state.js";

type Clause = { id: number; sortOrder: number; title: string | null; body: string | null; rationale: string | null; verification: string | null; exceptions: string | null };
type PlanItem = { id: number; dayFrom: number; dayTo: number; title: string | null; decision: string | null; instrument: string | null; owners: string | null; criterion: string | null };

const PLAN_HORIZON = 100;

export function registerContentRoutes(app: Hono, db: Db, config: Config) {
  const page = (path: string, titleKey: string, ledeKey: string, render: (locale: Locale) => any) =>
    app.get(`/:locale/${path}`, (context) => {
      const locale = localeParam(context.req.param("locale"));
      if (!locale) return context.notFound();
      rememberLocale(context, locale, config);
      if (!publicCampaignActive(db)) return statusPage(context, locale, t(locale, "formDisabled"), 503);
      publicCache(context);
      return context.html(<Layout locale={locale} title={t(locale, titleKey)} path={context.req.path}>
        <DocumentIntro title={t(locale, titleKey)} lede={t(locale, ledeKey)} />
        {render(locale)}
        <p class="neutrality" role="note">{t(locale, "neutrality")}</p>
        {publicRequestsEnabled(db) ? <AskPanel locale={locale} /> : null}
      </Layout>);
    });

  page("standard", "standardTitle", "standardLede", (locale) => clauseList(locale, clauses(db, locale, "standard")));
  page("coalition-agreement", "coalitionTitle", "coalitionLede", (locale) => clauseList(locale, clauses(db, locale, "coalition")));
  page("first-100-days", "planTitle", "planLede", (locale) => timeline(locale, planItems(db, locale)));
  page("government-model", "modelTitle", "modelLede", (locale) => portfolioGrid(locale, portfolios(db, locale)));
  page("about", "aboutTitle", "slogan", (locale) => prose(t(locale, "aboutBody")));
  page("methodology", "methodologyTitle", "slogan", (locale) => prose(t(locale, "methodologyBody")));

  // The old placeholder route keeps working so existing links do not break.
  app.get("/:locale/demands", (context) => {
    const locale = localeParam(context.req.param("locale"));
    if (!locale) return context.notFound();
    rememberLocale(context, locale, config);
    return context.redirect(`/${locale}/standard`, 301);
  });
}

function statusPage(context: any, locale: Locale, message: string, status = 200) {
  privateNoStore(context);
  return context.html(<Layout locale={locale} title={t(locale, "siteName")} path={`/${locale}`}><div class="status-page"><h1>{t(locale, "siteName")}</h1><p role="status">{message}</p></div></Layout>, status);
}

/**
 * One clause of a political document. The four fields always appear in the same order with the
 * same labels, so a reader who has seen one clause can skim every other one by position alone.
 */
function clauseList(locale: Locale, rows: Clause[]) {
  if (!rows.length) return <p role="status">{t(locale, "unavailable")}</p>;
  return <ol class="document-clause-list">{rows.map((row) => <li class="document-clause" id={`clause-${row.sortOrder}`}>
    <span aria-hidden="true" dir="ltr"><span class="document-clause-number"><bdi>{String(row.sortOrder).padStart(2, "0")}</bdi></span></span>
    {row.title ? <>
      <h2>{row.title}</h2>
      {row.body ? <><p class="clause-label">{t(locale, "obligation")}</p><p class="clause-body">{row.body}</p></> : null}
      {row.rationale ? <div class="callout why"><p class="clause-label">{t(locale, "rationale")}</p><p>{row.rationale}</p></div> : null}
      {/* Ten clauses of legal text is unreadable as one scroll. What the clause asks for and why
          stay open; the reference detail collapses. <details> needs no JavaScript and is
          keyboard-operable, so this survives with scripting off. */}
      {row.verification || row.exceptions ? <details class="clause-detail">
        <summary>{[row.verification && t(locale, "verification"), row.exceptions && t(locale, "exceptions")].filter(Boolean).join(" · ")}</summary>
        {row.verification ? <div class="callout how"><p class="clause-label">{t(locale, "verification")}</p>{splitList(row.verification)}</div> : null}
        {row.exceptions ? <div class="callout except"><p class="clause-label">{t(locale, "exceptions")}</p><p>{row.exceptions}</p></div> : null}
      </details> : null}
    </> : <p role="status">{t(locale, "unavailable")}</p>}
  </li>)}</ol>;
}

/** The canonical text writes these as one semicolon-separated sentence; a list scans far faster. */
function splitList(value: string) {
  const parts = value.split(/[;؛፤]/u).map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? <ul>{parts.map((part) => <li>{part}</li>)}</ul> : <p>{value}</p>;
}

/**
 * Each row is a bar spanning its day range across a 100-day horizon. Offset and width use logical
 * properties, so the whole chart mirrors correctly in RTL without a second stylesheet.
 */
function timeline(locale: Locale, rows: PlanItem[]) {
  if (!rows.length) return <p role="status">{t(locale, "unavailable")}</p>;
  const rtl = dirOf(locale) === "rtl";
  return <>
    <ol class="document-stages">{rows.map((row) => {
      const span = row.dayTo - row.dayFrom + 1;
      // SVG geometry rather than an inline style: the CSP has no 'unsafe-inline' in style-src,
      // so a style attribute would be dropped by the browser and every bar would be full width.
      // SVG mirrors nothing on its own either, so RTL is handled by flipping the offset here.
      const x = rtl ? PLAN_HORIZON - row.dayTo : row.dayFrom - 1;
      return <li class="document-stage" id={`plan-${row.id}`}>
      <p class="stage-meta"><bdi dir="ltr" class="stage-days">{row.dayFrom}–{row.dayTo}</bdi> <span>{t(locale, "days")}</span></p>
      <svg class="plan-track stage-track" viewBox={`0 0 ${PLAN_HORIZON} 8`} preserveAspectRatio="none"
        role="img" aria-label={`${t(locale, "days")} ${row.dayFrom}–${row.dayTo}`}>
        {/* No rx: the viewBox is scaled non-uniformly, which would stretch a radius into a lens. */}
        <rect class="plan-track-bg" x="0" y="0" width={PLAN_HORIZON} height="8" />
        <rect class="plan-bar" x={x} y="0" width={span} height="8" />
      </svg>
      {row.title ? <>
        <h2>{row.title}</h2>
        <dl class="stage-fields">
          <dt>{t(locale, "decision")}</dt><dd>{row.decision}</dd>
          <dt>{t(locale, "instrument")}</dt><dd>{row.instrument}</dd>
          <dt>{t(locale, "owners")}</dt><dd>{row.owners}</dd>
          <dt>{t(locale, "criterion")}</dt><dd>{row.criterion}</dd>
        </dl>
      </> : <p role="status">{t(locale, "unavailable")}</p>}
    </li>;
    })}</ol>
  </>;
}

function portfolioGrid(locale: Locale, names: (string | null)[]) {
  return <>
    <ul class="document-constraints">
      <li><strong>18</strong><span>{t(locale, "maxMinisters")}</span></li>
      <li><strong>4</strong><span>{t(locale, "maxDeputies")}</span></li>
    </ul>
    {names.length
      ? <ol class="document-portfolios">{names.map((name, index) => <li>
          <span class="portfolio-number" aria-hidden="true" dir="ltr"><bdi dir="ltr">{index + 1}</bdi></span>
          {name ?? <span role="status">{t(locale, "unavailable")}</span>}
        </li>)}</ol>
      : <p role="status">{t(locale, "unavailable")}</p>}
  </>;
}

function prose(value: string) {
  const paragraphs = value.split("\n\n");
  const filtered: string[] = [];
  for (let index = 0; index < paragraphs.length; index += 1) {
    if (isUnresolvedFundingParagraph(paragraphs[index + 1] ?? "")) { index += 1; continue; }
    if (!isUnresolvedFundingParagraph(paragraphs[index]!)) filtered.push(paragraphs[index]!);
  }
  const html = markdown(filtered.join("\n\n")).replaceAll("<h3>", "<h2>").replaceAll("</h3>", "</h2>");
  return <DocumentSurface><div class="document-prose" dangerouslySetInnerHTML={{ __html: html }} /></DocumentSurface>;
}

const unresolvedFundingPlaceholders = new Set([
  "[personal funds / funds of a registered organisation / other]",
  "[מקורות עצמיים / אמצעי ארגון רשום / אחר]",
  "[موارد شخصية / موارد منظمة مسجلة / غير ذلك]",
  "[אייגענע מיטלען / מיטלען פֿון אַ רעגיסטרירטער אָרגאַניזאַציע / אַנדערש]",
  "[личными средствами / средствами зарегистрированной организации / иное]",
  "[особистими коштами / коштами зареєстрованої організації / інше]",
  "[የግል ገንዘብ / የተመዘገበ ድርጅት ገንዘብ / ሌላ]"
]);
function isUnresolvedFundingParagraph(value: string) {
  return [...unresolvedFundingPlaceholders].some((placeholder) => value.includes(placeholder));
}

function clauses(db: Db, locale: Locale, document: string) {
  return db.prepare(`SELECT d.id, d.sort_order AS sortOrder, dt.title, dt.body, dt.rationale, dt.verification, dt.exceptions
    FROM demands d JOIN campaigns c ON c.id = d.campaign_id
    LEFT JOIN demand_translations dt ON dt.demand_id = d.id AND dt.locale = ?
    WHERE c.status = 'active' AND d.is_active = 1 AND d.document = ? ORDER BY d.sort_order`).all(locale, document) as Clause[];
}
function planItems(db: Db, locale: Locale) {
  return db.prepare(`SELECT p.id, p.day_from AS dayFrom, p.day_to AS dayTo, pt.title, pt.decision, pt.instrument, pt.owners, pt.criterion
    FROM plan_items p LEFT JOIN plan_item_translations pt ON pt.plan_item_id = p.id AND pt.locale = ?
    WHERE p.is_active = 1 ORDER BY p.sort_order`).all(locale) as PlanItem[];
}
function portfolios(db: Db, locale: Locale) {
  return db.prepare(`SELECT pt.name FROM portfolios p
    LEFT JOIN portfolio_translations pt ON pt.portfolio_id = p.id AND pt.locale = ?
    WHERE p.is_active = 1 ORDER BY p.sort_order`).all(locale).map((row) => (row.name as string) ?? null);
}
function localeParam(value: string) { return isLocale(value) ? value : undefined; }
