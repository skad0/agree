import { createHash } from "node:crypto";

/**
 * "Protocol" — stamp green for action, signal red reserved for the counts, cool paper ground.
 * No webfonts on purpose: the six scripts (Hebrew, Arabic, Ge'ez, Cyrillic, Latin) already ship
 * with every OS, and shipping display faces for all of them would cost this audience real bytes.
 * Pico is retuned through its own custom properties rather than by overriding its selectors.
 */
export const CSS = `
/* Pico declares its tokens at ':root:not([data-theme=dark])', so a bare ':root' here would lose
   the specificity contest and silently leave every button Pico blue. Hence the repeated ':root'. */
:root:root:root {
  --ink: #16202b; --paper: #f2f4f1; --seal: #2f6b4f; --seal-deep: #24513c;
  --signal: #b5442a; --rule: #c9d0c9; --mute: #5c6a64; --card: #fbfcfa;
  --font: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Hebrew", "Noto Sans Arabic",
    "Noto Sans Ethiopic", "Helvetica Neue", sans-serif;
  --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;

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
  --pico-primary-focus: rgba(47, 107, 79, .35);
  --pico-form-element-background-color: var(--card);
  --pico-form-element-border-color: var(--rule);
  --pico-form-element-active-border-color: var(--seal);
  --pico-border-radius: 4px;
  --pico-spacing: 1rem;
}
/* Dark mode is a lit room, not a void: the ground is a warm slate rather than near-black, rules
   are visible, and text sits well above the 4.5:1 floor. The first attempt was far too dark. */
@media (prefers-color-scheme: dark) {
  :root:root:root {
    --ink: #eef2ee; --paper: #1e2529; --seal: #5fae82; --seal-deep: #74c096;
    --signal: #f0906d; --rule: #3a444b; --mute: #b0bcb4; --card: #283036;
    --pico-primary-inverse: #12181b;
    --pico-primary-focus: rgba(95, 174, 130, .45);
  }
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

/* Counts carry the campaign's whole claim, so they get the only saturated colour on the page. */
/* Pico declares list-style on the li, so resetting it on the list alone leaves the markers. */
.metrics, .constraints, .portfolios, .journey, .documents, .clauses, .timeline,
.metrics li, .constraints li, .portfolios li, .journey li, .documents li, .clauses li, .timeline li {
  list-style: none;
}

.metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr)); gap: 1.25rem; margin-block: 2.5rem; padding: 0; }
.metrics li { border-block-start: 2px solid var(--rule); padding-block-start: .6rem; padding-inline: 0; }
.metrics strong { display: block; font-family: var(--mono); font-size: 2rem; font-weight: 600; color: var(--signal); font-variant-numeric: tabular-nums; line-height: 1.1; }
.metrics span { display: block; margin-block-start: .2rem; }

/* Forms: the generated text is the content, so give it room and let it grow with what it holds. */
textarea { font-size: .95rem; line-height: 1.55; min-block-size: 6lh; max-block-size: 24lh; field-sizing: content; }
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
.neutrality {
  border-inline-start: 3px solid var(--signal); padding-inline-start: .9rem;
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
  font-family: var(--mono); font-size: .85rem; color: var(--signal); letter-spacing: .06em;
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
.callout.except { border-inline-start-color: var(--signal); }
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
.plan-days strong { font-family: var(--mono); font-size: 1.35rem; color: var(--signal); }
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
.constraints strong { display: block; font-family: var(--mono); font-size: 3rem; line-height: 1; color: var(--signal); }
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

bdi, [dir=ltr] { unicode-bidi: isolate; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
}
`;

export const JS = "document.addEventListener('click',async e=>{const id=e.target?.dataset?.copy;if(id){await navigator.clipboard.writeText(document.getElementById(id).value);}});";

/** Content-hashed so a deploy actually reaches browsers; the old URL simply stops being referenced. */
const fingerprint = (value: string) => createHash("sha256").update(value).digest("base64url").slice(0, 10);
export const cssPath = `/assets/app-${fingerprint(CSS)}.css`;
export const jsPath = `/assets/app-${fingerprint(JS)}.js`;
