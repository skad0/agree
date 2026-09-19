import type { Hono } from "hono";
import { AMHARIC_BOLD, AMHARIC_REGULAR, CSS, JS, THEME_JS, amharicBoldPath, amharicRegularPath, cssPath, jsPath, themePath } from "./assets.js";
import { registerContentRoutes } from "./content.js";
import { getCookie } from "hono/cookie";
import type { Config } from "./config.js";
import type { Db } from "./db.js";
import { localeFromRequest } from "./i18n.js";
import { registerShareRoutes } from "./share-pages.js";
import { registerCandidateRoutes } from "./candidates.js";
import { shareImages } from "./share-images.js";
import { registerPrivacyRoutes } from "./privacy.js";
import { registerSupportRoutes } from "./support.js";

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

  registerShareRoutes(app, db, config);
  registerCandidateRoutes(app, db, config);
  registerSupportRoutes(app, db, config);
  for (const asset of shareImages) app.get(asset.path, context => {
    context.header("Content-Type", "image/png");
    context.header("Cache-Control", "public, max-age=31536000, immutable");
    return context.body(asset.body as any);
  });
  registerPrivacyRoutes(app, db, config);
  registerContentRoutes(app, db, config);

  app.get("/", (context) => context.redirect(`/${localeFromRequest(getCookie(context, "locale"), context.req.header("Accept-Language"))}`));

}
