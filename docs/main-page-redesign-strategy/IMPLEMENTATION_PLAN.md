# Main-page redesign implementation plan

## Scope and non-negotiables

This plan records the supplied prototype’s 20-screen, ask-first public flow for the existing server-rendered Hono/JSX application. The source bundle is intentionally not versioned here; it explicitly left admin untouched. The redesign is the default application state: deploy it normally and use ordinary deployment or git rollback if needed; do not build or retain a legacy UI/campaign feature gate. The implementation must preserve every current URL, form security check, privacy invariant, locale, theme choice, and aggregate metric unless a compatibility redirect or an explicit product decision is recorded.

The prototype is not evidence that missing content or recipient metadata exists. In particular, current migrations seed 89 politician rows with Hebrew names only, while the prototype expects richer names, parties, regions, roles, portraits, and recipient groups. Those are coverage/data-work items, not values to infer in code.

## Route and surface reconciliation

| Prototype frame/capability | Existing route and source | Implementation treatment |
| --- | --- | --- |
| 01–02 Home, English/RTL Hebrew | `/:locale`, `src/public.tsx`, `src/layout.tsx` | Replace the home body with the ask action and supported suggestions; keep locale negotiation, all seven locale URLs, language switching, CSP-safe hashed assets, and aggregate-only counts. |
| 03 Letter hub | `/:locale/request/preview`, `src/requests.tsx` | Keep the route and generated-request capability; make the default path reachable from home, retain edit/copy/share/open-email actions, and never persist appeal text. |
| 04 Recipients panel | `/:locale/request`, `/:locale/request/build`, `src/requests.tsx` | Retain URLs (including old links), change presentation and selection semantics; add only verified recipient filters/groups and explicit limits after schema/data validation. |
| 05 Wording panel | `/:locale/request/build`, `src/requests.tsx` | Keep route and CSRF/Turnstile/rate-limit checks; expose standard questions with safe defaults and preserve locale-specific templates. |
| 06 Sent | `/:locale/request/result` plus request action routes | Preserve public request IDs, retention, sharing, and aggregate action accounting. Do not silently merge supporter registration into this route: current `/support` is a separate verified-email flow and remains available. |
| 07–08 Standard/index and clause | `/:locale/standard`, `src/content.tsx`; no `/:locale/standard/:n` today | Keep index; add the clause route only if deep links, numbering, missing translations, and migration-backed IDs are specified. Preserve `/demands` 301 compatibility. |
| 09 Submit a reply | `/:locale/responses/new`, `/responses`, `/responses/thanks`, `src/responses.tsx` | Visual redesign only initially; preserve email consent, attachments, nonce/idempotency, object-storage lifecycle, moderation status, and confirmation route. |
| 10–12 Coalition, 100 days, government model | `src/content.tsx` and campaign-content migrations | Preserve existing data-driven clauses, plan SVG geometry, RTL day ordering, portfolios, and all locale fallbacks; redesign the index/card/carousel presentation without inventing facts. |
| 13–14 About/methodology | `/:locale/about`, `/:locale/methodology`, locale JSON, `src/content.tsx` | Retain routes and neutrality copy. Resolve only documented content gaps (the handoff calls out an about placeholder) through content review, not UI code assumptions. |
| 15 Support | `/:locale/support`, `/verify-email`, `src/support.tsx` | Keep as a footer/secondary route, not step 1. Preserve verification states, email delivery behavior, consent, rate limits, and supporter retention. |
| 16 Verify email | `/verify-email`, `src/support.tsx` | Keep non-locale-prefixed URL and sent/confirmed/expired behavior; test each state in every supported originating locale where applicable. |
| 17 Reply submitted | `/:locale/responses/thanks`, `src/responses.tsx` | Keep route and no-store behavior; restyle only. |
| 18–19 Privacy/delete | `/:locale/privacy`, `/:locale/delete-data`, `src/privacy.tsx` | Keep tokenized deletion, erasure ledger, bounded deletion, attachment cleanup, and retention language. A retention table/receipt requires content and policy confirmation before implementation. |
| 20 Unavailable/not found | `app.tsx` not-found/error handling and route-local `statusPage` helpers | Add a consistent localized status shape while preserving status codes and kill switches. Test 404, disabled campaign, invalid form, rate-limit, and storage failures. |
| Admin | `/admin`, `/admin/{demands,recipients,templates,supporters,responses,audit,settings}`, exports/files in `src/admin.tsx` | Out of prototype scope and must remain functional. Do not apply public step chrome to admin; preserve admin/moderator authorization, CSRF, audit redaction, exports, and private/no-store responses. |
| Health/assets/theme | `/health`, hashed CSS/JS/theme/font routes in `src/app.tsx`, `src/public.tsx`, `src/assets.ts` | Preserve operational endpoint, same-origin hashed assets, render-blocking theme bootstrap, Amharic font scoping, and CSP. |

