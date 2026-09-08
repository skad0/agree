# Action-only public flow (no registration / no counters)

Date: 2026-09-09. Status: **plan only**. Do not implement until the election stack is on `main` and product confirms the cut lines below.

## Goal

Visitors act (find people, prepare and open a message) without creating an account, verifying email, or seeing campaign progress counters. Keep the existing ask → directory → build → preview → action → result scheme. Do not store personal appeal text (already true). Prefer deletion of collection surfaces over new feature flags where safe.

## Current collection (inventory)

| Surface | What | Keep for action-only? |
| --- | --- | --- |
| `/:locale/support` + verify-email | Email (+ optional name/city), double opt-in → `supporters` | **Remove** from public nav/home CTA; gate off or retire routes |
| Home metrics strip | Live counts (supporters / generated / actions / responses) | **Remove** public counters; admin may keep ops stats |
| `generated_requests` | recipient, locale, demand IDs, public id (no appeal text) | **Keep** (needed for result link + aggregate actions) |
| `request_actions` | opened / copied / reported_sent / shared_* | **Keep** aggregates; stop surfacing totals publicly |
| `submitted_responses` | Reply text + submitter email + files | **Separate product call**: out of “registration/counter” scope; either keep as optional reply intake or schedule a later cut |
| Preview name/city/context | Template fill only, not persisted | **Keep** |
| Locale + CSRF cookies, theme localStorage | Preference / security | **Keep** |
| Turnstile | Bot gate on forms that remain | **Keep** on remaining POSTs |
| Privacy delete + erasure ledger | Erasure for historical PII | **Keep** while any email/PII tables remain; shrink after support/responses removed |

## UX alignment (without breaking the scheme)

1. **Home / journey strip.** Drop step “1 Support” as a required beat. Journey becomes Discover → Ask → (optional) Reply later if responses stay. Primary CTA stays `/:locale/request`.
2. **Nav.** Remove or demote Support. Keep Request, documents, privacy, methodology.
3. **Copy.** Remove “join / register / count of supporters” framing. Speak in actions: find people, open your own channel, report if you sent.
4. **Directory → build → preview → action → result.** Unchanged route contracts and sequential multiselect handoffs. Result page still uses public request id; social share stays aggregate-safe.
5. **Admin.** Retain campaign kill switches and stats for operators. Public pages must not depend on supporter counts for layout.

## Suggested implementation slices

1. **Public surface cut.** Hide/remove support CTA and home counters; `support_enabled` false by default in seed/settings; 404 or soft-disable public support routes when off. Tests for home/nav. No schema drop yet.
2. **Copy + journey chrome.** Locale strings and journey intro without registration language. Translation review still required for political text elsewhere.
3. **Data retirement (later).** Stop writing new `supporters` / verifications; retention already ages inactive rows. Optional migration to drop tables only after admin export and privacy review.
4. **Responses (optional later).** If “no user data” means no reply intake either, plan a separate cut: disable responses campaign flag, drain object work, then retire routes. Do not bundle with slice 1.

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
