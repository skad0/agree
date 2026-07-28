import type { Child } from "hono/jsx";
import { cssPath, jsPath, themePath } from "./assets.js";
import { dirOf, localeNames, locales, t, type Locale } from "./i18n.js";

export function Layout({ locale, title, path, languageQuery = "", children }: { locale: Locale; title: string; path: string; languageQuery?: string; children: Child }) {
  const suffix = path.replace(/^\/(?:he|ar|yi|ru|en|am)/, "") || "";
  const query = languageQuery ? `&${languageQuery}` : "";
  return <html lang={locale} dir={dirOf(locale)}>
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      <meta name="color-scheme" content="light dark" />
      <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
      <meta name="theme-color" content="#0f1826" media="(prefers-color-scheme: dark)" />
      <title>{title} · {t(locale, "siteName")}</title>
      {/* Not deferred and not inlined: it must run before first paint to avoid a flash of the
          wrong theme, and script-src has no 'unsafe-inline'. */}
      <script src={themePath}></script>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css" />
      <link rel="stylesheet" href={cssPath} />
      <script src={jsPath} defer></script>
    </head>
    <body>
      <a class="skip-link" href="#content">{t(locale, "skip")}</a>
      <header class="wrap">
        <a class="wordmark" href={`/${locale}`}>{t(locale, "siteName")}</a>
        {/* Two tiers on purpose: what you can read, and what you can do. The three actions keep
            the same order and the same words everywhere, so the sequence can be memorised. */}
        <nav class="primary" aria-label={t(locale, "documentsTitle")}>
          <a href={`/${locale}/standard`}>{t(locale, "navStandard")}</a>
          <a href={`/${locale}/first-100-days`}>{t(locale, "navPlan")}</a>
          <a href={`/${locale}/government-model`}>{t(locale, "navModel")}</a>
          <a href={`/${locale}/about`}>{t(locale, "navAbout")}</a>
        </nav>
        <details class="languages">
          <summary><span class="label">{t(locale, "language")}</span> <span lang={locale}>{localeNames[locale]}</span></summary>
          <ul>{locales.map((option) => <li>
            <a href={`/${option}${suffix}${suffix.includes("?") ? "&" : "?"}lang=1${query}`} hrefLang={option} lang={option} dir={dirOf(option)}
              aria-current={option === locale ? "true" : undefined}>{localeNames[option]}</a>
          </li>)}</ul>
        </details>
      </header>
      <nav class="actions-bar wrap" aria-label={t(locale, "howItWorks")}>
        <a href={`/${locale}/support`}><b>1</b>{t(locale, "navSupport")}</a>
        <a href={`/${locale}/request`}><b>2</b>{t(locale, "navRequest")}</a>
        <a href={`/${locale}/responses/new`}><b>3</b>{t(locale, "navResponse")}</a>
      </nav>
      <main id="content" class="wrap" aria-live="polite">{children}</main>
      <footer class="wrap">
        <a href={`/${locale}/coalition-agreement`}>{t(locale, "navCoalition")}</a>
        <a href={`/${locale}/methodology`}>{t(locale, "navMethodology")}</a>
        <a href={`/${locale}/privacy`}>{t(locale, "navPrivacy")}</a>
        <div class="appearance">
          <span>{t(locale, "appearance")}</span>
          <button type="button" data-theme-set="light" aria-pressed="false">{t(locale, "appearanceLight")}</button>
          <button type="button" data-theme-set="dark" aria-pressed="false">{t(locale, "appearanceDark")}</button>
          <button type="button" data-theme-set="system" aria-pressed="true">{t(locale, "appearanceSystem")}</button>
        </div>
      </footer>
    </body>
  </html>;
}
