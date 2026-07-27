# Project Status — Civic Platform (agree)

_Last updated: 2026-07-27 (+03)_

## Current state

The Hono/TypeScript MVP is implemented in the working tree with SSR JSX/HTMX, Pico CSS, SQLite WAL, six locales, Render configuration, tests, and operational documentation. It starts without third-party configuration at the application layer; admin fails closed and credential-dependent actions degrade as documented.

Work is committed on `main` in four focused commits (MVP implementation, docs, Render config, status). Orchestrator verified independently outside the build sandbox: `npm test` 10/10, `npm run typecheck` clean, and `npm run smoke` — a real keyless TCP server start serving all locale/public pages with 200 and `/admin` 403.

## Implemented

- E0: Hono Node server binds `0.0.0.0:$PORT`; 14-table migrations, foreign keys, WAL, NORMAL sync, 5s busy timeout, `/health`, 5 GB `/data` Render disk, one instance.
- E1: six locale dictionaries/routes; cookie/Accept-Language selection; equivalent language links; correct `lang`/`dir`; logical responsive CSS; explicit missing-translation state.
- E2: DB-seeded localized demands/recipients/templates, home/demands pages, separate aggregate counters, short public cache headers.
- E3: support form, CSRF/Turnstile/rate checks, normalized unique email, expiring hashed verification tokens, Resend delivery, keyless development link, exactly-once verified count.
- E4: localized recipient/demand builder and templates, preview, email/WhatsApp/copy/report-sent actions, public posting to X/Facebook/WhatsApp/Telegram, editable generated text, share result, separate action metrics, no personalized message storage.
- E5: response form/moderation state, date/text/email validation, 10 MB limit, MIME magic-byte validation, in-memory S3/R2 streaming, DB metadata, admin-only download.
- E6: Cloudflare Access JWKS issuer/audience JWT validation, 403 without credentials/token, demand/recipient/template management, response moderation, stats/supporter CSV, audit transaction for every mutation, form/recipient/campaign kill switches.
- E7 application work: strict CSP/HSTS/security headers, body limits, CSRF, optional Turnstile, rate limits, six privacy pages, confirmed data deletion/anonymization, external daily/weekly SQLite backup, integrity-checked restore, semantic/keyboard-friendly markup and skip link.
- Docs/deploy: `README.md`, `.env.example`, `docs/SECRETS.md`, `render.yaml`, backup/restore/load/smoke scripts.

## Recent changes (2026-07-27)

- Migration `003_social_share.sql`: `recipients.social_handle`; `message_templates.channel` widened to include `social`; `request_actions.action_type` widened with `shared_x`/`shared_facebook`/`shared_whatsapp`/`shared_telegram`; localized social templates seeded.
- Fixed a seed defect: SQLite stores `\n` in a string literal verbatim, so every template body from `002_seed.sql` rendered its escape markers instead of line breaks. Migration `003` repairs existing and new rows in one `replace(body, '\n', char(10))` pass.
- Preview is now a single native form with editable subject, email body, WhatsApp text and public-post text; the clicked submit button's value selects the action, so `hx-boost` is disabled on that form only.
- Upgrade path verified on a populated database: row counts preserved, `PRAGMA foreign_key_check` clean, `integrity_check` ok, `idx_actions_type` recreated, widened CHECK still rejects unknown action types.
- `render.yaml` targets `rafmeshutaf.org.il`; not yet deployed.

## Verification completed

- Clean offline frozen install from the existing npm cache: 7 packages installed, exit 0.
- `npm test`: 12/12 integration tests pass, exit 0.
- `npm run typecheck`: exit 0.
- `npm run build`: exit 0.
- `npm audit --offline --omit=dev`: 0 vulnerabilities, exit 0.
- `env -i PATH="$PATH" npm run smoke:pages`: all six locale homes and main keyless pages returned 200; `/admin` returned 403, exit 0.
- S3 upload, Access JWT/JWKS, backup/restore, deletion, audit, dedup, and no-personal-text invariants are exercised with local deterministic fakes (no provider credentials).

## Remaining launch gates / environment blockers

- Chrome DevTools MCP is not configured, so Lighthouse ≥95, axe zero serious/critical, console, focus order, and 320/768/1024/1440 visual checks are unverified.
- `npm run load` (staging p95/error/load targets) has not been run against a deployed instance.
- Real Cloudflare Turnstile/Access, R2, Resend, external backup bucket, Cloudflare cache/WAF, Render persistence across redeploy, and live restore require credentials/infrastructure and remain unverified.
- Political/legal/privacy translations require human review before launch, including the six social-share strings and social templates added on 2026-07-27.
- Share deep links (X, Facebook, WhatsApp, Telegram) are asserted in tests but have not been opened against the live platforms.
- Deploy to Render and verify the live service (Render MCP not connected in this session).

## Key deployment decisions

- Render paid Starter web service, single instance, persistent disk at `/data`, SQLite at `/data/app.db`.
- Cloudflare caches only public GET/assets and protects `/admin*`; origin independently validates Access JWTs.
- Response files and backups use private S3-compatible buckets; no binary blobs are written to the app disk.
- Missing third-party keys never prevent health/public-page startup. Access fails closed; file/email/backup-dependent operations report unavailable or remain disabled.
