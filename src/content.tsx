import type { Hono } from "hono";
import type { Db } from "./db.js";
import { dirOf, isLocale, t, type Locale } from "./i18n.js";
import { Layout } from "./layout.js";
import { markdown } from "./markdown.js";

type Clause = { id: number; sortOrder: number; title: string | null; body: string | null; rationale: string | null; verification: string | null; exceptions: string | null };
type PlanItem = { id: number; dayFrom: number; dayTo: number; title: string | null; decision: string | null; instrument: string | null; owners: string | null; criterion: string | null };

const PLAN_HORIZON = 100;

export function registerContentRoutes(app: Hono, db: Db) {
  const page = (path: string, titleKey: string, ledeKey: string, render: (locale: Locale) => any) =>
    app.get(`/:locale/${path}`, (context) => {
      const locale = localeParam(context.req.param("locale"));
      if (!locale) return context.notFound();
      context.header("Cache-Control", "public, max-age=0, s-maxage=60");
      return context.html(<Layout locale={locale} title={t(locale, titleKey)} path={context.req.path}>
        <h1>{t(locale, titleKey)}</h1>
        <p class="lede">{t(locale, ledeKey)}</p>
        {render(locale)}
        <p class="neutrality" role="note">{t(locale, "neutrality")}</p>
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
    return locale ? context.redirect(`/${locale}/standard`, 301) : context.notFound();
  });
}

/**
 * One clause of a political document. The four fields always appear in the same order with the
 * same labels, so a reader who has seen one clause can skim every other one by position alone.
 */
function clauseList(locale: Locale, rows: Clause[]) {
  if (!rows.length) return <p role="status">{t(locale, "unavailable")}</p>;
  return <ol class="clauses">{rows.map((row) => <li class="clause" id={`clause-${row.sortOrder}`}>
    <span class="clause-number" aria-hidden="true">{String(row.sortOrder).padStart(2, "0")}</span>
    {row.title ? <>
      <h2>{row.title}</h2>
      {row.body ? <><p class="clause-label">{t(locale, "obligation")}</p><p class="clause-body">{row.body}</p></> : null}
      {row.rationale ? <aside class="callout why"><p class="clause-label">{t(locale, "rationale")}</p><p>{row.rationale}</p></aside> : null}
      {row.verification ? <aside class="callout how"><p class="clause-label">{t(locale, "verification")}</p>{splitList(row.verification)}</aside> : null}
      {row.exceptions ? <aside class="callout except"><p class="clause-label">{t(locale, "exceptions")}</p><p>{row.exceptions}</p></aside> : null}
    </> : <p role="status">{t(locale, "unavailable")}</p>}
  </li>)}</ol>;
}

/** The canonical text writes these as one semicolon-separated sentence; a list scans far faster. */
function splitList(value: string) {
  const parts = value.split(";").map((part) => part.trim().replace(/\.$/, "")).filter(Boolean);
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
    <ol class="timeline">{rows.map((row) => {
      const span = row.dayTo - row.dayFrom + 1;
      // SVG geometry rather than an inline style: the CSP has no 'unsafe-inline' in style-src,
      // so a style attribute would be dropped by the browser and every bar would be full width.
      // SVG mirrors nothing on its own either, so RTL is handled by flipping the offset here.
      const x = rtl ? PLAN_HORIZON - row.dayTo : row.dayFrom - 1;
      return <li class="plan-item" id={`plan-${row.id}`}>
      <p class="plan-days"><bdi dir="ltr"><strong>{row.dayFrom}–{row.dayTo}</strong></bdi> <span>{t(locale, "days")}</span></p>
      <svg class="plan-track" viewBox={`0 0 ${PLAN_HORIZON} 8`} preserveAspectRatio="none"
        role="img" aria-label={`${t(locale, "days")} ${row.dayFrom}–${row.dayTo}`}>
        {/* No rx: the viewBox is scaled non-uniformly, which would stretch a radius into a lens. */}
        <rect class="plan-track-bg" x="0" y="0" width={PLAN_HORIZON} height="8" />
        <rect class="plan-bar" x={x} y="0" width={span} height="8" />
      </svg>
      {row.title ? <>
        <h2>{row.title}</h2>
        <dl class="plan-fields">
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
    <ul class="constraints">
      <li><strong>18</strong><span>{t(locale, "maxMinisters")}</span></li>
      <li><strong>4</strong><span>{t(locale, "maxDeputies")}</span></li>
    </ul>
    {names.length
      ? <ol class="portfolios">{names.map((name, index) => <li>
          <span class="portfolio-number" aria-hidden="true">{index + 1}</span>
          {name ?? <span role="status">{t(locale, "unavailable")}</span>}
        </li>)}</ol>
      : <p role="status">{t(locale, "unavailable")}</p>}
  </>;
}

function prose(value: string) {
  return <div class="prose" dangerouslySetInnerHTML={{ __html: markdown(value) }} />;
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
