import type { Hono } from "hono";
import type { Config } from "./config.js";
import type { Db } from "./db.js";
import { isLocale } from "./i18n.js";
import { Layout } from "./layout.js";
import { s } from "./share-copy.js";
import { pc } from "./positions-copy.js";
import { positions2026 } from "./data/positions-2026.js";
import { PositionsByList, PositionsByQuestion, PositionsMatrix, StanceLegend, ViewSwitch, type PositionsView } from "./components/positions-ui.js";
import { formatIsraeliDate } from "./components/scorecard-ui.js";
import { privateNoStore, publicCache, publicCampaignActive, rememberLocale } from "./public-state.js";
import { unavailable } from "./share-pages.js";
import { t } from "./i18n.js";
import { shareImagePath } from "./share-images.js";
import { isIssueSlug } from "./types/positions.js";
import type { PartyId } from "./types/scorecard.js";

export function registerPositionsRoutes(app: Hono, db: Db, config: Config) {
  app.get("/:locale/positions", (context) => {
    const locale = context.req.param("locale") ?? "";
    if (!isLocale(locale)) return context.notFound();
    rememberLocale(context, locale, config);
    if (!publicCampaignActive(db)) return unavailable(context, locale, t(locale, "formDisabled"), 503);

    // Unknown values fall back to the default view rather than erroring: these are shared links.
    const listParam = context.req.query("list") ?? "";
    const openList = (positions2026.tracked as string[]).includes(listParam) ? listParam as PartyId : undefined;
    const questionParam = context.req.query("q") ?? "";
    const openQuestion = isIssueSlug(questionParam) ? questionParam : undefined;
    const view: PositionsView = context.req.query("view") === "list" || openList ? "list" : "question";

    if (context.req.url.includes("?")) {
      privateNoStore(context);
      context.header("X-Robots-Tag", "noindex");
    } else {
      publicCache(context);
    }
    const url = `${config.appBaseUrl}/${locale}/positions`;
    const query = view === "list" ? "view=list" : "";
    return context.html(
      <Layout
        locale={locale}
        title={pc(locale, "title")}
        path={context.req.path}
        mainClass="scorecard-wide"
        languageQuery={query}
        shareMeta={{ url, description: pc(locale, "lede"), image: `${config.appBaseUrl}${shareImagePath(locale)}`, imageAlt: pc(locale, "title") }}
      >
        {/* Reading order on a phone: what this is, how to browse, the cue to tap, then the content itself. */}
        <section class="positions-intro">
          <p class="eyebrow">{pc(locale, "asOf")} <bdi dir="ltr">{formatIsraeliDate(positions2026.asOf)}</bdi></p>
          <h1>{pc(locale, "title")}</h1>
          <p class="lede">{pc(locale, "lede")}</p>
        </section>
        <ViewSwitch locale={locale} view={view} />
        <p class="positions-hint">{pc(locale, view === "question" ? "foldHintQuestion" : "foldHintList")}</p>
        <StanceLegend locale={locale} />
        <p class="positions-not-scored">{pc(locale, "notScored")}</p>
        {view === "question" ? <>
          <PositionsMatrix locale={locale} dataset={positions2026} />
          <PositionsByQuestion locale={locale} dataset={positions2026} open={openQuestion} />
          <p class="positions-note">{pc(locale, "otherNote")}</p>
        </> : <PositionsByList locale={locale} dataset={positions2026} open={openList} />}
        <p class="positions-note">{pc(locale, "method")} {pc(locale, "notReviewed")}</p>
        <p><a href={`/${locale}`}>{s(locale, "all")}</a></p>
        <p class="neutrality">{s(locale, "neutrality")}</p>
      </Layout>
    );
  });
}