### Existing public route inventory

The implementation must exercise these exact route patterns, including methods, rather than treating a screen label as a replacement for a URL:

* `/` redirects to the negotiated locale; `/:locale` renders home.
* `/:locale/request`, `/:locale/request/build`, `POST /:locale/request/preview`, `POST /:locale/request/action`, `POST /:locale/request/copy`, `POST /:locale/request/report-sent`, and `/:locale/request/result` comprise the current request flow.
* `/:locale/support`, `POST /:locale/support`, `/verify-email`, and `POST /verify-email` comprise support and verification.
* `/:locale/responses/new`, `POST /:locale/responses`, and `/:locale/responses/thanks` comprise reply intake.
* `/:locale/standard`, `/:locale/coalition-agreement`, `/:locale/first-100-days`, `/:locale/government-model`, `/:locale/about`, `/:locale/methodology`, and compatibility `/:locale/demands` comprise content.
* `/:locale/privacy`, `/:locale/delete-data`, and `POST /:locale/delete-data` comprise privacy and erasure.
* Hashed CSS/JS/theme/font assets and `/health` remain operational routes. Unknown paths retain the application’s 404 behavior.

Any new `/:locale/standard/:n` or other prototype-only route is additive; existing URLs must not be repurposed in a way that breaks bookmarked forms, public request IDs, verification links, admin links, or deletion links.

## Reconciled architecture findings

### Default deployment and staged implementation

Ship the redesign as the default public application state through the normal deployment path. Use ordinary deployment or git rollback for recovery; do not retain a legacy renderer or campaign feature-version gate. Implementation can still proceed in vertical slices: start with one locale and one **single-recipient** ask path, then expand to the remaining supported locales and only later to multi-recipient/group delivery after route, privacy, delivery-claim, and data-quality gates. Admin URLs, roles, moderation, exports, settings, audit, and protected files are not part of the public visual change and must remain functional throughout.

### Draft-text boundary

The ask-first question and generated letter are transient presentation data. Do not persist personal draft/question/context text, generated body, subject, or edits in SQLite, URL/query/fragment state, cookies, localStorage, sessionStorage, server session state, analytics payloads, logs, audit payloads, HTMX attributes/headers, or any other client/server transport beyond the request needed to render or hand off the user-controlled message. Generated-request records may retain only the existing operational fields: recipient identifier(s) approved for that version, locale, demand identifiers, public identifier, timestamps, and aggregate action types. External mail/share URLs are a user handoff, not a storage mechanism; minimize their contents to what the provider requires.

### Truthful action language

“Opened email”, “opened WhatsApp”, “copied text”, and “reported sent” are user/browser actions or self-reports. They do not prove delivery, receipt, reading, or response. UI, metrics, methodology, and admin labels must say “opened”, “copied”, or “reported sent” and must not claim that a recipient received the message. The product does not send on the user’s behalf. A sent/result page may confirm the user’s report and provide sharing, but must not imply delivery.

