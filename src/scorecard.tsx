import type { Hono } from "hono";
import type { Config } from "./config.js";
import type { Db } from "./db.js";
import { isLocale } from "./i18n.js";
import { Layout } from "./layout.js";
import { s } from "./share-copy.js";
import { sc } from "./scorecard-copy.js";
import { scorecard2026 } from "./data/scorecard-2026.js";
import {
  EvidenceDrawer,
  PledgeBanner,
  ScorecardFiltersForm,
  ScorecardIntro,
  ScorecardTable,
  filterParties,
  parseScorecardFilters,
  resolveEvidence,
  scorecardQuery
} from "./components/scorecard-ui.js";
import { privateNoStore, publicCache, publicCampaignActive, rememberLocale } from "./public-state.js";
import { unavailable } from "./share-pages.js";
import { dirOf, t } from "./i18n.js";
import { shareImagePath } from "./share-images.js";

export function registerScorecardRoutes(app: Hono, db: Db, config: Config) {
  app.get("/:locale/scorecard", (context) => {
    const locale = context.req.param("locale") ?? "";
    if (!isLocale(locale)) return context.notFound();
    rememberLocale(context, locale, config);
    if (!publicCampaignActive(db)) return unavailable(context, locale, t(locale, "formDisabled"), 503);

    const { filters, reset } = parseScorecardFilters({
      q: context.req.query("q"),
      block: context.req.query("block"),
      criterion: context.req.query("criterion"),
      status: context.req.query("status"),
      party: context.req.query("party"),
      evidence: context.req.query("evidence")
    });

    if (context.req.url.includes("?")) {
      privateNoStore(context);
      context.header("X-Robots-Tag", "noindex");
    } else {
      publicCache(context);
    }

    const parties = filterParties(scorecard2026, filters);
    const path = `/${locale}/scorecard`;
    const shareUrl = `${config.appBaseUrl}${path}`;
    const query = scorecardQuery({
      q: filters.q,
      block: filters.block,
      criterion: filters.criterion,
      status: filters.status
    });
    const evidence = resolveEvidence(scorecard2026, filters.party, filters.evidenceCriterion);
    const closeHref = query ? `${path}?${query}` : path;

    return context.html(
      <Layout
        locale={locale}
        title={sc(locale, "title")}
        path={context.req.path}
        languageHref={(next) => `/${next}/scorecard?lang=1${query ? `&${query}` : ""}`}
        shareMeta={{
          url: shareUrl,
          title: sc(locale, "ogDescription"),
          description: sc(locale, "lede"),
          image: `${config.appBaseUrl}${shareImagePath(locale)}`,
          imageAlt: sc(locale, "title")
        }}
      >
        <ScorecardIntro locale={locale} />
        <PledgeBanner locale={locale} shareUrl={shareUrl} />
        <ScorecardFiltersForm locale={locale} path={path} dataset={scorecard2026} filters={filters} />
        {reset ? <p role="status">{sc(locale, "filterReset")}</p> : null}
        <p role="status">
          {sc(locale, "results")}: {parties.length}
          {" · "}
          <bdi lang={locale} dir={dirOf(locale)}>{scorecard2026.electionLabel[locale]}</bdi>
        </p>
        {!parties.length ? <p>{sc(locale, "noResults")}</p> : (
          <ScorecardTable
            locale={locale}
            path={path}
            dataset={scorecard2026}
            parties={parties}
            filters={filters}
          />
        )}
        {evidence ? (
          <div id="evidence">
            <EvidenceDrawer
              locale={locale}
              party={evidence.party}
              criterion={evidence.criterion}
              records={evidence.records}
              closeHref={closeHref}
            />
          </div>
        ) : null}
        <p><a href={`/${locale}`}>{sc(locale, "backHome")}</a></p>
        <p class="neutrality">{s(locale, "neutrality")}</p>
      </Layout>
    );
  });
}
