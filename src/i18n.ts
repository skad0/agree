import am from "./locales/am.json" with { type: "json" };
import ar from "./locales/ar.json" with { type: "json" };
import en from "./locales/en.json" with { type: "json" };
import he from "./locales/he.json" with { type: "json" };
import ru from "./locales/ru.json" with { type: "json" };
import yi from "./locales/yi.json" with { type: "json" };

export const locales = ["he", "ar", "yi", "ru", "en", "am"] as const;
export type Locale = (typeof locales)[number];
export const rtlLocales: readonly Locale[] = ["he", "ar", "yi"];

/** Endonyms. A reader must be able to find their language without knowing its ISO code. */
export const localeNames: Record<Locale, string> = {
  he: "עברית", ar: "العربية", yi: "ייִדיש", ru: "Русский", en: "English", am: "አማርኛ"
};

export function dirOf(locale: Locale) { return rtlLocales.includes(locale) ? "rtl" : "ltr"; }

const dictionaries: Record<Locale, Record<string, string>> = { am, ar, en, he, ru, yi };

export function isLocale(value: string): value is Locale {
  return locales.includes(value as Locale);
}

export function t(locale: Locale, key: string) {
  return dictionaries[locale][key] ?? `[translation unavailable: ${key}]`;
}

export function localeFromRequest(cookie: string | undefined, acceptLanguage: string | undefined): Locale {
  if (cookie && isLocale(cookie)) return cookie;
  const requested = acceptLanguage?.split(",").map((part) => part.trim().split(";")[0]?.split("-")[0]).find((part) => part && isLocale(part));
  return requested && isLocale(requested) ? requested : "en";
}