### Recipient data gate and rollout order

Before any default set, faction button, count, region, role/committee filter, portrait, or group send is exposed, define the recipient taxonomy (party/faction, politician, office/group, region, role/committee), the default-set rule, the authoritative source, snapshot/update date, provenance shown to users, locale coverage, inactive-history behavior, and an admin correction/audit process. A prototype example is not source data. The first production slice is one recipient and one approved demand set; multi-recipient and group delivery follow only after delivery-proof wording, basket limits, channel behavior, and privacy review are complete.

### Additive migration and compatibility outline

If approved, add migrations rather than rewriting existing tables in place: (1) recipient taxonomy/group membership with source/provenance and effective dates; (2) localized recipient metadata only where authoritative translations exist; and (3) bounded operational selection fields only if required by the new flow. Backfill only from verified source data, leave unknown fields nullable, and preserve existing IDs, `/:locale/request*` contracts, public IDs, retention indexes, and old records. New code must read old rows safely and make ordinary deployment/git rollback possible without deleting or reinterpreting existing data. No migration may add a personal draft-text column.

### Public-response claim boundary

The prototype’s suggestion that a “public” letter gets an answer is not an existing capability. Remove that claim from the public redesign and copy. `/responses/new` is private intake; submitted text and attachments remain non-public until the existing moderation process and a separately approved publication feature exist. Do not add publication, public response URLs, or response indexing as part of this redesign.

### Scoped visual change

Apply prototype visuals only to public supporter-facing pages and their shared public shell/assets. Keep `src/admin.tsx`’s separate `Shell`, wide tables, authorization, audit redaction, exports, settings, and moderator restrictions operational and visually usable; do not make admin depend on public deployment state. Preserve all seven locales, RTL/LTR behavior, existing hashed theme bootstrap, light/dark/system choice, and Amharic font scoping. Heebo/IBM Plex Mono in the prototype are design references, not permission to bypass the existing CSP-safe font strategy.


## Vertical slices

### Slice 0 — contract and fixture lock

* **Work:** Record the current route matrix above in route tests; inventory every translation key and seeded content row; decide whether the prototype’s “after send” supporter prompt is a separate optional step or only a visual claim. Confirm recipient selection limits and the source for party/region/role/portrait data.
* **Likely files:** `test/app.test.ts`, route modules under `src/`, `src/i18n.ts`, `migrations/001–015` (read-only until decisions are approved).
* **Dependencies:** product/content/privacy decisions; no visual implementation dependency.
* **Acceptance:** existing public/admin routes, seven locales, RTL direction, theme assets, kill switches, and privacy tests remain green; no unsupported prototype data is added.

### Slice 1 — shared shell and home ask-first entry

* **Work:** Build the prototype chrome in `Layout`/`Shell` and CSS assets: two-tone top rule, header/footer links, locale control, one primary action, focus states, logical properties, and 390px/720px/1080px breakpoints. Replace only the home content with the ask action, supported suggestions, and a safe request journey path.
* **Likely files:** `src/layout.tsx`, `src/public.tsx`, `src/assets.ts`, locale JSON files, `src/requests.tsx` if the POST contract changes, `test/app.test.ts`.
* **Dependencies:** Slice 0; existing CSP/theme contract; content translations for every locale.
* **Acceptance:** `/`, `/:locale`, and language switches work; English and Hebrew desktop/mobile match the supplied states; all seven locales render without missing keys; no personal question text is stored; home remains usable with no recipients/counts.

### Slice 2 — letter hub and send handoff

