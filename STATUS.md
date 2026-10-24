# Project Status — Common Bar · רף משותף (agree)

_Last updated: 2026-10-24 (+03), after the post-approval candidate data update ([plan](docs/CANDIDATE_DATA_UPDATE_PLAN.md), [refresh report](docs/CANDIDATE_REFRESH_2026-10-24.md))._

## Current state

A server-rendered Hono JSX / SQLite WAL site in seven locales (he, ar, yi, ru, en, am, uk). It is implemented and passing all checks locally and in CI. It is **not deployed**: no deploy is recorded in the repository, and the production domain `rafmeshutaf.org.il` could not be reached from this review session.

The public product is now **share-first**: the earlier write-to-your-representative ("action-first") flow is retired.

- **Problems (the index, `/:locale`)**: ten problem cards with stable `/:locale/issues/:slug` pages. Sharing goes to WhatsApp, Facebook, Telegram, X, the native share menu, or copy. Sharing writes nothing and keeps no counters.
- **Scorecard (`/:locale/scorecard`)**: "Shared Threshold" civic matrix for the 26th Knesset election. It has 5 criteria (equal service, core curriculum, budget integrity, judicial independence, term limits) and 13 evidence records on official hosts. It covers the 38 lists the Central Elections Committee (CEC) approved on 27.9.2026, in every locale. Blue and White is marked as withdrawn: every candidate resigned, so it is not on the ballot. It stays searchable with its 25th-Knesset record but is not scored, segmented or shared. Incumbent scores rest on 25th-Knesset votes and agreements. New lists stay "uncommitted" rather than failing. Party and leader names stay in Hebrew, with a localized reading next to each. A test checks each party's list key, approved ballot letters, roster URL, running state and leader name against the shipped transcript.
- **Positions (`/:locale/positions`, and a "Where the lists stand" section on each issue page)**: what 15 lists have said in public on the ten questions, as of 24.10.2026. It has 43 sourced statements, 21 other commitments or coalition conditions, and 5 dated background facts (for example, the government's 5.7.2026 decision not to recognise a High Court order). Each entry links to its source on an allow-listed national outlet, research institute or party site. A mark compares the statement with the commitment as written; it is a record, not a score, and never feeds the scorecard. The data is `src/data/positions-2026.ts`, checked by `assertPositionsDataset`. The 15 lists were chosen by hand from national coverage, not by a measure (Noam was added on 25.10); the other 22 approved lists were not reviewed. Every weight-bearing entry was re-checked word for word against its source. The page reads by question or by list in folding sections that open in place, with the open section's header kept in view; deep links (`?q=`, `?view=list&list=`) open their section on the server, without scripting. The lists-by-questions grid is desktop only. Every statement has its own permalink (`/:locale/positions?entry=<record id>#<record id>`) that opens its question and previews as that statement (og:title is list and question, og:description is the paraphrase), plus a quiet share control; ids are unique in both views. The page itself has a share control. Per-question share cards (`src/assets/share-q-<slug>-<locale>.png`) are wired with a fallback to the locale card, and `python scripts/brand/generate.py --question-cards` produces them; all 70 (10 questions x 7 locales, 1.9 MB) were generated on 25.10 with uv-managed Python 3.12. The generator now splits right-to-left text into bidi runs, so numbers keep their order ("100", not "001"); it falls back to Noto Sans for glyphs a face lacks (Ethiopic digits and "?"), and it fails the build rather than draw a missing-glyph box. The way in is a card on the main page, a compact card and a per-list link on the scorecard, a Positions item in the header, a marks strip on each index card and a jump link near the top of each question page.
- **About**, plus supporting documents in the footer: standard, coalition agreement, first 100 days, government model, methodology, privacy, and the appearance switcher.
- Header is **Problems · Scorecard · About**, with Problems marked as the index. `/:locale/candidates` now redirects (302) to the index. The public candidate directory was retired on 2026-09-25.
- Retired and paused flows: all nine old appeal POST routes return 410. `/responses*` and `/support` return 503. Historical `/request/result` links and privacy self-deletion still work. `/admin` fails closed (403) without Cloudflare Access.
- Candidate data: `data/elections/knesset-26-lists.json` is a `transcript-3` snapshot captured on 2026-10-23. It has 38 lists (37 running, plus Blue and White withdrawn) and 1,322 rows, with state `approved`. 36 name strings and 12 submitted-by strings the capture damaged or changed were not taken from it; see the refresh report. It has not been imported or activated in any production database, and no public page reads it at runtime.
- Storage: 22 migrations (`001`–`022`). Object storage (S3/R2) and external backups are no longer part of the deploy; persistence is the Render disk at `/data/app.db`.

## Verified 2026-10-24 (after the data update, Node 22.22.0)

| Check | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm test` | **131 passed, 0 failed** (135 after the positions work the same day) |
| `npm run smoke` | Pass. Public routes 200, `/admin` 403 |
| `npm run smoke:pages` | Pass |
| `npm audit --omit=dev` (CI gate, default level) | **0 vulnerabilities** after upgrading `hono` to 4.13.13 and `@hono/node-server` to 1.19.17 |
| Migration `022` on a populated pre-022 database | 1,379 rows kept, `integrity_check` ok, no foreign-key errors; the new import activates as `approved` |
| Browser, `/he` and `/en` `/scorecard` at 375 and 1440 px | No horizontal overflow; withdrawn badge and note shown; no share option on the withdrawn list. Pico's CDN stylesheet was blocked by the session proxy, so its base styles were absent |

## Changes since the previous status (2026-07-31 → 2026-10-24)

- **2026-07-31**: Ukrainian locale (migration `007`); Knesset member contact batch (`006`); accessibility and hierarchy pass on public forms.
- **2026-08-01**: privacy, retention and restore hardening (migrations `008`–`015`).
- **2026-08-02**: public civic redesign.
- **2026-09-09**: merged PRs #2–#6: election directory schema (`016`), searchable directory, signed recipient selection, reviewed stances, and the finance schema (`017`). Then the **action-only privacy cut** (`018`): public flow without S3, with no stored appeal text and no public counters. Also fixed share links (`019` normalizes template newlines) and reply uploads.
- **2026-09-19**: **share-first** rebuild (`012eb1a`): ten problem cards and issue pages, a single ShareOptions control, retired appeal writes, paused intake, and the snapshot-isolated candidate directory (`020`, `021`). CEC candidate refresh: 38 lists, 1,379 rows, 0 missing rosters. Site-owner contacts removed from every locale. Local `.env` loading added. Election 26 pinned, with ETL and scheduling off. Details: [docs/SHARE_FIRST_VERIFICATION.md](docs/SHARE_FIRST_VERIFICATION.md), [docs/CANDIDATE_REFRESH_2026-09-19.md](docs/CANDIDATE_REFRESH_2026-09-19.md).
- **2026-09-23 → 25**: civic **scorecard** added (PR #8), localized to all seven locales (PR #10), and expanded to all 38 submitted lists with segment filters, a compliance gauge and a share option (PR #11). Localized readings of Hebrew names added (PR #12).
- **2026-09-25**: **Common Bar / רף משותף identity**: logo, favicons, manifest, OG and X images, new share PNGs, and brand guide [docs/brand/README.md](docs/brand/README.md) (QA: [docs/brand/QA.md](docs/brand/QA.md)). Header changed to Problems · Scorecard · About, and the public candidates page was retired.
- **2026-10-24**: **post-approval data update**. The candidate transcript moved to `transcript-3`, with lists marked as not running, page dates, text-damage checks and an `elections diff` command; migration `022` adds the new columns. The scorecard now follows the approved lists and marks Blue and White as withdrawn. Hono was upgraded and the CI audit exception removed.
- **2026-10-24**: **public positions on the ten questions**. Statements were collected from the web and each was read at its source; the work is described under Current state. Scorecard audit the same day: the 13 basis claims match the official records (63–57 on 10.6.2024, 64–0 on 24.7.2023, HCJ 5658/23 on 1.1.2024, HCJ 6198/23 on 25.6.2024). Both Knesset PDFs and the Budget Key page return 200. `main.knesset.gov.il` serves a bot challenge (HTTP 247), and the court host times out from the review session; these are access limits, not dead links. Scores are unchanged. The July 2026 government decision is not added as scorecard evidence because no `gov.il` copy of it was found.

## Open pull requests (2026-10-24)

- **#1** Add `/terms`, `/accessibility` and `/corrections` pages from the canonical package. Open since 2026-08-24, not merged. Those routes still do not exist on `main`.
- **#7** (draft) Directory slice 6, a Knesset 26 draft CEC import, and privacy contact hardening. Not merged. The share-first work adapted the checkpoint's full-name importer instead (see SHARE_FIRST_VERIFICATION).
- **#9** (draft) Move the scorecard into the footer with methodology. That runs against `main`, which put Scorecard in the header on 2026-09-25.

## Remaining launch gates / blockers

1. **Translation review (largest gate).** Political, legal and privacy text outside Russian is machine-translated and unreviewed. Ukrainian is a draft that needs a named native legal/political reviewer. New share-first questions and UI prose, and all scorecard copy, are unreviewed in **every** locale, including Hebrew and Russian. See [docs/TRANSLATION-REVIEW.md](docs/TRANSLATION-REVIEW.md).
2. **Page checks for the 2026-10-24 data update.** The approval, the Blue and White withdrawal, 36 unverified name strings and 12 submitted-by strings come from a capture that this session could not re-check: gov.il was refused by the network proxy. The open items are listed in [docs/CANDIDATE_REFRESH_2026-10-24.md](docs/CANDIDATE_REFRESH_2026-10-24.md#still-to-verify-on-the-pages).
3. **Accessibility.** Lighthouse and axe have not been run. NVDA/VoiceOver/TalkBack, 200% zoom, forced colors and real touch devices have not been tested.
4. **Device and platform checks.** Real iOS and Android share sheets and clipboard permissions have not been tested. Crawler previews (X, Facebook, WhatsApp, Telegram) have not been checked on a deployed URL.
5. **Deployment.** The Render deploy and the persistence of `/data` across redeploys are unverified, and so are the production Cloudflare Access, WAF and cache rules and the perimeter secrets (`SESSION_SECRET`, `TRUSTED_PROXY_SECRET`). `npm run load` has not been run against staging. No monitoring or alerting setup is recorded.
6. **Candidate snapshot.** Activation is only needed if a page reads the snapshot at runtime; none does now. If it is activated: back up first, then `elections import` and `elections activate`.
7. **Canonical site map.** `/terms`, `/accessibility` and `/corrections` are not on `main` (PR #1 is open). The "Initiator" section is still removed from About, so the operator is not named anywhere on the site. That needs a decision before launch.

## Inconsistencies noticed on 2026-10-24

- Fixed on 2026-10-24: the scorecard `publishedAt` (now 2026-09-23) and the "2026-03" heading in TRANSLATION-REVIEW.
- `docs/SHARE_FIRST_VERIFICATION.md` (116 tests) and `docs/brand/QA.md` (124) record the counts at the time they were written. The suite now has 131.

## Key deployment decisions

- Render paid Starter web service with a single instance (`numInstances: 1`), the 5 GB persistent disk at `/data`, and SQLite at `/data/app.db`, on Node 24.16.0.
- Cloudflare caches only public GET pages and assets, and protects `/admin*`. The origin validates Access JWTs independently. Production requires `SESSION_SECRET`, `TRUSTED_PROXY=cloudflare`, `TRUSTED_PROXY_SECRET` and an HTTPS `APP_BASE_URL`.
- No object storage or external backups in this deploy. Rely on the Render disk and its snapshots. Election ETL and its schedule stay disabled.
- Missing third-party keys never prevent startup or public pages. Access fails closed.

---

# History: July 2026 build-out (action-first design)

The sections below record the July 2026 work. They describe the action-first design that the 2026-09 share-first and action-only changes superseded: the numbered support/write/reply bar, the email/WhatsApp appeal builder, S3 uploads and external backups, the six-locale count, and placeholder recipients. Visual, palette, CSP and RTL decisions still apply.

## Initial MVP (2026-07-19 → 31)

The Hono/TypeScript MVP was implemented with server-rendered Hono JSX/native forms, Pico CSS, SQLite WAL, six locales, Render configuration, tests, and operational documentation. Verified then: `npm test` 33/33, `npm run typecheck` clean, both smoke suites passing.

- E0–E7: server, migrations, i18n, seeded demands, support/verification, appeal builder and sharing, response intake with S3, Cloudflare Access admin, security headers, privacy deletion, backup/restore, accessibility basics.
- Docs/deploy: `README.md`, `.env.example`, `docs/SECRETS.md`, `render.yaml`, backup/restore/load/smoke scripts.

## Appearance switcher (2026-07-28)

Light / dark / system, in the footer, in all six locales.

The choice is stored in `localStorage` and applied by a small render-blocking script at `/assets/theme-{hash}.js`. It is a separate same-origin file rather than the usual inline snippet because `script-src` has no `'unsafe-inline'`; the main bundle is deferred and would paint the wrong theme first. Dark tokens are stated twice — once under `prefers-color-scheme: dark` scoped to `:not([data-theme=light])`, once under `[data-theme=dark]` — since CSS cannot share a declaration list between a media query and an attribute selector.

With scripting off the control is hidden and the system preference applies, so nothing is left broken. Verified: preference survives navigation across locales, overrides the system setting, no console or CSP errors, 32 px buttons, no overflow at 375 px.

## Palette: national colours (2026-07-28)

Recoloured to techelet and white, `#0038b8` on white. The Flag and Emblem Law describes the colour but fixes no hex; `#0038b8` is the value in common use.

Deliberately the national colours and **not** the gov.il service palette. The canonical package states in Parts X and XIV that the project does not represent a state body and is an independent civic platform; resembling an official government service would work against that posture, which Section 0 treats as load-bearing for the legal-risk analysis. Flag colours are ordinary civic identity and carry no such implication.

Two hues: techelet for every action, link, counter and clause number; amber `#9a5b00` only for caveats — the permitted-exceptions callout and the neutrality disclaimer. Rank comes from scale and weight rather than hue.

Contrast measured in both themes: light 17.4:1 body / 9.3:1 links and button labels / 5.4:1 amber; dark 15.6:1 / 7:1 / 8:1. All above AA, most above AAA.

## Mobile pass (2026-07-28)

Reported as too dark and overwhelming on a phone; both were real.

- Measured 389 px of chrome above the headline at 375 px: a wrapped document nav, a three-line action bar and a six-chip language band — two of which were language controls. The document nav and the action bar now sit on one scrolling line each, the action bar is three across, and the six-script band is wide-screen only since the header already switches language. The headline moved from y=537 to y=290 and the call to action is above the fold.
- The dark theme was near-black (`#12181d`). It is now a warm slate (`#1e2529`) with visible rules and brighter accents: body text measures 7.9:1 and the headline 13.7:1, both above AAA.
- Ten clauses of legal text was an unreadable scroll. The commitment and why it matters stay open; how it is checked and permitted exceptions collapse into a native `<details>`. The standard page went from 11.2 screens to 6.6 on a phone, with no JavaScript involved.
- Recipient links on `/request` were bare text below the 24 px target size; they now use the same card treatment as the rest of the site.

Verified at 375 px across all six locales and eleven pages: no horizontal overflow, no undersized targets, no missing keys.

## Canonical content and redesign (2026-07-28)

The placeholder campaign is replaced by the real one from `docs/Каноническийпакеттекстовиправилпроекта.docx`: «Договор заранее» / Contract in Advance, slogan "Правила должны быть известны до голосования".

- Migration `004_campaign_content.sql`: `demands.document` separates the standard from the coalition agreement; `demand_translations` gains `rationale`, `verification`, `exceptions`; new `plan_items` and `portfolios` tables with translations. Seeded with 10 standard clauses, 5 coalition clauses, 11 first-100-days items, 18 portfolios and the canonical email/WhatsApp/social templates, in all six locales.
- New pages: `/standard`, `/coalition-agreement`, `/first-100-days`, `/government-model`, `/about`, `/methodology`. `/demands` now redirects to `/standard`.
- Each clause renders the commitment plus three fixed callouts — why it matters, how it is checked, permitted exceptions — always in the same order, so a reader can skim by position.
- The first-100-days plan renders as a day-range bar chart; the government model as a portfolio grid with the 18/4 caps as the page's only large numerals.
- Navigation is two-tier: documents in the header, and the three actions as a numbered bar (1 support, 2 write, 3 reply) in fixed order on every page.
- The appeal builder and preview now draw questions from the standard only, never from the coalition agreement.

**Found and fixed: the CSP blocks inline styles.** `style-src` has no `'unsafe-inline'`, so the browser discards `style` attributes entirely — `style.cssText` is empty even though the attribute is in the HTML. The timeline bars were silently rendering full width. They now use SVG presentation attributes, which CSP does not touch, with the RTL offset mirrored server-side. The CSP was not weakened.

Also fixed: number ranges such as `1–14` reordered to `14–1` in RTL until wrapped in `<bdi dir="ltr">`; Pico's `li` list-style defeated `list-style: none` set on the list.

**Translations: Russian is canonical and verbatim. Hebrew, Arabic, Yiddish, English and Amharic are machine-translated and unreviewed. Ukrainian is a high-quality implementation draft, not human-reviewed or launch-cleared; a named native Ukrainian legal/political reviewer must approve it before public launch** — see [docs/TRANSLATION-REVIEW.md](docs/TRANSLATION-REVIEW.md). This remains a blocking launch gate.

## Frontend pass (2026-07-28)

Fixed, each verified in a real browser at 320/375/768/1440 px in Hebrew, Arabic, Amharic and English:

- `/assets/app.css` and `app.js` were served at a stable URL with `max-age=86400`, so any deployed style change stayed invisible for 24 hours. They now live in `src/assets.ts` and are served at a content-hashed URL with `immutable`.
- The language switcher and the message-language select offered ISO codes (`HE`, `AM`). They now offer endonyms.
- `letter-spacing` and `text-transform: uppercase` were applied to every locale. Tracking severs the cursive joins in Arabic and neither Hebrew, Yiddish nor Ge'ez has case, so both are now gated to Latin and Cyrillic.
- The generated public-post textarea clipped its own content on mobile; `field-sizing: content` sizes all generated text to what it holds.
- The preview page presented seven identical buttons. Reaching the official is now the only filled button, the share targets are a secondary grid, and "I sent it" sits below a rule as a distinct confirmation.
- Header nav inherited Pico's `justify-content: space-between` and stranded its links at opposite edges.
- Language links, the disclosure summary, footer links and checkboxes were below the 24x24 px target size in WCAG 2.5.8.
- Home metrics carried a meaningless `aria-label` duplicating the site name.
- Added `color-scheme` and `theme-color` meta, a `prefers-reduced-motion` guard, and a visible `:focus-visible` ring.
- Design: palette, type scale, and a six-script masthead that doubles as the language switcher. No webfonts.

Verified: zero horizontal overflow at 320 px on every public page in every locale; no duplicate ids; no unlabelled form controls.

## Recent changes (2026-07-27)

- Migration `003_social_share.sql`: `recipients.social_handle`; `message_templates.channel` widened to include `social`; `request_actions.action_type` widened with `shared_x`/`shared_facebook`/`shared_whatsapp`/`shared_telegram`; localized social templates seeded.
- Fixed a seed defect: SQLite stores `\n` in a string literal verbatim, so every template body from `002_seed.sql` rendered its escape markers instead of line breaks. Migration `003` repairs existing and new rows in one `replace(body, '\n', char(10))` pass.
- Preview is a single native form with editable subject, email body, WhatsApp text and public-post text; the clicked submit button selects the action. The unused HTMX CDN and global boost were removed, while the copy control uses the same-origin hashed client asset.
- Upgrade path verified on a populated database: row counts preserved, `PRAGMA foreign_key_check` clean, `integrity_check` ok, `idx_actions_type` recreated, widened CHECK still rejects unknown action types.
- `render.yaml` targets `rafmeshutaf.org.il`; not yet deployed.

## July verification and gates (superseded)

The July verification (33 tests) and the July launch-gate list have been replaced by the "Verified 2026-10-24" and "Remaining launch gates" sections above.
