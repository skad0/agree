import type { Hono } from "hono";
import type { Config } from "./config.js";
import type { Db } from "./db.js";
import { isLocale } from "./i18n.js";
import { Layout } from "./layout.js";
import { s } from "./share-copy.js";
import { pc } from "./positions-copy.js";
import { positions2026 } from "./data/positions-2026.js";
import { OtherCommitments, PositionsMatrix, QuestionKey, StanceLegend } from "./components/positions-ui.js";
import { formatIsraeliDate } from "./components/scorecard-ui.js";
import { publicCache, publicCampaignActive, rememberLocale } from "./public-state.js";
import { unavailable } from "./share-pages.js";
import { t } from "./i18n.js";
import { shareImagePath } from "./share-images.js";

export function registerPositionsRoutes(app: Hono, db: Db, config: Config) {
  app.get("/:locale/positions", (context) => {
    const locale = context.req.param("locale") ?? "";
    if (!isLocale(locale)) return context.notFound();
    rememberLocale(context, locale, config);
    if (!publicCampaignActive(db)) return unavailable(context, locale, t(locale, "formDisabled"), 503);
    publicCache(context);
    const url = `${config.appBaseUrl}/${locale}/positions`;
    return context.html(
      <Layout
        locale={locale}
        title={pc(locale, "title")}
        path={context.req.path}
        mainClass="scorecard-wide"
        shareMeta={{ url, description: pc(locale, "lede"), image: `${config.appBaseUrl}${shareImagePath(locale)}`, imageAlt: pc(locale, "title") }}
      >
        <section class="positions-intro">
          <p class="eyebrow">{pc(locale, "asOf")} <bdi dir="ltr">{formatIsraeliDate(positions2026.asOf)}</bdi></p>
          <h1>{pc(locale, "title")}</h1>
          <p class="lede">{pc(locale, "lede")}</p>
          <p class="positions-not-scored">{pc(locale, "notScored")}</p>
        </section>
        <div class="positions-guide">
          <StanceLegend locale={locale} />
          <QuestionKey locale={locale} />
        </div>
        <PositionsMatrix locale={locale} dataset={positions2026} />
        <p class="positions-note">{pc(locale, "method")} {pc(locale, "notReviewed")}</p>
        <OtherCommitments locale={locale} dataset={positions2026} />
        <p><a href={`/${locale}`}>{s(locale, "all")}</a></p>
        <p class="neutrality">{s(locale, "neutrality")}</p>
      </Layout>
    );
  });
}
