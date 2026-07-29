import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const fingerprint = (value: string | Uint8Array) => createHash("sha256").update(value).digest("base64url").slice(0, 10);
const AMHARIC_REGULAR = readFileSync(new URL("./assets/NotoSansEthiopic-400.woff2", import.meta.url));
const AMHARIC_BOLD = readFileSync(new URL("./assets/NotoSansEthiopic-700.woff2", import.meta.url));
export { AMHARIC_REGULAR, AMHARIC_BOLD };
export const amharicRegularPath = `/assets/noto-sans-ethiopic-400-${fingerprint(AMHARIC_REGULAR)}.woff2`;
export const amharicBoldPath = `/assets/noto-sans-ethiopic-700-${fingerprint(AMHARIC_BOLD)}.woff2`;

/**
 * "Techelet" — the national blue and white. Two hues only: techelet carries every action,
 * link, counter and clause number; amber appears nowhere except the caveats, where a warning
 * colour is the accurate signal. Rank is expressed by scale and weight rather than by hue.
 * Noto Sans Ethiopic is scoped to the Amharic document so the other five scripts keep their
 * system-font rendering and the font bytes are only requested by pages that need them.
 * Pico is retuned through its own custom properties rather than by overriding its selectors.
 */
export const CSS = `
@font-face {
  font-family: "Noto Sans Ethiopic";
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url(${amharicRegularPath}) format("woff2");
  unicode-range: U+030E, U+1200-1399, U+2D80-2DDE, U+AB01-AB2E, U+1E7E0-1E7E6, U+1E7E8-1E7EB, U+1E7ED-1E7EE, U+1E7F0-1E7FE;
}
@font-face {
  font-family: "Noto Sans Ethiopic";
  font-style: normal;
  font-weight: 700;
  font-display: swap;
  src: url(${amharicBoldPath}) format("woff2");
  unicode-range: U+030E, U+1200-1399, U+2D80-2DDE, U+AB01-AB2E, U+1E7E0-1E7E6, U+1E7E8-1E7EB, U+1E7ED-1E7EE, U+1E7F0-1E7FE;
}
/* Pico declares its tokens at ':root:not([data-theme=dark])', so a bare ':root' here would lose
   the specificity contest and silently leave every button Pico blue. Hence the repeated ':root'. */
/* Palette: techelet and white, the national colours.
   The Flag and Emblem Law describes the colour but fixes no hex; #0038b8 is the value in common
   use. These are the *national* colours, deliberately not the gov.il service palette: the
   canonical package states the project does not represent a state body, and looking like an
   official government service would work against that. Amber is the one non-blue hue, reserved
   for the caveat callout, where a warning colour is the accurate signal. */
:root:root:root {
  color-scheme: light;
  --ink: #101a2c; --paper: #ffffff; --seal: #0038b8; --seal-deep: #002a8c;
  --caution: #9a5b00; --rule: #ccd7ea; --mute: #4d5a72; --card: #f5f8fd;
  --font: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Hebrew", "Noto Sans Arabic",
    "Noto Sans Ethiopic", "Helvetica Neue", sans-serif;
  --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  --amharic-font: "Noto Sans Ethiopic", "Noto Sans", system-ui, -apple-system, "Segoe UI", sans-serif;

  --pico-font-family: var(--font);
  --pico-background-color: var(--paper);
  --pico-color: var(--ink);
  --pico-h1-color: var(--ink); --pico-h2-color: var(--ink); --pico-h3-color: var(--ink);
  --pico-muted-color: var(--mute);
  --pico-muted-border-color: var(--rule);
  --pico-primary: var(--seal-deep);
  --pico-primary-background: var(--seal);
  --pico-primary-hover-background: var(--seal-deep);
  --pico-primary-border: var(--seal);
  --pico-primary-hover-border: var(--seal-deep);
  --pico-primary-inverse: #ffffff;
  --pico-primary-focus: rgba(0, 56, 184, .3);
  --pico-form-element-background-color: var(--card);
  --pico-form-element-border-color: var(--rule);
  --pico-form-element-active-border-color: var(--seal);
  --pico-border-radius: 4px;
  --pico-spacing: 1rem;
}
/* Dark mode is a lit room, not a void. Techelet at full strength is unreadable on a dark ground,
   so it lifts toward sky while staying recognisably the same blue.
   The block is stated twice because CSS cannot share one declaration list between a media query
   and an attribute selector: once for "system says dark and the reader has not forced light",
   once for "the reader chose dark". Keep the two lists identical. */
@media (prefers-color-scheme: dark) {
  :root:root:root:not([data-theme=light]) {
    color-scheme: dark;
    --ink: #eaf0fa; --paper: #0f1826; --seal: #6ea3f5; --seal-deep: #8fbaff;
    --caution: #e0a33f; --rule: #2b3a52; --mute: #a9b8d0; --card: #182338;
    --pico-primary-inverse: #08101c;
    --pico-primary-focus: rgba(110, 163, 245, .4);
  }
}
:root:root:root[data-theme=dark] {
  color-scheme: dark;
  --ink: #eaf0fa; --paper: #0f1826; --seal: #6ea3f5; --seal-deep: #8fbaff;
  --caution: #e0a33f; --rule: #2b3a52; --mute: #a9b8d0; --card: #182338;
  --pico-primary-inverse: #08101c;
  --pico-primary-focus: rgba(110, 163, 245, .4);
}

body { overflow-wrap: anywhere; background: var(--paper); }
/* Our own spine rather than Pico's .container, so header, main and footer align on one measure.
   Sized in rem on purpose: Pico scales the root font-size with the viewport, so this holds a
   constant line length in characters rather than a constant pixel width. */
.wrap { max-inline-size: 46rem; margin-inline: auto; padding-inline: 1rem; }
main.wrap { padding-block-end: 3rem; }
footer.wrap { padding-block: 2rem 3rem; border-block-start: 1px solid var(--rule); margin-block-start: 2rem; }

/* Type: one hard jump from display to body, no timid intermediate steps. */
h1 { font-size: clamp(2rem, 1.35rem + 3vw, 3.25rem); line-height: 1.05; letter-spacing: -.022em; font-weight: 750; text-wrap: balance; }
h2 { font-size: clamp(1.25rem, 1.1rem + .8vw, 1.6rem); letter-spacing: -.012em; font-weight: 700; text-wrap: balance; }
p, li, label { line-height: 1.6; }
.lede { font-size: 1.125rem; color: var(--mute); max-inline-size: 60ch; }

/* Utility register. Tracking and uppercasing are Latin/Cyrillic devices: letter-spacing severs
   the cursive joins in Arabic, and neither Hebrew, Yiddish nor Ge'ez has a case distinction. */
:root:root:root { --track: .09em; --caps: uppercase; }
html:is([lang=he], [lang=ar], [lang=yi], [lang=am]) { --track: 0; --caps: none; }
html[lang=am] { --font: var(--amharic-font); }
.eyebrow, .metrics span, .languages summary .label {
  font-size: .78rem; text-transform: var(--caps); letter-spacing: var(--track); color: var(--mute);
}

.skip-link { position: absolute; inset-inline-start: -9999px; }
.skip-link:focus { inset-inline-start: 1rem; inset-block-start: 1rem; z-index: 2; background: var(--card); padding: .5rem 1rem; border-radius: 4px; }
:focus-visible { outline: 3px solid var(--seal); outline-offset: 2px; }

/* Header */
header.wrap { display: flex; flex-wrap: wrap; gap: .5rem 1.5rem; align-items: baseline; padding-block: 1.25rem; border-block-end: 1px solid var(--rule); margin-block-end: 1.5rem; }
.wordmark { font-weight: 750; letter-spacing: -.015em; color: var(--ink); text-decoration: none; font-size: 1.05rem; }
/* Pico sets nav { justify-content: space-between }, which strands these links at the edges. */
nav.primary { display: flex; flex-wrap: wrap; justify-content: flex-start; gap: .35rem 1.1rem; flex: 1 1 auto; }
nav.primary a { text-decoration: none; color: var(--mute); font-size: .95rem; padding-block: .35rem; }
nav.primary a:hover { color: var(--seal); }
.languages { margin: 0; }
/* Controls stay at or above the 24x24 CSS px target size in WCAG 2.5.8. */
.languages summary { font-size: .9rem; color: var(--mute); cursor: pointer; padding-block: .45rem; }
.languages ul { margin: .25rem 0 0; padding: 0; list-style: none; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 .75rem; }
.languages li { list-style: none; }
.languages a { text-decoration: none; display: inline-block; padding-block: .35rem; min-block-size: 24px; }
.languages [aria-current] { color: var(--seal); font-weight: 650; }
footer.wrap a { display: inline-block; padding-block: .35rem; min-block-size: 24px; }

/* Appearance switcher. Hidden when scripting is off, since the choice is stored in localStorage
   and an unusable control is worse than no control; the system preference still applies. */
.appearance { display: none; align-items: center; gap: .4rem; flex-wrap: wrap; }
html.js .appearance { display: flex; }
.appearance > span { font-size: .78rem; color: var(--mute); text-transform: var(--caps); letter-spacing: var(--track); }
.appearance button {
  inline-size: auto; margin: 0; padding: .3rem .7rem; min-block-size: 32px;
  font-size: .85rem; font-weight: 500; background: var(--card); color: var(--mute);
  border: 1px solid var(--rule); border-radius: 4px;
}
.appearance button:hover { color: var(--seal); border-color: var(--seal); background: var(--card); }
.appearance button[aria-pressed=true] {
  background: var(--seal); color: var(--pico-primary-inverse); border-color: var(--seal); font-weight: 600;
}
input[type=checkbox] { inline-size: 1.5rem; block-size: 1.5rem; min-inline-size: 24px; min-block-size: 24px; }

/* Signature: the same campaign, set in all six scripts. Choosing a language is choosing a script. */
.scripts { display: flex; flex-wrap: wrap; gap: .5rem; margin-block-end: 2rem; padding-block-end: 1.5rem; border-block-end: 1px solid var(--rule); }
.scripts a {
  font-size: clamp(1rem, .9rem + .5vw, 1.3rem); text-decoration: none; color: var(--mute);
  padding: .3rem .7rem; border: 1px solid var(--rule); border-radius: 4px; background: var(--card);
  transition: color .15s, border-color .15s;
}
.scripts a:hover { color: var(--ink); border-color: var(--mute); }
.scripts [aria-current] { color: var(--paper); background: var(--seal-deep); border-color: var(--seal-deep); font-weight: 650; }

/* Pico declares list-style on the li, so resetting it on the list alone leaves the markers. */
.metrics, .constraints, .portfolios, .journey, .documents, .clauses, .timeline,
.metrics li, .constraints li, .portfolios li, .journey li, .documents li, .clauses li, .timeline li {
  list-style: none;
}

.metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr)); gap: 1.25rem; margin-block: 2.5rem; padding: 0; }
.metrics li { border-block-start: 2px solid var(--rule); padding-block-start: .6rem; padding-inline: 0; }
.metrics strong { display: block; font-family: var(--mono); font-size: 2rem; font-weight: 600; color: var(--seal); font-variant-numeric: tabular-nums; line-height: 1.1; }
.metrics span { display: block; margin-block-start: .2rem; }

/* Forms: the generated text is the content, so give it room and let it grow with what it holds. */
textarea { font-size: .95rem; line-height: 1.55; min-block-size: 6lh; max-block-size: 24lh; field-sizing: content; }
html[lang=am] h1 { line-height: 1.14; }
html[lang=am] textarea { line-height: 1.65; }
label { font-weight: 550; }
.actions { display: flex; flex-wrap: wrap; gap: .6rem; margin-block: .5rem 1.25rem; }
.actions button { inline-size: auto; flex: 1 1 12rem; margin: 0; }
.actions.share button { flex: 1 1 7rem; }
button.ghost, .actions.share button {
  background: var(--card); color: var(--ink); border-color: var(--rule); font-weight: 550;
}
button.ghost:hover, .actions.share button:hover { background: var(--paper); border-color: var(--seal); color: var(--seal); }
.note { font-size: .85rem; color: var(--mute); margin-block-start: -.5rem; }

/* "I sent it" is a state change, not another channel — a rule separates it from the send options. */
.confirm { border-block-start: 1px solid var(--rule); margin-block-start: 2rem; padding-block-start: 1.5rem; }
.confirm button { inline-size: auto; }

.section-label { display: flex; align-items: center; gap: .75rem; margin-block: 2rem .75rem; }
.section-label::after { content: ""; flex: 1; block-size: 1px; background: var(--rule); }

/* ---- Wayfinding -------------------------------------------------------------------------- */

/* The three actions in fixed order, numbered. Someone who has done this once looks for "2". */
.actions-bar { display: flex; flex-wrap: wrap; gap: .5rem; padding-block: .75rem 1.25rem; }
.actions-bar a {
  display: flex; align-items: center; gap: .55rem; flex: 1 1 10rem; min-block-size: 48px;
  padding: .5rem .9rem; border: 1px solid var(--rule); border-radius: 4px; background: var(--card);
  text-decoration: none; color: var(--ink); font-weight: 550;
}
.actions-bar a:hover { border-color: var(--seal); color: var(--seal); }
.actions-bar b {
  flex: none; inline-size: 1.6rem; block-size: 1.6rem; display: grid; place-items: center;
  border-radius: 50%; background: var(--seal-deep); color: var(--pico-primary-inverse);
  font-family: var(--mono); font-size: .8rem;
}
footer.wrap { display: flex; flex-wrap: wrap; gap: .25rem 1.5rem; }

.journey, .documents { list-style: none; padding: 0; display: grid; gap: .75rem; margin-block: 1rem 2.5rem; }
.documents { grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr)); }
.journey { counter-reset: journey; }
.journey a, .documents a {
  display: block; padding: 1rem 1.15rem; border: 1px solid var(--rule); border-radius: 4px;
  background: var(--card); text-decoration: none; color: var(--ink); block-size: 100%;
}
.journey a:hover, .documents a:hover { border-color: var(--seal); }
.journey strong, .documents strong { display: block; margin-block-end: .3rem; }
.journey span, .documents span { color: var(--mute); font-size: .95rem; }
.journey li { counter-increment: journey; position: relative; }
.journey strong::before {
  content: counter(journey) ". "; font-family: var(--mono); color: var(--seal);
}

.cta { font-size: 1.05rem; padding-inline: 1.5rem; }
/* "The platform does not recommend how to vote" is a disclaimer, so it takes the caveat colour
   rather than the action colour. */
.neutrality {
  border-inline-start: 3px solid var(--caution); padding-inline-start: .9rem;
  color: var(--mute); font-size: .95rem; margin-block: 1.5rem;
}

/* ---- Political documents ----------------------------------------------------------------- */

/* Numbering is real here: the canonical package refers to these clauses by number. */
.clauses { list-style: none; padding: 0; counter-reset: clause; }
.clause {
  position: relative; padding-block: 2rem; border-block-start: 1px solid var(--rule);
  scroll-margin-block-start: 1rem;
}
.clause-number {
  font-family: var(--mono); font-size: .85rem; color: var(--seal); letter-spacing: .06em;
}
.clause h2 { margin-block: .35rem 1rem; }
.clause-label {
  font-size: .72rem; text-transform: var(--caps); letter-spacing: var(--track);
  color: var(--mute); margin-block-end: .25rem; font-weight: 600;
}
.clause-body { font-size: 1.05rem; }

/* Three fixed callouts in a fixed order. Colour and label together carry the meaning, so the
   distinction survives both colour blindness and a monochrome print. */
.callout {
  border-inline-start: 3px solid var(--rule); padding: .1rem 0 .1rem 1rem;
  padding-inline: 1rem 0; margin-block: 1rem; background: none;
}
.callout.why { border-inline-start-color: var(--seal); }
.callout.how { border-inline-start-color: var(--mute); }
.callout.except { border-inline-start-color: var(--caution); }
.clause-detail { margin-block-start: 1rem; border: 0; padding: 0; background: none; }
.clause-detail > summary {
  font-size: .85rem; color: var(--mute); cursor: pointer; padding-block: .5rem;
  min-block-size: 24px;
}
.clause-detail > summary:hover { color: var(--seal); }
.clause-detail[open] > summary { color: var(--ink); margin-block-end: .25rem; }

.callout ul { margin: 0; padding-inline-start: 1.1rem; list-style: none; }
.callout li { margin-block: .2rem; line-height: 1.45; position: relative; }
/* A tick rather than a bullet: these are the things that can actually be checked. */
.callout.how li::before {
  content: "✓"; position: absolute; inset-inline-start: -1.1rem;
  color: var(--seal); font-size: .85em;
}
.callout p:last-child, .callout ul:last-child { margin-block-end: 0; }

/* ---- First 100 days ---------------------------------------------------------------------- */

.timeline { list-style: none; padding: 0; }
.plan-item { padding-block: 1.75rem; border-block-start: 1px solid var(--rule); }
.plan-days { margin: 0 0 .4rem; }
.plan-days strong { font-family: var(--mono); font-size: 1.35rem; color: var(--seal); }
.plan-days span { font-size: .8rem; color: var(--mute); text-transform: var(--caps); letter-spacing: var(--track); }
.plan-track { display: block; inline-size: 100%; block-size: 8px; }
.plan-track-bg { fill: var(--rule); }
.plan-bar { fill: var(--seal); }
.plan-item h2 { margin-block: 1rem .75rem; }
.plan-fields { display: grid; grid-template-columns: minmax(6rem, auto) 1fr; gap: .35rem 1rem; margin: 0; }
.plan-fields dt {
  font-size: .72rem; text-transform: var(--caps); letter-spacing: var(--track);
  color: var(--mute); font-weight: 600; padding-block-start: .2rem;
}
.plan-fields dd { margin: 0; }
@media (max-width: 32rem) {
  .plan-fields { grid-template-columns: 1fr; gap: 0; }
  .plan-fields dd { margin-block-end: .75rem; }
}

/* ---- Government model -------------------------------------------------------------------- */

.constraints { list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: 2.5rem; margin-block: 1.5rem 2.5rem; }
.constraints strong { display: block; font-family: var(--mono); font-size: 3rem; line-height: 1; color: var(--seal); }
.constraints span { color: var(--mute); font-size: .9rem; }
.portfolios { list-style: none; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr)); gap: .5rem; }
.portfolios li {
  display: flex; gap: .6rem; align-items: baseline; padding: .7rem .85rem;
  border: 1px solid var(--rule); border-radius: 4px; background: var(--card); font-size: .95rem;
}
.portfolio-number { font-family: var(--mono); font-size: .75rem; color: var(--mute); flex: none; }

.prose h3 { font-size: 1.05rem; margin-block: 1.75rem .5rem; }
.prose p { margin-block: .75rem; }

/* A quiet entrance so long documents do not arrive as one wall. Disabled below for reduced motion. */
@media (prefers-reduced-motion: no-preference) {
  .clause, .plan-item { animation: rise .5s ease-out both; animation-timeline: view(); animation-range: entry 0% cover 22%; }
  @keyframes rise { from { opacity: .25; transform: translateY(1rem); } to { opacity: 1; transform: none; } }
}

/* ---- Small screens ------------------------------------------------------------------------
   On a phone the chrome was 389px tall before the headline: a wrapped document nav, a three-line
   action bar and a six-chip language band, two of which are language controls. Rows now scroll
   on one line instead of wrapping, and the band is desktop-only since the header already
   switches language. */
@media (max-width: 47.99rem) {
  header.wrap { padding-block: .85rem; gap: .35rem 1rem; margin-block-end: 1rem; }
  .wordmark { font-size: 1rem; }

  /* One line that scrolls, rather than three lines that wrap. */
  nav.primary {
    flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none;
    inline-size: 100%; order: 3; gap: 1rem; padding-block-start: .15rem;
  }
  nav.primary::-webkit-scrollbar { display: none; }
  nav.primary a { white-space: nowrap; }
  .languages { margin-inline-start: auto; }

  /* Three across, one row: the numbers stay in the same place on every page. */
  .actions-bar { gap: .4rem; padding-block: .5rem 1rem; }
  .actions-bar a {
    flex: 1 1 0; min-inline-size: 0; flex-direction: column; gap: .2rem;
    padding: .55rem .3rem; text-align: center; font-size: .82rem; line-height: 1.2;
  }

  /* The six-script band is a wide-screen signature; the header control does the same job here. */
  .scripts { display: none; }

  h1 { font-size: clamp(1.75rem, 1.1rem + 3.2vw, 2.25rem); }
  .lede { font-size: 1.05rem; }
  .clause, .plan-item { padding-block: 1.5rem; }
  .constraints { gap: 1.5rem; }
  .constraints strong { font-size: 2.25rem; }
}

/* ---- Admin console ------------------------------------------------------------------------
   Same palette, same type scale, different job. A supporter is being guided through three
   actions; an operator is reading tables and needs the width to do it, so the measure widens,
   the chrome collapses to one bar, and rank is carried by badges rather than by more colour. */
body.admin .wrap { max-inline-size: 76rem; }
body.admin main.wrap { padding-block-end: 4rem; }
/* Two rows on purpose, at every width: who you are, then where you can go. Eight sections plus
   an email address never fit on one line honestly, and a nav that reflows as the address grows
   is a nav whose items move. */
.admin-bar { display: flex; flex-wrap: wrap; align-items: center; gap: .4rem 1rem; padding-block: .8rem .6rem; border-block-end: 1px solid var(--rule); margin-block-end: 1.5rem; }
.admin-bar .wordmark { display: inline-flex; align-items: center; gap: .5rem; }
nav.admin-nav { display: flex; flex-wrap: wrap; justify-content: flex-start; gap: .2rem; flex: 1 0 100%; margin-inline-start: -.6rem; }
nav.admin-nav a { text-decoration: none; color: var(--mute); font-size: .92rem; padding: .35rem .6rem; border-radius: 4px; min-block-size: 24px; }
nav.admin-nav a:hover { color: var(--seal); background: var(--card); }
nav.admin-nav [aria-current] { color: var(--paper); background: var(--seal-deep); font-weight: 600; }
.admin-who { font-size: .8rem; color: var(--mute); display: inline-flex; align-items: center; gap: .4rem; margin-inline-start: auto; }
footer.admin-foot { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 1rem; }
body.admin h1 { font-size: clamp(1.6rem, 1.3rem + 1.2vw, 2.1rem); margin-block-end: .35rem; }
body.admin h2 { font-size: 1.15rem; }
body.admin .lede { font-size: 1rem; margin-block-end: 1.25rem; }
.admin-back { font-size: .9rem; margin-block-end: .5rem; }
.admin-links { display: flex; flex-wrap: wrap; gap: 1.25rem; }

/* Tables scroll inside their own box; the page itself never scrolls sideways. */
.admin-table { overflow-x: auto; margin-block: 1rem 2rem; border: 1px solid var(--rule); border-radius: 4px; }
.admin-table table { margin: 0; font-size: .9rem; }
.admin-table th { white-space: nowrap; font-size: .7rem; text-transform: var(--caps); letter-spacing: var(--track); color: var(--mute); font-weight: 600; }
.admin-table td { vertical-align: top; max-inline-size: 24rem; }
/* Template bodies are paragraphs. Three lines is enough to recognise one; the editor below
   holds the whole thing. */
.admin-excerpt { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.admin-num { font-family: var(--mono); font-size: .85em; font-variant-numeric: tabular-nums; white-space: nowrap; }
.admin-nil { color: var(--mute); }
.admin-payload { inline-size: 7rem; }
.admin-payload summary { cursor: pointer; color: var(--mute); font-size: .85rem; min-block-size: 24px; }
.admin-payload pre { font-size: .75rem; margin: .35rem 0 0; max-block-size: 14rem; overflow: auto; }

/* One badge shape for every categorical value, so type, channel, state and status all read as
   the same kind of fact. Colour is a second signal only where a state is actionable. */
.badge {
  display: inline-block; padding: .05rem .5rem; margin-inline-end: .25rem; border-radius: 999px;
  border: 1px solid var(--rule); background: var(--card); color: var(--mute);
  font-size: .72rem; font-weight: 600; white-space: nowrap; text-decoration: none;
}
a.badge:hover { color: var(--seal); border-color: var(--seal); }
.badge.on { color: var(--seal); border-color: var(--seal); }
.badge.off { color: var(--caution); border-color: var(--caution); }

/* Translation coverage. Solid chip: this language exists. Dashed: a gap, and the link fills it. */
.locale-chips { display: inline-flex; gap: .25rem; }
.locale-chips a {
  display: inline-flex; align-items: center; flex: none; white-space: nowrap;
  min-block-size: 24px; padding: .1rem .4rem;
  border: 1px solid var(--rule); border-radius: 3px; background: var(--card);
  font-family: var(--mono); font-size: .72rem; text-decoration: none; color: var(--seal);
}
.locale-chips a.missing { color: var(--mute); background: none; border-style: dashed; }
.locale-chips a:hover { border-color: var(--seal); color: var(--seal); }

.admin-filters { display: flex; flex-wrap: wrap; justify-content: flex-start; gap: .35rem; margin-block: 1.25rem; }
.admin-filters a {
  display: inline-flex; align-items: center; gap: .4rem; min-block-size: 32px; padding: .25rem .7rem;
  border: 1px solid var(--rule); border-radius: 4px; background: var(--card);
  text-decoration: none; color: var(--mute); font-size: .85rem;
}
.admin-filters a:hover { border-color: var(--seal); color: var(--seal); }
.admin-filters [aria-current] { background: var(--seal-deep); border-color: var(--seal-deep); color: var(--paper); font-weight: 600; }
.admin-filters b { font-family: var(--mono); font-size: .8rem; }

.admin-callout { border-inline-start: 3px solid var(--seal); padding-inline-start: .9rem; font-size: .95rem; }
.admin-error { border-inline-start: 3px solid var(--caution); padding-inline-start: .9rem; color: var(--caution); font-weight: 550; }
.admin-quote { border-inline-start: 3px solid var(--rule); padding: .25rem 0 .25rem 1rem; padding-inline: 1rem 0; margin: 0; white-space: pre-wrap; }
.admin-fields { display: grid; grid-template-columns: minmax(8rem, auto) 1fr; gap: .3rem 1rem; margin: 0; }
.admin-fields dt { font-size: .72rem; text-transform: var(--caps); letter-spacing: var(--track); color: var(--mute); font-weight: 600; padding-block-start: .15rem; }
.admin-fields dd { margin: 0; }
.admin-files, .admin-files li { list-style: none; padding-inline-start: 0; }

/* Admin forms are long. Two or three columns keep a whole record on one screen; the wide fields
   opt back out to the full width. */
.admin-form { display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: 0 1.25rem; align-items: start; }
.admin-form .full, .admin-form > p { grid-column: 1 / -1; }
.admin-form button { inline-size: auto; }
.admin-form label:has(> input[type=checkbox]) { display: flex; align-items: center; gap: .5rem; }

.admin-switches { display: grid; grid-template-columns: 1fr; gap: .5rem; max-inline-size: 40rem; }
.admin-switch { display: flex; align-items: flex-start; gap: .75rem; padding: .75rem .9rem; border: 1px solid var(--rule); border-radius: 4px; background: var(--card); margin: 0; }
.admin-switch input { margin: 0; flex: none; }
.admin-switch small { display: block; color: var(--mute); font-weight: 400; font-size: .85rem; }
.admin-switches button { inline-size: auto; }

/* Delete is its own form and carries the warning colour, so it can never be reached by
   mis-reading a dropdown in the save form. */
.admin-delete { margin: 0; }
button.danger {
  inline-size: auto; margin: 0; padding: .2rem .6rem; font-size: .78rem; font-weight: 550;
  background: none; color: var(--caution); border: 1px solid var(--caution); white-space: nowrap;
}
button.danger:hover { background: var(--caution); color: var(--paper); border-color: var(--caution); }

@media (max-width: 47.99rem) {
  .admin-bar { padding-block: .7rem; }
  nav.admin-nav { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; }
  nav.admin-nav::-webkit-scrollbar { display: none; }
  nav.admin-nav a { white-space: nowrap; }
  .admin-fields { grid-template-columns: 1fr; gap: 0; }
  .admin-fields dd { margin-block-end: .6rem; }
}

bdi, [dir=ltr] { unicode-bidi: isolate; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
}
`;

