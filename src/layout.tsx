import { s } from "./share-copy.js";
import { sc } from "./scorecard-copy.js";
import type { Child } from "hono/jsx";
import { cssPath, jsPath, themePath } from "./assets.js";
import { identityPath } from "./identity-assets.js";
import { dirOf, localeNames, locales, t, type Locale } from "./i18n.js";

function scNav(locale: Locale) {
  return sc(locale, "nav");
}

/**
 * The document itself — head, assets, theme bootstrap — with no opinion about what goes in the
 * body. The public site and the admin console share the stylesheet and the theme script but not
 * the chrome: a supporter's wayfinding is the wrong furniture for someone editing the campaign.
 */
export type ShareMeta = { url: string; description: string; image?: string; imageAlt?: string; title?: string };

export function Shell({ locale, title, bodyClass, shareMeta, children }: { locale: Locale; title: string; bodyClass?: string; shareMeta?: ShareMeta; children: Child }) {
  const fullTitle = `${title} · ${t(locale, "siteName")}`;
  const socialTitle = shareMeta?.title ?? fullTitle;
  return <html lang={locale} dir={dirOf(locale)}>
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      <meta name="color-scheme" content="light dark" />
      <link rel="icon" href={identityPath("favicon.ico")} sizes="16x16 32x32 48x48" />
      <link rel="icon" href={identityPath("favicon.svg")} type="image/svg+xml" sizes="any" />
      <link rel="apple-touch-icon" href={identityPath("apple-touch-icon.png")} sizes="180x180" />
      <link rel="manifest" href={identityPath("manifest.json")} />
      <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />
      <meta name="theme-color" content="#0B1120" media="(prefers-color-scheme: dark)" />
      <title>{fullTitle}</title>
      {shareMeta ? <>
        <meta property="og:type" content="website" />
        <meta property="og:title" content={socialTitle} />
        <meta property="og:description" content={shareMeta.description} />
        <meta property="og:url" content={shareMeta.url} />
        <meta name="twitter:card" content={shareMeta.image ? "summary_large_image" : "summary"} />
        {shareMeta.image ? <>
          <meta property="og:image" content={shareMeta.image} /><meta property="og:image:width" content="1200" /><meta property="og:image:height" content="630" /><meta property="og:image:type" content="image/png" /><meta property="og:image:alt" content={shareMeta.imageAlt ?? title} />
          <meta name="twitter:image" content={shareMeta.image} /><meta name="twitter:image:alt" content={shareMeta.imageAlt ?? title} />
        </> : null}
        <meta name="twitter:title" content={socialTitle} />
        <meta name="twitter:description" content={shareMeta.description} />
        <link rel="canonical" href={shareMeta.url} />
        {locales.map(option => <link rel="alternate" hrefLang={option} href={shareMeta.url.replace(new RegExp(`/${locale}(?=/|$)`),`/${option}`)} />)}
      </> : null}
      {/* Not deferred and not inlined: it must run before first paint to avoid a flash of the
          wrong theme, and script-src has no 'unsafe-inline'. */}
      <script src={themePath}></script>
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css" />
      <link rel="stylesheet" href={cssPath} />
      <script src={jsPath} defer></script>
    </head>
    <body class={bodyClass}>{children}</body>
  </html>;
}

export function Layout({ locale, title, path, languageQuery = "", languageHref, shareMeta, mainClass, children }: { locale: Locale; title: string; path: string; languageQuery?: string; languageHref?: (locale: Locale) => string; shareMeta?: ShareMeta; mainClass?: string; children: Child }) {
  // Strip only a complete registered locale segment. Keeping this derived from `locales` means
  // newly registered locales (and paths such as /uk/...) retain their route when switching.
  const localePrefix = locales.find((option) => path === `/${option}` || path.startsWith(`/${option}/`) || path.startsWith(`/${option}?`));
  const suffix = localePrefix ? path.slice(localePrefix.length + 1) : path;
  const query = languageQuery ? `&${languageQuery}` : "";
  return <Shell locale={locale} title={title} bodyClass="public-site" shareMeta={shareMeta}>
      <a class="skip-link" href="#content">{t(locale, "skip")}</a>
      <div class="public-rule" aria-hidden="true"><span></span><span></span></div>
      <header class="wrap site-header">
        <a class="wordmark" href={`/${locale}`}><img src={identityPath("favicon.svg")} width="32" height="32" alt="" />{t(locale, "siteName")}</a>
        {/* The same three destinations appear in the same order on every public page. */}
        <nav class="primary" aria-label={s(locale,"problems")}>
          <a href={`/${locale}`} aria-current={suffix === "" ? "page" : suffix.startsWith("/issues/") ? "location" : undefined}>{s(locale,"problems")}</a>
          <a href={`/${locale}/candidates`} aria-current={suffix === "/candidates" ? "page" : undefined}>{s(locale,"candidates")}</a>
          <a href={`/${locale}/scorecard`} aria-current={suffix === "/scorecard" ? "page" : undefined}>{scNav(locale)}</a>
          <a href={`/${locale}/about`} aria-current={suffix === "/about" ? "page" : undefined}>{s(locale,"about")}</a>
        </nav>
        <details class="languages">
          <summary><span class="label">{t(locale, "language")}</span> <span lang={locale}>{localeNames[locale]}</span></summary>
          <ul>{locales.map((option) => <li>
            <a href={languageHref ? languageHref(option) : `/${option}${suffix}${suffix.includes("?") ? "&" : "?"}lang=1${query}`} hrefLang={option} lang={option} dir={dirOf(option)}
              aria-current={option === locale ? "true" : undefined}>{localeNames[option]}</a>
          </li>)}</ul>
        </details>
      </header>
      <main id="content" tabIndex={-1} class={mainClass ? `wrap ${mainClass}` : "wrap"}>{children}</main>
      <footer class="wrap">
        <a href={`/${locale}/standard`}>{t(locale,"navStandard")}</a>
        <a href={`/${locale}/first-100-days`}>{t(locale,"navPlan")}</a>
        <a href={`/${locale}/government-model`}>{t(locale,"navModel")}</a>
        <a href={`/${locale}/coalition-agreement`}>{t(locale, "navCoalition")}</a>
        <a href={`/${locale}/methodology`}>{t(locale, "navMethodology")}</a>
        <a href={`/${locale}/privacy`}>{t(locale, "navPrivacy")}</a>
        <AppearanceSwitcher locale={locale} />
      </footer>
  </Shell>;
}

/** The same three-button control the public footer carries, so the admin console honours the
    reader's stored light/dark choice instead of ignoring it. */
export function AppearanceSwitcher({ locale }: { locale: Locale }) {
  return <div class="appearance">
    <span>{t(locale, "appearance")}</span>
    <button type="button" data-theme-set="light" aria-pressed="false">{t(locale, "appearanceLight")}</button>
    <button type="button" data-theme-set="dark" aria-pressed="false">{t(locale, "appearanceDark")}</button>
    <button type="button" data-theme-set="system" aria-pressed="true">{t(locale, "appearanceSystem")}</button>
  </div>;
}
