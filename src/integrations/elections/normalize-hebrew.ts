export const ALGORITHM_VERSION = "1";

const HEBREW_MARKS = /[\u0591-\u05BD\u05BF\u05C1-\u05C2\u05C4-\u05C5\u05C7]/g;
const BIDI_AND_INVISIBLE = /[\u00AD\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;
const APOSTROPHE_VARIANTS = /[\u05F3\u2018\u2019\u2032\uFF07]/g;
const QUOTE_VARIANTS = /[\u05F4\u201C\u201D\u2033\uFF02]/g;
const DASH_VARIANTS = /[\u05BE\u2010-\u2015\u2212]/g;
const WHITESPACE = /\s+/g;

export function normalizeHebrew(value: string): string {
  const decomposed = value.normalize("NFKC").normalize("NFD");
  return decomposed
    .replace(/\p{M}+/gu, "")
    .replace(HEBREW_MARKS, "")
    .replace(BIDI_AND_INVISIBLE, "")
    .replace(APOSTROPHE_VARIANTS, "'")
    .replace(QUOTE_VARIANTS, '"')
    .replace(DASH_VARIANTS, "-")
    .replace(WHITESPACE, " ")
    .trim();
}