/**
 * Loaded render-blocking in <head> so the stored choice is applied before first paint. It has to
 * be a separate same-origin file rather than an inline script: script-src has no 'unsafe-inline',
 * and the main bundle is deferred, which would flash the wrong theme.
 */
export const THEME_JS =
  "document.documentElement.classList.add('js');" +
  "try{var t=localStorage.getItem('theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t}catch(e){}";

export const JS = `
document.addEventListener('click', async (e) => {
  const button = e.target?.closest?.('[data-copy]');
  const copy = button?.dataset?.copy;
  if (copy) {
    if (button.dataset.copyFallback === '1') { delete button.dataset.copyFallback; return; }
    const form = button.closest('form');
    if (button.dataset.copyEndpoint) e.preventDefault();
    const source = document.getElementById(copy);
    if (source) {
      let copied = false;
      try { await navigator.clipboard.writeText(source.value); copied = true; }
      catch (err) { source.select(); try { copied = document.execCommand('copy'); } catch (fallbackError) { copied = false; } }
      if (copied && button.dataset.copyEndpoint) {
        const csrf = form?.querySelector('[name=csrf]')?.value;
        const requestId = form?.querySelector('[name=requestId]')?.value;
        const capability = form?.querySelector('[name=capability]')?.value;
        const data = new URLSearchParams({ csrf: csrf || '', requestId: requestId || '', capability: capability || '' });
        fetch(button.dataset.copyEndpoint, { method: 'POST', body: data, credentials: 'same-origin' }).catch(() => {});
      } else if (!copied && form) {
        button.dataset.copyFallback = '1';
        form.requestSubmit(button);
      }
    }
  }
  const theme = e.target?.closest?.('[data-theme-set]')?.dataset?.themeSet;
  if (theme) {
    try { theme === 'system' ? localStorage.removeItem('theme') : localStorage.setItem('theme', theme); } catch (err) {}
    if (theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = theme;
    mark();
  }
});
// Destructive admin forms declare their warning as data, because script-src has no
// 'unsafe-inline' and an onsubmit attribute would be blocked. Without JS the delete still works:
// it is a separate, plainly-labelled form rather than an option hidden in the save dropdown.
document.addEventListener('submit', (e) => {
  const message = e.target?.dataset?.confirm;
  if (message && !confirm(message)) e.preventDefault();
});
// Without JS no button can be marked current, so the state is set here rather than server-side.
function mark() {
  let stored = null;
  try { stored = localStorage.getItem('theme'); } catch (err) {}
  for (const el of document.querySelectorAll('[data-theme-set]')) {
    el.setAttribute('aria-pressed', String(el.dataset.themeSet === (stored || 'system')));
  }
}
mark();
`.trim();

/** Content-hashed so a deploy actually reaches browsers; the old URL simply stops being referenced. */
export const cssPath = `/assets/app-${fingerprint(CSS)}.css`;
export const jsPath = `/assets/app-${fingerprint(JS)}.js`;
export const themePath = `/assets/theme-${fingerprint(THEME_JS)}.js`;
