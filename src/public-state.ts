import { setCookie } from "hono/cookie";
import type { Config } from "./config.js";
import type { Db } from "./db.js";
import type { Locale } from "./i18n.js";

export function rememberLocale(context: any, locale: Locale, config: Config) {
  if (context.req.query("lang") === "1") {
    setCookie(context, "locale", locale, { httpOnly: true, secure: config.nodeEnv === "production", sameSite: "Lax", maxAge: 31_536_000, path: "/" });
    context.header("Cache-Control", "private, no-store");
  }
}

export function publicCache(context: any) {
  if (!context.res.headers.has("Cache-Control")) context.header("Cache-Control", "public, max-age=0, s-maxage=60");
}

export function privateNoStore(context: any) {
  context.header("Cache-Control", "private, no-store");
}

export function publicCampaignActive(db: Db) {
  return db.prepare("SELECT 1 FROM campaigns WHERE status = 'active' LIMIT 1").get() !== undefined;
}

export function publicRequestsEnabled(db: Db) {
  return db.prepare("SELECT 1 FROM campaigns WHERE status = 'active' AND requests_enabled = 1 LIMIT 1").get() !== undefined;
}
