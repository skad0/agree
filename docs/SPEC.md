# Problem-first sharing specification

Current implementation contract, 2026-09-19. Product decisions: [SHARE_FIRST_PLAN.md](SHARE_FIRST_PLAN.md). Previous design: [historical specification](archive/ACTION_FIRST_SPEC.md).

## Experience

Read a problem → expand Share → choose a platform or copy its stable link. Opening the detail page is optional. Candidates are optional context, never a prerequisite. No account, personal message editor, email address, recipient picker, action counters, or automatic posting is part of this flow.

Ten fixed issue slugs map to existing standard demand IDs 1–10. Questions are in `src/issue-headings.ts`; commitments, rationale, verification and exceptions use the existing localized canonical content. Proposals must not be presented as candidate promises. Missing/disabled issues return 404; paused campaigns return 503 with a privacy recovery link.

Problems, Candidates, About appear in the same header order everywhere. Documents, methodology, privacy and appearance remain in the footer. Hebrew, Arabic and Yiddish use RTL. Directory names remain in their original Hebrew, marked with language and bidirectional isolation. Language switching preserves the issue or validated directory filters.

## Sharing

- One native HTML disclosure shows a selectable URL, explanation and named WhatsApp, Facebook, Telegram and X links. These work without client JavaScript. Facebook receives the URL only.
- Enhancement adds Copy link and, when supported, More apps. Copy failures focus/select the URL; native-share cancellation is silent; other failures announce a recoverable message. Opening an app is never called successful publication.
- No share event writes to SQLite, analytics request or personal draft storage. The external platform controls its own editor and posting confirmation.
- Home and issue pages render absolute canonical/Open Graph/Twitter metadata and seven language alternates. Locale-specific 1200×630 PNG assets are hashed and anonymously accessible. Preview text is issue-specific; the image identifies the project.

## Public route contract

| Route | Behavior |
| --- | --- |
| `GET /:locale` | Ten problem cards; share directly from each card |
| `GET /:locale/issues/:slug` | Explanation, proposed commitment, share, optional verification/exceptions |
| `GET /:locale/candidates` | Active snapshot only; search, list filter, 20-row pagination |
| `GET /:locale/scorecard` | Civic accountability matrix for Shared Threshold criteria with verified Knesset/HCJ evidence, filters, pledge banner and share metadata |
| `GET /:locale/request`, `/request/build` | 302: known demand → issue; known recipient → directory with retirement notice; otherwise home |
| `POST /:locale/request` and `/selection`, `/review`, `/build`, `/suggest`, `/preview`, `/action`, `/copy`, `/report-sent` | 410, no writes, independent of old feature flags |
| `GET /:locale/request/result?request=…` | Historical recipient/issues; private/no-store, noindex, no share metadata |
| `/:locale/responses`, `/responses/new`, `/responses/thanks`, `/support` | 503 for all methods; new intake paused |
| `GET /:locale/standard`, `/coalition-agreement`, `/first-100-days`, `/government-model`, `/about`, `/methodology`, `/privacy` | Documents with current navigation and sharing links |
| `GET /:locale/demands` | 301 to the standard |
| `/:locale/delete-data`, `/verify-email` | Historical deletion/verification retained |
| `/admin/*`, `/health` | Existing Access-protected operations and health retained |

Home/issue reads use the short public cache. Locale preference requests set cookies and are private/no-store. Filtered candidate pages and historical results are private/no-store and noindex. Errors are no-store. Hashed assets are immutable.

## Candidate publication

`data/elections/knesset-26-lists.json` transcribes the official 26th Knesset source. The September 19 snapshot contains 38 lists and 1,379 rows, all rosters available. It is **submitted, not approved**. Do not infer approval from roster existence or contactability.

Import validates election/schema, official HTTPS provenance, list identities, strict roster flags, row references, unique contiguous ranks and declared counts. An approved transcript requires an explicit official evidence URL and operator review. Duplicate normalized content is a successful CLI no-op even when the retrieval timestamp changed.

Migration 021 adds snapshot metadata and list versions. Public candidate fields come from one active snapshot. Activation atomically switches the pointer; activating an older validated publication rolls back data. Neither changes contact recipients. Pre-021 publications require a reviewed re-import before appearing in the new directory. Page requests never fetch external sources. Automatic ETL remains disabled.

See [operations](ELECTION_DATA_OPERATIONS.md) and [source diff](CANDIDATE_REFRESH_2026-09-19.md).

## Architecture and privacy

Hono SSR/TypeScript, small same-origin enhancement, Pico CSS, SQLite WAL on one Render disk. CSP still disallows inline scripts/styles; no new runtime dependencies. Keep historical request, response, privacy and attachment tables and maintenance jobs.

Sharing creates no records. Historical appeals/actions and replies retain their existing 12-calendar-month policy; supporter records retain the existing 24-month inactivity policy. Historical deletion may send a confirmation email when configured. No personal appeal text is persisted. Admin authentication, private downloads, erasure ledger, restore and retention protections remain intact.

## Verification and release

Run typecheck, complete tests, isolated server smoke and route smoke. Public retirement contracts have separate tests from the retained legacy storage/component harness. Browser checks cover reflow, direction, keyboard access, feedback and themes. Full assistive-technology testing, device-native share sheets, language approval and external crawler previews remain explicit release checks; do not infer them from HTTP tests. See [verification](SHARE_FIRST_VERIFICATION.md).

Deployment and data activation are separate operations. Back up the production database first, keep automatic ETL off, review the diff, import a draft, then deliberately activate. Code rollback and publication rollback are distinct operations.
