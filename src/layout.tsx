import type { Child } from "hono/jsx";
import { locales, rtlLocales, t, type Locale } from "./i18n.js";

export function Layout({ locale, title, path, children }: { locale: Locale; title: string; path: string; children: Child }) {
  const suffix = path.replace(/^\/(?:he|ar|yi|ru|en|am)/, "") || "";
  return <html lang={locale} dir={rtlLocales.includes(locale) ? "rtl" : "ltr"}>
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{title} · {t(locale, "siteName")}</title>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css" />
      <link rel="stylesheet" href="/assets/app.css" />
      <script src="https://cdn.jsdelivr.net/npm/htmx.org@2/dist/htmx.min.js" defer></script>
      <script src="/assets/app.js" defer></script>
    </head>
    <body {...{ "hx-boost": "true" }}>
      <a class="skip-link" href="#content">{t(locale, "skip")}</a>
      <header class="container">
        <nav aria-label={t(locale, "siteName")}>
          <ul><li><a href={`/${locale}`}><strong>{t(locale, "siteName")}</strong></a></li></ul>
          <ul>
            <li><a href={`/${locale}/demands`}>{t(locale, "navDemands")}</a></li>
            <li><a href={`/${locale}/support`}>{t(locale, "navSupport")}</a></li>
            <li><a href={`/${locale}/request`}>{t(locale, "navRequest")}</a></li>
            <li><a href={`/${locale}/responses/new`}>{t(locale, "navResponse")}</a></li>
          </ul>
        </nav>
        <details class="languages">
          <summary>{t(locale, "language")}</summary>
          <ul>{locales.map((option) => <li><a href={`/${option}${suffix}?lang=1`} hrefLang={option}>{option.toUpperCase()}</a></li>)}</ul>
        </details>
      </header>
      <main id="content" class="container" aria-live="polite">{children}</main>
      <footer class="container"><a href={`/${locale}/privacy`}>{t(locale, "navPrivacy")}</a></footer>
    </body>
  </html>;
}
