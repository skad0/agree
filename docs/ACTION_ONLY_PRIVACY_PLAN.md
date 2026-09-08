# Action-only public flow (no registration / no counters)

Date: 2026-09-09. Status: **implemented (slice 1–2 + backup cut)**. Election stack is on `main`. Later slices (supporter table drop; optional responses retirement) remain deferred.

## Goal

Visitors act (find people, prepare and open a message) without creating an account, verifying email, or seeing campaign progress counters. Keep the existing ask → directory → build → preview → action → result scheme. Do not store personal appeal text (already true). Prefer deletion of collection surfaces over new feature flags where safe.

## Current collection (inventory)

| Surface | What | Keep for action-only? |
| --- | --- | --- |
| `/:locale/support` + verify-email | Email (+ optional name/city), double opt-in → `supporters` | **Removed** from public nav/home CTA; `support_enabled` defaults off; routes soft-disable when off |
| Home metrics strip | Live counts (supporters / generated / actions / responses) | **Removed** from public pages; admin keeps ops stats |
| `generated_requests` | recipient, locale, demand IDs, public id (no appeal text) | **Keep** (needed for result link + aggregate actions) |
| `request_actions` | opened / copied / reported_sent / shared_* | **Keep** aggregates; not surfaced as public totals |
| `submitted_responses` | Reply text + submitter email + files | **Deferred**: still optional reply intake |
| Preview name/city/context | Template fill only, not persisted | **Keep** |
| Locale + CSRF cookies, theme localStorage | Preference / security | **Keep** |
| Turnstile | Bot gate on forms that remain | **Keep** on remaining POSTs |
| Privacy delete + erasure ledger | Erasure for historical PII | **Keep** live SQLite deletion; **no** remote S3 ledger in the deploy |
| External `BACKUP_S3` / R2 / ledger buckets | Object storage | **Cut** from deploy — Render disk only |

## UX alignment (without breaking the scheme)

1. **Home / journey strip.** No Support step. Journey is Ask → (optional) Reply. Primary CTA stays `/:locale/request`.
2. **Nav.** Support removed from the actions bar. Keep Request, documents, privacy, methodology.
3. **Copy.** Action framing: find people, open your own channel, report if you sent. No public “join / register / count of supporters”.
4. **Directory → build → preview → action → result.** Unchanged route contracts and sequential multiselect handoffs.
5. **Admin.** Retain campaign kill switches and stats for operators.

## Implementation slices

1. **Public surface cut.** Done: hide support CTA and home counters; `support_enabled` false by default (migration `018`); soft-disable public support when off.
2. **Copy + journey chrome.** Done: locale/home/nav without registration language (non-English long privacy/about/methodology strings temporarily match English pending translation review).
3. **Data retirement (later).** Stop writing new `supporters` / verifications when support stays off; retention already ages inactive rows. Optional migration to drop tables only after admin export and privacy review.
4. **Responses (optional later).** Separate cut if reply intake must go too.

## Deployment / backup reflect

- Do **not** configure `BACKUP_S3_*`, `R2_*`, or `ERASURE_LEDGER_S3_*` for production.
- Persistence is the Render `/data` disk (and Render disk snapshots as the host offers them).
- Privacy deletion updates live SQLite without a remote ledger.
- Reply file uploads stay unavailable without object storage; text replies remain.
- Legacy CLI helpers may still exist in-tree; they are not part of the deploy contract.

## Non-goals

- Do not remove CSRF, rate limits, or Turnstile on remaining forms.
- Do not put appeal text into URLs, cookies, or SQLite.
- Do not replace the Hono SSR flow with a SPA or third-party auth.
- Do not auto-enable election ETL or publication as part of this privacy cut.

## Acceptance

- Visitor can complete discovery → multiselect → sequential send without email or support signup.
- Home shows no supporter/action counters.
- Existing `?recipient=` and result links still work.
- Admin can still disable requests/responses; typecheck/tests/smoke green.
- SPEC/README/privacy policy updated to match what is actually collected.
