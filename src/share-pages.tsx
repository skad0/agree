import type { Hono } from "hono";
import type { Config } from "./config.js";
import type { Db } from "./db.js";
import { isLocale, locales, t, type Locale } from "./i18n.js";
import { Layout } from "./layout.js";
import { listIssues, type Issue } from "./issues.js";
import { s } from "./share-copy.js";
import { ShareOptions } from "./components/share-options.js";
import { privateNoStore, publicCache, publicCampaignActive, rememberLocale } from "./public-state.js";
import { shareImagePath } from "./share-images.js";

export function registerShareRoutes(app: Hono, db: Db, config: Config) {
  const issueUrl = (locale: Locale, issue: Issue) => `${config.appBaseUrl}/${locale}/issues/${issue.slug}`;
  const meta = (locale: Locale, url: string, description: string) => ({url,description,image:`${config.appBaseUrl}${shareImagePath(locale)}`,imageAlt:t(locale,"siteName")});
  const share = (locale: Locale, issue: Issue) => <ShareOptions locale={locale} id={issue.slug} title={issue.title} text={issue.rationale ?? issue.title} url={issueUrl(locale,issue)} />;

  app.get("/:locale", context => {
    const locale = context.req.param("locale") ?? ""; if (!isLocale(locale)) return context.notFound();
    rememberLocale(context,locale,config);
    if (!publicCampaignActive(db)) return unavailable(context,locale,t(locale,"formDisabled"),503);
    publicCache(context);
    return context.html(<Layout locale={locale} title={s(locale,"home")} path={context.req.path}
      shareMeta={meta(locale,`${config.appBaseUrl}/${locale}`,s(locale,"intro"))}>
      <section class="issue-intro"><p class="eyebrow">{t(locale,"slogan")}</p><h1>{s(locale,"home")}</h1><p class="lede">{s(locale,"intro")}</p><p class="neutrality">{s(locale,"neutrality")}</p></section>
      <ol class="issue-grid">{listIssues(db,locale).map(issue => <li class="issue-card">
        <span class="issue-number" aria-hidden="true">{String(issue.sortOrder).padStart(2,"0")}</span>
        <h2><a href={`/${locale}/issues/${issue.slug}`}>{issue.title}</a></h2>
        <p>{issue.rationale}</p>{share(locale,issue)}
      </li>)}</ol>
      <p><a href={`/${locale}/standard`}>{t(locale,"readFull")}</a></p>
    </Layout>);
  });

  app.get("/:locale/issues/:slug", context => {
    const locale = context.req.param("locale") ?? ""; if (!isLocale(locale)) return context.notFound();
    rememberLocale(context,locale,config);
    if (!publicCampaignActive(db)) return unavailable(context,locale,t(locale,"formDisabled"),503);
    const issue = listIssues(db,locale).find(row => row.slug === context.req.param("slug"));
    if (!issue) return unavailable(context,locale,t(locale,"unavailable"),404);
    publicCache(context);
    return context.html(<Layout locale={locale} title={issue.title} path={context.req.path}
      shareMeta={meta(locale,issueUrl(locale,issue),issue.rationale ?? issue.title)}>
      <article class="issue-detail">
        <a href={`/${locale}`}>{s(locale,"all")}</a>
        <h1>{issue.title}</h1><p class="lede">{issue.rationale}</p>
        <section class="commitment"><h2>{t(locale,"obligation")}</h2><p>{issue.body}</p></section>
        {share(locale,issue)}
        {issue.verification ? <details class="issue-explanation"><summary>{t(locale,"verification")}</summary><p>{issue.verification}</p></details> : null}
        {issue.exceptions ? <details class="issue-explanation"><summary>{t(locale,"exceptions")}</summary><p>{issue.exceptions}</p></details> : null}
        <p><a href={`/${locale}/standard#clause-${issue.sortOrder}`}>{t(locale,"readFull")}</a></p>
        <p class="neutrality">{s(locale,"neutrality")}</p>
      </article>
    </Layout>);
  });

  for (const path of ["/:locale/request", "/:locale/request/build"]) app.get(path, context => {
    const locale = context.req.param("locale") ?? ""; if (!isLocale(locale)) return context.notFound();
    privateNoStore(context);
    const demand = Number(context.req.query("demand"));
    const issue = listIssues(db,locale).find(row => row.id === demand);
    return context.redirect(issue ? `/${locale}/issues/${issue.slug}` : `/${locale}`,302);
  });
  for (const suffix of ["", "/selection", "/review", "/build", "/suggest", "/preview", "/action", "/copy", "/report-sent"]) {
    app.post(`/:locale/request${suffix}`, context => {
      const locale = context.req.param("locale") ?? ""; if (!isLocale(locale)) return context.notFound();
      privateNoStore(context);
      if (suffix === "/suggest") return context.json({error:{code:"RETIRED",message:s(locale,"retired")}},410);
      return unavailable(context,locale,s(locale,"retired"),410);
    });
  }
  for (const path of ["/:locale/responses", "/:locale/responses/new", "/:locale/responses/thanks", "/:locale/support"]) {
    app.all(path,context => {
      const locale = context.req.param("locale") ?? ""; if (!isLocale(locale)) return context.notFound();
      return unavailable(context,locale,path.endsWith("support") ? t(locale,"formDisabled") : s(locale,"paused"),503);
    });
  }
  app.get("/:locale/request/result", context => {
    const locale = context.req.param("locale") ?? ""; if (!isLocale(locale)) return context.notFound();
    privateNoStore(context); context.header("X-Robots-Tag","noindex");
    rememberLocale(context,locale,config);
    const id = context.req.query("request") ?? "";
    const row = /^[A-Za-z0-9_-]{43,64}$/.test(id) ? db.prepare(`SELECT g.selected_demands, COALESCE(rt.name,he.name) AS name,
      CASE WHEN rt.name IS NULL THEN 'he' ELSE ? END AS nameLocale
      FROM generated_requests g LEFT JOIN recipient_translations rt ON rt.recipient_id=g.recipient_id AND rt.locale=?
      LEFT JOIN recipient_translations he ON he.recipient_id=g.recipient_id AND he.locale='he' WHERE g.public_id=?`).get(locale,locale,id) as {selected_demands:string;name:string|null;nameLocale:string} | undefined : undefined;
    if (!row) return unavailable(context,locale,t(locale,"unavailable"),404);
    let ids: number[] = []; try { const parsed: unknown = JSON.parse(row.selected_demands); if (Array.isArray(parsed)) ids=parsed.filter(Number.isSafeInteger); } catch {}
    const issues = listIssues(db,locale).filter(issue => ids.includes(issue.id));
    return context.html(<Layout locale={locale} title={s(locale,"historical")} path={context.req.path} languageQuery={`request=${encodeURIComponent(id)}`}>
      <h1>{s(locale,"historical")}</h1><p><bdi lang={row.nameLocale} dir="auto">{row.name ?? t(locale,"unavailable")}</bdi></p>
      <ul>{issues.map(issue => <li><a href={`/${locale}/issues/${issue.slug}`}>{issue.title}</a></li>)}</ul>
      <a href={`/${locale}`}>{s(locale,"all")}</a>
    </Layout>);
  });
}

export function unavailable(context: any, locale: Locale, message: string, status: 404 | 410 | 503) {
  privateNoStore(context);
  return context.html(<Layout locale={locale} title={message} path={context.req.path}><div class="status-page"><h1>{message}</h1><p><a href={`/${locale}`}>{s(locale,"all")}</a></p><p><a href={`/${locale}/privacy`}>{t(locale,"navPrivacy")}</a></p></div></Layout>,status);
}
