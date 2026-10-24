import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { locales, type Locale } from "./i18n.js";
import { issueSlugs } from "./issues.js";

type ShareImage = { locale: Locale; slug?: string; body: Buffer; path: string };

function load(locale: Locale, name: string, slug?: string): ShareImage | undefined {
  const file = new URL(`./assets/${name}.png`, import.meta.url);
  if (!existsSync(file)) return undefined;
  const body = readFileSync(file);
  const hash = createHash("sha256").update(body).digest("hex").slice(0, 12);
  return { locale, slug, body, path: `/assets/${name}-${hash}.png` };
}

/** One generic card per locale, plus a card per question where `scripts/brand/generate.py` has produced one. */
export const shareImages: ShareImage[] = [
  ...locales.map((locale) => load(locale, `share-${locale}`)!),
  ...locales.flatMap((locale) => issueSlugs.flatMap((slug) => load(locale, `share-q-${slug}-${locale}`, slug) ?? []))
];

/** The question's own card when it exists, so a shared question previews as that question; otherwise the locale card. */
export function shareImagePath(locale: Locale, slug?: string): string {
  const own = slug ? shareImages.find((image) => image.locale === locale && image.slug === slug) : undefined;
  return (own ?? shareImages.find((image) => image.locale === locale && !image.slug)!).path;
}
