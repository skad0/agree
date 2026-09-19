import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { locales, type Locale } from "./i18n.js";

export const shareImages = locales.map(locale => {
  const body = readFileSync(new URL(`./assets/share-${locale}.png`,import.meta.url));
  const hash = createHash("sha256").update(body).digest("hex").slice(0,12);
  return {locale,body,path:`/assets/share-${locale}-${hash}.png`};
});
export function shareImagePath(locale: Locale) { return shareImages.find(image => image.locale===locale)!.path; }
