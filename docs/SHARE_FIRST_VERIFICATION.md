# Share-first implementation and verification

Date: 2026-09-19. Branch: `codex/share-first`. Implementation commit: `012eb1a`. Local implementation complete; **not deployed; no production candidate activation**.

## Baseline and scope

Pre-existing candidate work and the plan were preserved in checkpoint `aee7690` on `codex/share-first-checkpoint`, based on main `ca7f69c`. No branch/worktree was reset or deleted. Neither PR #7 nor PR #1 was merged; the checkpoint's full-name importer was adapted directly. Branch inventory: [the plan](SHARE_FIRST_PLAN.md).

Implemented: ten problem cards and issue pages; social/copy/native controls; three-link navigation; seven locales; preview metadata/assets; retired appeal writes and paused intake; historical result/privacy access; snapshot-isolated candidate directory; official-source refresh; updated policy/specification/operations docs. No new runtime dependencies or hosting changes.

## Automated checks

| Check | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm test` | **116 passed, 0 failed** after public-copy cleanup |
| `npm run smoke:pages` | Pass, including new pages, locales, documents, redirects, paused intake, privacy and Access denial |
| `npm run smoke` | Pass on an isolated compiled server; fetch follows legacy redirects |
| `git diff --check` | Pass; line-ending normalization notices only |

Coverage includes 70 localized issue routes, no share writes, retired writes even with enabled old flags, historical fallback/private caching, source validation, draft isolation, idempotent import including timestamp/order changes, activation/rollback, unknown/submitted status, pagination and Hebrew originals, seven PNG dimensions/content types/size limits, canonical/alternate metadata.

Clipboard/native failure and cancellation tests execute the actual shared client script with controlled API doubles. Legacy submission modules are registered only in an isolated test harness for historical storage/privacy regressions; production does not expose those routes.

## Browser evidence

Codex in-app Chromium, isolated local server, in-memory database with refreshed candidates:

- Desktop English: two-column cards, consistent header/footer and readable hierarchy.
- All seven homes at 320px: ten cards, correct LTR/RTL, no horizontal overflow (305px content width with scrollbar), all three primary links 44px tall.
- Hebrew and Amharic mobile layouts visually inspected; Amharic glyphs render with the bundled font.
- Enter/Space opens Share with visible focus. Copy produces localized live feedback. Exact payload, permission failure and URL selection are additionally covered by client-script tests.
- Script-free fixture: zero script elements; keyboard skip link focuses `main`; disclosure, selectable URL and four platform links work; copy/native buttons stay hidden.
- Mobile directory: submitted-not-approved notice, checked date, 38/38 coverage, Hebrew originals. Searching the Shama candidate returned one row; English→Hebrew preserved the filter and result.
- Light/dark controls checked. Fixed a summary contrast bug found during QA. Computed colors: white on `#0038b8` in light; `#0f1826` on `#6ea3f5` in dark. Dark platform controls use `#6ea3f5`.
- No console warnings/errors during the checked enhanced flow. Hebrew/Amharic PNGs visually inspected; all seven served and dimension-checked in tests.

No social post, email or third-party submission was sent during verification.

Follow-up public-copy review: removed unfinished funding text and unsupported disclosure claims from About in all locales, moved retired-workflow context out of Methodology, and clarified document introductions as proposals. Missing/example contacts no longer render; production rejects reserved example/test addresses. A regression scan covers 20 public routes in every locale with missing, example and marker contacts. Historical privacy/retention/deletion information remains. English/Hebrew About, Methodology and Privacy were checked again in the refreshed browser preview.

Environment preparation for main: development/start/database-operation npm commands now load optional `.env`, with injected process variables taking precedence. Verified using a temporary environment file and an isolated server running the actual start-command arguments. Local proxy trust defaults to blank; Render retains Cloudflare trust, one persistent disk, secret injection and HTTPS base URL. Both templates explicitly select election 26 with automatic ETL/scheduling disabled. The live privacy page exposes a non-placeholder contact compatible with validation; Render's dashboard required sign-in, so live secret settings were not inspected or changed. Typecheck, 116 tests and page smoke pass. The configured high/critical dependency-audit threshold passes; npm still reports two moderate vulnerable packages (`hono`, `@hono/node-server`), outside this environment-only follow-up.

## Remaining release checks

These are **not completed**:

1. Named human review of new questions/UI/policy prose in all seven languages, including Russian drafts. See [translation status](TRANSLATION-REVIEW.md).
2. NVDA/VoiceOver/TalkBack, real 200% browser/text zoom, forced colors and touch-device testing. Browser/DOM checks above are not a complete accessibility audit.
3. Actual iOS/Android share sheets and clipboard permission behavior. Tests cover API outcomes, not OS integrations.
4. External crawler previews on a deployed staging/public URL. Local metadata/PNG checks cannot establish platform rendering or caches.
5. Production backup/deploy review, staging import and deliberate activation. Review [the source diff](CANDIDATE_REFRESH_2026-09-19.md); approval remains pending at the official source.

Next efficient step: one bounded release-verification pass using this report and the current spec. Resolve review/device/staging checks, then deploy code and activate the reviewed snapshot separately. No architecture rewrite or alternate importer merge is needed.
