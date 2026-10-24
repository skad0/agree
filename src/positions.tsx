import type { Hono } from "hono";
import type { Config } from "./config.js";
import type { Db } from "./db.js";
import { isLocale } from "./i18n.js";
import { Layout } from "./layout.js";
import { s } from "./share-copy.js";
import { pc } from "./positions-copy.js";
import { positions2026 } from "./data/positions-2026.js";
import { PositionsByList, PositionsByQuestion, PositionsMatrix, StanceLegend, ViewSwitch, entryShareCopy, recordById, type PositionsView } from "./components/positions-ui.js";
import { ShareOptions } from "./components/share-options.js";
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
    const entry = recordById(positions2026, context.req.query("entry") ?? "");
    const questionParam = context.req.query("q") ?? "";
    // A statement permalink opens its question; it wins over a bare ?q= in the same URL.
    const openQuestion = entry?.question ?? (isIssueSlug(questionParam) ? questionParam : undefined);
    const view: PositionsView = !entry && (context.req.query("view") === "list" || openList) ? "list" : "question";

    if (context.req.url.includes("?")) {
      privateNoStore(context);
      context.header("X-Robots-Tag", "noindex");
    } else {
      publicCache(context);
    }
    const url = `${config.appBaseUrl}/${locale}/positions`;
    const query = view === "list" ? "view=list" : entry ? `entry=${entry.id}` : "";
    // A shared statement previews as itself: list and question in the title, the paraphrase as the description.
    const entryCopy = entry ? entryShareCopy(locale, entry) : undefined;
    const shareMeta = {
      url: entry ? `${url}?entry=${entry.id}` : openQuestion ? `${url}?q=${openQuestion}` : url,
      title: entryCopy?.title,
      description: entryCopy?.text ?? pc(locale, "lede"),
      image: `${config.appBaseUrl}${shareImagePath(locale, openQuestion)}`,
      imageAlt: entryCopy?.title ?? pc(locale, "title")
    };
    return context.html(
      <Layout
        locale={locale}
        title={pc(locale, "title")}
        path={context.req.path}
        mainClass="scorecard-wide"
        languageQuery={query}
        shareMeta={shareMeta}
      >
        {/* Reading order on a phone: what this is, how to browse, the cue to tap, then the content itself. */}
        <section class="positions-intro">
          <p class="eyebrow">{pc(locale, "asOf")} <bdi dir="ltr">{formatIsraeliDate(positions2026.asOf)}</bdi></p>
          <h1>{pc(locale, "title")}</h1>
          <p class="lede">{pc(locale, "lede")}</p>
          <ShareOptions locale={locale} id="positions" title={pc(locale, "title")} text={pc(locale, "lede")} url={url} />
        </section>
        <ViewSwitch locale={locale} view={view} />
        <p class="positions-hint">{pc(locale, view === "question" ? "foldHintQuestion" : "foldHintList")}</p>
        <StanceLegend locale={locale} />
        <p class="positions-not-scored">{pc(locale, "notScored")}</p>
        {view === "question" ? <>
          <PositionsMatrix locale={locale} dataset={positions2026} />
          <PositionsByQuestion locale={locale} dataset={positions2026} open={openQuestion} baseUrl={config.appBaseUrl} />
          <p class="positions-note">{pc(locale, "otherNote")}</p>
        </> : <PositionsByList locale={locale} dataset={positions2026} open={openList} baseUrl={config.appBaseUrl} />}
        <p class="positions-note">{pc(locale, "method")} {pc(locale, "notReviewed")}</p>
        <p><a href={`/${locale}`}>{s(locale, "all")}</a></p>
        <p class="neutrality">{s(locale, "neutrality")}</p>
      </Layout>
    );
  });
}
