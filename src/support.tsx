import { createHash, randomBytes } from "node:crypto";
import type { Hono } from "hono";
import type { Config } from "./config.js";
import type { Db } from "./db.js";
import { sendEmail } from "./email.js";
import { isLocale, t, type Locale } from "./i18n.js";
import { Layout } from "./layout.js";
import { createRateLimiter, issueCsrf, text, Turnstile, validCsrf, validTurnstile } from "./security.js";

export function registerSupportRoutes(app: Hono, db: Db, config: Config) {
  const rateLimit = createRateLimiter();

  app.get("/:locale/support", (context) => {
    const locale = localeParam(context.req.param("locale"));
    if (!locale) return context.notFound();
    if (!campaignEnabled(db, "support_enabled")) return page(context, locale, t(locale, "formDisabled"), config);
    const csrf = issueCsrf(context, config);
    context.header("Cache-Control", "private, no-store");
    return context.html(<Layout locale={locale} title={t(locale, "supportTitle")} path={context.req.path}>
      <h1>{t(locale, "supportTitle")}</h1>
      <form method="post">
        <input type="hidden" name="csrf" value={csrf} />
        <label>{t(locale, "email")}<input name="email" type="email" required autoComplete="email" maxLength={254} /></label>
        <label>{t(locale, "name")}<input name="name" autoComplete="name" maxLength={100} /></label>
        <label>{t(locale, "city")}<input name="city" autoComplete="address-level2" maxLength={100} /></label>
        <label><input name="publicName" type="checkbox" value="yes" /> {t(locale, "publicName")}</label>
        <label><input name="consent" type="checkbox" value="yes" required /> {t(locale, "consent")}</label>
        <Turnstile config={config} />
        <button type="submit">{t(locale, "submit")}</button>
      </form>
    </Layout>);
  });

  app.post("/:locale/support", async (context) => {
    const locale = localeParam(context.req.param("locale"));
    if (!locale) return context.notFound();
    if (!campaignEnabled(db, "support_enabled")) return page(context, locale, t(locale, "formDisabled"), config, 503);
    const body = await context.req.parseBody({ all: true });
    if (!rateLimit(context, "support", config.rateLimitSupport, 900)) return page(context, locale, "Too many requests", config, 429);
    if (!validCsrf(context, config, body)) return page(context, locale, t(locale, "invalidForm"), config, 403);
    if (!await validTurnstile(context, config, body)) return page(context, locale, t(locale, "invalidForm"), config, 400);
    const email = normalizeEmail(text(body.email));
    if (!validEmail(email) || text(body.consent) !== "yes") return page(context, locale, t(locale, "invalidForm"), config, 422);

    const now = new Date().toISOString();
    db.prepare(`INSERT INTO supporters (email_normalized, name, city, locale, public_name_allowed, privacy_consent_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(email_normalized) DO UPDATE SET name = excluded.name, city = excluded.city, locale = excluded.locale,
        public_name_allowed = excluded.public_name_allowed, privacy_consent_at = excluded.privacy_consent_at`).run(
      email, limited(body.name, 100), limited(body.city, 100), locale, text(body.publicName) === "yes" ? 1 : 0, now, now
    );
    const supporter = db.prepare("SELECT id, email_verified_at FROM supporters WHERE email_normalized = ?").get(email) as { id: number; email_verified_at: string | null };
    if (supporter.email_verified_at) return page(context, locale, t(locale, "verificationSent"), config);
    const token = randomBytes(32).toString("base64url");
    db.prepare("INSERT INTO email_verifications (supporter_id, token_hash, expires_at) VALUES (?, ?, ?)").run(
      supporter.id, tokenHash(token), new Date(Date.now() + 86_400_000).toISOString()
    );
    const link = `${config.appBaseUrl}/verify-email?token=${token}&locale=${locale}`;
    const safeLink = link.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
    const sent = await sendEmail(config, email, "Verify your civic campaign support", `<p><a href="${safeLink}">Verify your support</a></p>`);
    const developmentLink = !sent && config.nodeEnv !== "production" ? <p><a href={link}>Development verification link</a></p> : null;
    return context.html(<Layout locale={locale} title={t(locale, "verifyTitle")} path={`/${locale}/support`}>
      <h1>{t(locale, "verifyTitle")}</h1><p role="status">{t(locale, sent ? "verificationSent" : "verificationUnavailable")}</p>{developmentLink}
    </Layout>, sent || developmentLink ? 200 : 503);
  });

  app.get("/verify-email", (context) => {
    const locale = localeParam(context.req.query("locale") ?? "en") ?? "en";
    const token = context.req.query("token") ?? "";
    const csrf = issueCsrf(context, config);
    context.header("Cache-Control", "private, no-store");
    return context.html(<Layout locale={locale} title={t(locale, "verifyTitle")} path={`/${locale}`}>
      <h1>{t(locale, "verifyTitle")}</h1>
      <form method="post" action="/verify-email">
        <input type="hidden" name="csrf" value={csrf} /><input type="hidden" name="token" value={token} /><input type="hidden" name="locale" value={locale} />
        <Turnstile config={config} /><button type="submit">{t(locale, "verifyButton")}</button>
      </form>
    </Layout>);
  });

  app.post("/verify-email", async (context) => {
    const body = await context.req.parseBody();
    const locale = localeParam(text(body.locale)) ?? "en";
    if (!rateLimit(context, "verify", config.rateLimitVerify, 3600)) return page(context, locale, "Too many requests", config, 429);
    if (!validCsrf(context, config, body) || !await validTurnstile(context, config, body)) return page(context, locale, t(locale, "invalidForm"), config, 403);
    const now = new Date().toISOString();
    const verification = db.prepare(`SELECT ev.id, ev.supporter_id FROM email_verifications ev
      WHERE ev.token_hash = ? AND ev.used_at IS NULL AND ev.expires_at > ?`).get(tokenHash(text(body.token)), now) as { id: number; supporter_id: number } | undefined;
    if (!verification) return page(context, locale, t(locale, "invalidToken"), config, 400);
    db.exec("BEGIN IMMEDIATE");
    try {
      db.prepare("UPDATE supporters SET email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?").run(now, verification.supporter_id);
      db.prepare("UPDATE email_verifications SET used_at = ? WHERE id = ?").run(now, verification.id);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    return page(context, locale, t(locale, "verified"), config);
  });
}

function page(context: any, locale: Locale, message: string, _config: Config, status = 200) {
  context.header("Cache-Control", "private, no-store");
  return context.html(<Layout locale={locale} title={t(locale, "siteName")} path={`/${locale}`}><p role="status">{message}</p></Layout>, status);
}

function campaignEnabled(db: Db, column: "support_enabled") {
  return db.prepare(`SELECT ${column} AS enabled FROM campaigns WHERE status = 'active' LIMIT 1`).get()?.enabled === 1;
}

function localeParam(value: string) { return isLocale(value) ? value : undefined; }
function normalizeEmail(value: string) { return value.trim().toLowerCase(); }
function validEmail(value: string) { return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value); }
function limited(value: unknown, max: number) { const result = text(value); return result ? result.slice(0, max) : null; }
function tokenHash(token: string) { return createHash("sha256").update(token).digest("hex"); }