* **Work:** Make the generated letter the single hub, with defaults, recipient summary, standard-question inclusion, edit/copy/share/direct-contact actions, and a clear “we do not send/store your words” explanation. Preserve capability binding, CSRF, Turnstile, rate limits, request public IDs, action aggregates, and retention.
* **Likely files:** `src/requests.tsx`, `src/i18n.ts`, `src/assets.ts`, `test/app.test.ts`, `test/request-public-id.test.ts`, `test/request-retention.test.ts`.
* **Dependencies:** Slice 1; confirmed template/channel behavior; no new personal-text persistence.
* **Acceptance:** one click from the approved home flow reaches a complete preview; direct contact still opens the user’s program; all existing action types and report-sent behavior work; generated rows contain only recipient/locale/demand identifiers and timestamps/public IDs.

### Slice 3 — recipient and wording panels

* **Work:** Add search, party/group, region, role/committee disclosure, basket state, personal limit, all-party/group action, and wording selection. Use only fields backed by approved data. Keep old `/request` and `/request/build` links valid and ensure panels return to the hub without losing safe state.
* **Likely files:** `src/requests.tsx`, `src/admin.tsx` (only to expose approved metadata if needed), new migration(s) after approval, recipient/content tests.
* **Dependencies:** Slice 2; authoritative recipient source; schema decision for party/region/role/portrait and translated names; acceptance of group semantics.
* **Acceptance:** filters are truthful and empty states are explicit; selected recipients obey the approved limit; RTL basket/bar mirrors; no recipient choice is linked to supporter identity or appeal text.

### Slice 4 — documents, clause detail, and 100-day presentation

* **Work:** Shape standard as an index plus optional clause detail, and present plan items as the prototype’s carousel while retaining server-side SVG geometry and accessible non-JS operation. Preserve coalition/model routes and canonical numbering.
* **Likely files:** `src/content.tsx`, `src/layout.tsx`, `src/assets.ts`, locale JSON, content route tests.
* **Dependencies:** Slice 0 content inventory; decision on `/:locale/standard/:n`; complete translations where a screen is promised.
* **Acceptance:** every existing document route and `/demands` compatibility route works; day ranges remain LTR in RTL; clause/body/rationale/verification/exceptions are not lost; no inline style violates CSP.

### Slice 5 — secondary states and privacy-safe support

* **Work:** Apply the shared visual language to support, verification, reply intake/thanks, privacy, deletion, unavailable, and not-found states. Add only policy-approved retention table/receipt copy and preserve the erasure ledger flow.
* **Likely files:** `src/support.tsx`, `src/responses.tsx`, `src/privacy.tsx`, `src/app.tsx`, locale JSON, `test/privacy*.test.ts`, `test/support.test.ts`, `test/perimeter-attachment.test.ts`, `test/erasure-ledger.test.ts`.
* **Dependencies:** legal/privacy/content approval; existing provider configuration and attachment lifecycle.
* **Acceptance:** email is requested only where the product policy permits it; deletion is confirmed by verified email, bounded, auditable, and retries safely; response text/files remain private and moderated; all disabled/error states retain correct status codes.

### Slice 6 — regression, accessibility, and release gate

* **Work:** Expand route/locale/state tests, run compiled tests and smoke pages, inspect CSP/theme headers, and manually verify English/Hebrew at 390px plus representative LTR/RTL desktop states. Check admin separately for unchanged access and data surfaces.
* **Likely files:** `test/*.test.ts`, `scripts/pages-smoke.ts`, `src/assets.ts`, documentation of approved fixtures.
* **Dependencies:** all prior slices; stable seed/fixture data.
* **Acceptance:** `npm run typecheck`, `npm test`, `npm run smoke`, and `npm run smoke:pages` pass; route matrix has no accidental removals; keyboard focus, no-JS details/forms, reduced motion, safe-area sticky bars, numeric isolation, and theme persistence are covered.

## Design-to-code guardrails

Use server-rendered HTML and the existing hashed same-origin asset pattern. Do not add inline scripts/styles, external prototype fonts, or data-driven CSS style attributes. Use logical CSS properties and server-side SVG geometry where values are data-driven. Keep one filled primary action per screen, but treat that as presentation—not permission to remove existing secondary actions, moderation controls, or privacy disclosures.
