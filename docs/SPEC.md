# Civic Collective Request Platform — Implementation Specification

Source: `docs/civic-platform-implementation-plan.html` (Russian PRD → implementation plan). This document is the builder-facing English spec.

---

## 1. Product Summary

The **Collective Civic Request Platform** enables citizens to coordinate around shared demands directed at political parties and individual politicians. The platform does **not** monitor politicians, guarantee responses, or send mail on users' behalf. The public funnel is **action-only**: **discover recipients → generate a personal appeal → send it via the user's own channels → optionally submit any reply received back to the campaign**. Account/email support signup and public progress counters are off by default (see [ACTION_ONLY_PRIVACY_PLAN.md](ACTION_ONLY_PRIVACY_PLAN.md)).

**Primary users:** (1) **Visitors** — browse demands in their language, pick a recipient (including directory multiselect), compose a localized message from templates, open mailto/WhatsApp or copy text, mark "I sent it", and optionally submit received responses for moderation — without creating an account. (2) **Administrators** — manage campaign content, recipients, templates, translations, moderation queue, exports, and kill-switches; authenticated via Cloudflare Access (SSO + mandatory 2FA), not a custom login system.

**Core flows:** (A) **Appeal flow** — choose party/politician (official public contacts only) → select demand items + optional personalization → preview (email subject/body + short WhatsApp version) → action (mailto / WhatsApp deep link / copy) each logged separately → optional "I sent it" → share buttons. (B) **Response flow** — submit received reply (recipient, date, channel, text, optional file ≤10 MB, submitter email, consent) → moderation queue; nothing auto-published. (C) **Support flow** — gated behind `support_enabled` (default off); not linked from public nav/home. Public pages do **not** show supporter/generated/sent/response counters; admin may still view aggregates.

**MVP success hypothesis:** visitors will send personal appeals, spread the campaign, and return verifiable party responses without registration friction.

---

## 2. Recommended Tech Stack

**From the plan (mandated for MVP):**

| Layer | Choice |
|-------|--------|
| Runtime | Node.js, TypeScript |
| HTTP / SSR | **Hono** + SSR JSX (server-rendered HTML) |
| Interactivity | **HTMX** |
| CSS | **Pico CSS** |
| Database | **SQLite** with WAL on Render **persistent disk** (5 GB) — not Postgres for MVP |
| Hosting | **Render** web service — 1 instance, 0.5 CPU, 512 MB, bind `0.0.0.0:$PORT` |
| Edge | **Cloudflare** — CDN cache for public GET, TLS, WAF, **Turnstile**, **Access** on `/admin/*` |
| Object storage | **Not used** — SQLite on Render disk only |
| Email | External transactional email provider — verification messages only |
| Auth (admin) | Cloudflare Access JWT validation on origin (`Cf-Access-Jwt-Assertion` via JWKS) |

**Explicitly out of scope per plan:** Redis, workers/queues, PostgreSQL, multi-instance, realtime counters, mobile app, journalist API, user accounts, external S3/R2 object stores.

**DECISION:** Use `@hono/node-server` or equivalent Node adapter; migrations via a lightweight tool (e.g. `better-sqlite3` + SQL migration files). Persistence is the Render disk; external object-store backups and ledgers are out of the deploy contract.

---

## 3. Data Model

All tables use SQLite. Binary blobs are **not** stored in DB. `PRAGMA foreign_keys = ON`, `journal_mode = WAL`, `synchronous = NORMAL`, `busy_timeout = 5000`.

### 3.1 Content

**`campaigns`:** `id` PK, `slug` UNIQUE, `status` (`draft`|`active`|`archived` — DECISION)

**`demands`:** `id` PK, `campaign_id` FK (DECISION: single active campaign), `sort_order`, `is_active`, `document` (`standard`|`coalition`). The appeal builder offers `standard` clauses only.

**`plan_items`:** `id` PK, `campaign_id` FK, `day_from`, `day_to`, `sort_order`, `is_active`; translations carry `title`, `decision`, `instrument`, `owners`, `criterion`

**`portfolios`:** `id` PK, `sort_order`, `is_active`; translations carry `name`

**`demand_translations`:** `demand_id` FK, `locale` (`he|ar|yi|ru|en|am`), `title`, `body` (the commitment), `rationale`, `verification`, `exceptions`; UNIQUE (`demand_id`,`locale`). The last three render as fixed callouts in a fixed order.

**`message_templates`:** `id` PK (DECISION), `locale`, `channel` (`email`|`whatsapp`|`social` — DECISION), `subject` (nullable), `body` (placeholders `{recipient}`, `{demands}`, `{handle}`, `{link}`, `{name}`, `{city}`, `{context}`)

**Note:** SQLite does not interpret `\n` inside a string literal. Seeds must insert real newlines, or convert with `replace(body, '\n', char(10))` as migration `003` does.

### 3.2 Recipients

**`recipients`:** `id` PK, `type` (`party`|`politician`), `email`, `whatsapp`, `website`, `social_handle` (nullable), `is_active`

**`{handle}` resolution:** `social_handle` if set → else `Knesset member <name>` for `politician` → else the localized `name`.

**`recipient_translations`:** `recipient_id` FK, `locale`, `name`; UNIQUE (`recipient_id`,`locale`)

### 3.3 Supporters

**`supporters`:** `id` PK, `email_normalized` UNIQUE, `name`, `city`, `profession` (optional — DECISION), `locale`, `public_name_allowed`, `privacy_consent_at`, `email_verified_at`, `created_at`, `deleted_at`

**`email_verifications`:** `id` PK (DECISION), `supporter_id` FK, `token_hash`, `expires_at`, `used_at`

**Invariant:** One verified email = +1 to supporter counter, exactly once (`email_normalized` UNIQUE).

### 3.4 Appeals and Actions

**`generated_requests`:** `id` PK, `recipient_id` FK, `locale`, `selected_demands` (JSON array), `created_at`; optional `supporter_id` FK (DECISION). **Invariant:** never store full personalized message body.

**`request_actions`:** `id` PK, `generated_request_id` FK, `action_type` (`email_opened`|`whatsapp_opened`|`text_copied`|`reported_sent`|`shared_x`|`shared_facebook`|`shared_whatsapp`|`shared_telegram`), `created_at`

### 3.5 Submitted Responses

**`submitted_responses`:** `id` PK, `recipient_id` FK, `received_at`, `channel`, `response_text`, `submitter_email`, `consent_at`, `status`, `reviewed_at`, `created_at` (DECISION). Status: `new` → `under_review` → `confirmed` | `insufficient_data` | `duplicate` | `rejected`

**`submitted_response_files`:** `id` PK (DECISION), `response_id` FK, `object_key`, `mime`, `size` (≤10 MB), `uploaded_at`

### 3.6 Administration

**`admins`:** `id` PK, `email` UNIQUE (from Access JWT), `role` (`admin`|`moderator` — DECISION), `is_active` — no app passwords/TOTP

**`admin_audit_events`:** `id` PK (DECISION), `admin_id` FK, `action`, `entity`, `payload` (JSON), `created_at`

**Invariant:** Every admin mutation writes an audit event.

### 3.7 Relations Summary

```
campaigns 1—* demands 1—* demand_translations
recipients 1—* recipient_translations
supporters 1—* email_verifications
recipients 1—* generated_requests 1—* request_actions
recipients 1—* submitted_responses 1—* submitted_response_files
admins 1—* admin_audit_events
```

---

## 4. Features — MVP vs Later

Phasing follows plan roadmap **E0–E7**. All items below are **Phase 1 / MVP** unless listed under Later.

### Phase 1 / MVP

**E0 — Foundation**
- Hono + TS + SSR JSX + HTMX + Pico CSS project
- SQLite migrations with required PRAGMAs; DB on Render persistent disk survives restart/deploy
- Env-based config; deploy on Render behind Cloudflare
- **Acceptance:** Health page deploys; DB persists across restart and redeploy

**E1 — i18n core**
- Routes `/{locale}/…` for `he`, `ar`, `yi`, `ru`, `en`, `am`
- UI strings in JSON dictionaries; long campaign text in Markdown
- Cookie for locale; language switcher preserves equivalent page
- Languages are offered by endonym (עברית, العربية, ייִדיש, Русский, English, አማርኛ), never by ISO code — a reader must find their language without knowing what `am` stands for
- `<html lang dir>` per page; RTL/LTR via logical CSS properties
- Letter-spacing and uppercasing are applied only to Latin and Cyrillic: tracking severs the cursive joins in Arabic, and Hebrew, Yiddish and Ge'ez have no case distinction
- No silent fallback if translation missing — show explicit unavailable state
- **Acceptance:** All 6 locales render; RTL/LTR correct at 320–1440px

**E2 — Public content**
- Home: problem, solution, demands summary, primary ask CTA (no public counters)
- Full demands page; content from DB (cache-TTL at edge)
- Localized share buttons
- **Acceptance:** Content driven by DB/admin data, not hardcoded; home has no supporter/action counters

**E3 — Support + verification (gated, default off)**
- Support form remains implementable for operators who re-enable `support_enabled`
- Rate limit `POST /support`; email normalization; verification email; token confirm
- Not linked from public nav/home while disabled
- **Acceptance:** When off, public support returns unavailable; when on, double-submit does not create duplicate verified emails

**E4 — Appeal generator**
- Recipient list (parties/politicians with official contacts)
- Select demands; optional name, city, short personal context; message locale
- Localized templates → preview (email subject/body, WhatsApp short text, public post text)
- Every generated text is editable on the preview before any action is taken
- Private actions: mailto, WhatsApp deep link, copy — each logged in `request_actions`
- Public actions: post to X, Facebook, WhatsApp, Telegram, mentioning `{handle}` and linking the campaign
- Facebook's sharer accepts a URL only, so `shared_facebook` also renders the post text for manual copy
- "I sent it" → result page + share (WhatsApp, Telegram, Facebook, link)
- **Acceptance:** Appeals in all locales; action types counted separately for operators; personal text not stored in DB

**E5 — Response submission**
- Form: recipient, received date, channel, text, optional file, email, consent
- Default deploy: text-only (no object store). File upload returns unavailable until/unless an object store is deliberately reintroduced
- Metadata in DB; status `new`; confirmation page; moderation queue (not public)
- **Acceptance:** Nothing auto-published; personal appeal text still never stored

**E6 — Admin**
- Cloudflare Access on `/admin/*` + origin JWT validation → 403 without valid token (including direct `*.onrender.com`)
- CRUD: demands + translations, recipients + translations, message templates
- Moderation queue: view/change response status
- Aggregate stats; CSV export supporters + metrics
- Audit log on every mutation; kill-switch forms and recipients
- **Acceptance:** Direct origin admin access blocked; every mutation audited

**E7 — Hardening & launch**
- Cloudflare cache rules (public GET only); strict CSP; configurable rate limits
- Turnstile on all public forms; CSRF; secure/httpOnly cookies
- Privacy policy ×7 locales; user data deletion mechanism
- Persist SQLite on the Render disk (no external object-store requirement)
- WCAG 2.1 AA targets: Lighthouse a11y ≥95, axe 0 critical/serious
- Load: 25 rps sustained, 50 rps burst, p95 GET ≤300ms, p95 POST ≤500ms, error rate <1%
- **Acceptance:** All DoD checklist items (plan §08) pass

### Later Phases (explicitly out of MVP scope)

- Knesset voting import; statement monitoring
- Auto-classification of responses; public responses table
- Bulk email on behalf of users; reminder campaigns
- Journalist API; mobile app; user accounts/login
- Realtime counters; Redis; background workers; PostgreSQL; multi-instance
- AI auto-translation of published content

---

## 5. Pages, Routes & API Endpoints

**DECISION:** Public site is SSR + HTMX (HTML responses). JSON API only where HTMX partials or admin AJAX need it. Locale prefix on all public routes.

### Public pages (GET, SSR)

| Route | Purpose |
|-------|---------|
| `/{locale}/standard` | The ten transparency clauses put to every party |
| `/{locale}/coalition-agreement` | The five coalition-readiness clauses |
| `/{locale}/first-100-days` | Day-range plan, rendered as a bar chart |
| `/{locale}/government-model` | 18 portfolios and the 18/4 caps |
| `/{locale}/about` | Who we are, funding, disclosures |
| `/{locale}/methodology` | How each published figure is counted |
| `/{locale}/demands` | 301 to `/{locale}/standard` |
| `/assets/app-{hash}.css` | Stylesheet, URL carries a content hash, `immutable` |
| `/assets/app-{hash}.js` | Clipboard and appearance-switch handlers, same hashing |
| `/assets/theme-{hash}.js` | Applies the stored appearance before first paint; render-blocking in `<head>` |
| `/` | Redirect to locale from cookie or `Accept-Language` |
| `/{locale}` | Home |
| `/{locale}/demands` | Full demands |
| `/{locale}/support` | Support form |
| `/{locale}/verify-email` | Token verification landing |
| `/{locale}/request` | Recipient selection |
| `/{locale}/request/build` | Demand selection + personalization |
| `/{locale}/request/preview` | Message preview |
| `/{locale}/request/result` | Post-action / "I sent it" + share |
| `/{locale}/responses/new` | Submit received response |
| `/{locale}/responses/thanks` | Submission confirmation |
| `/{locale}/privacy` | Privacy policy |
| `/{locale}/delete-data` | Data deletion request form |

### Public actions (POST, HTMX or form)

| Endpoint | Purpose |
|----------|---------|
| `POST /{locale}/support` | Create supporter + send verification (Turnstile) |
| `GET /verify-email?token=…` | DECISION: global path for email link simplicity |
| `POST /verify-email` | Confirm token (rate limited) |
| `POST /{locale}/request/preview` | Build preview from selections |
| `POST /{locale}/request/action` | Log action from the submit button's value; return mailto/WA/copy/share UI |
| `POST /{locale}/request/report-sent` | Log `reported_sent` |
| `POST /{locale}/responses` | Submit response + file upload |
| `POST /{locale}/delete-data` | Process deletion request |

### Admin (GET/POST under `/admin`, Access JWT required)

| Route | Purpose |
|-------|---------|
| `/admin` | Dashboard + aggregate stats |
| `/admin/demands` | CRUD demands + translations |
| `/admin/recipients` | CRUD recipients + contacts + social handle + translations |
| `/admin/templates` | CRUD message templates |
| `/admin/supporters` | List + CSV export |
| `/admin/responses` | Moderation queue |
| `/admin/responses/:id` | Review / status change |
| `/admin/audit` | Audit log viewer |
| `/admin/settings` | Kill-switches (forms, recipients, campaign) |
| `/admin/export/stats` | CSV metrics export |

### Internal / ops

| Route | Purpose |
|-------|---------|
| `GET /health` | Render health check (no cache) |
| Optional CLI | Legacy only — not part of deploy |

**Cache policy:** Cloudflare may cache public GET pages and static assets only. Never cache POST, email verify, admin, personalized outputs, or sensitive forms.

---

## 6. Localization

**Plan requirement:** All **6 locales from first release** — Hebrew (`he`), Arabic (`ar`), Yiddish (`yi`) RTL; Russian (`ru`), English (`en`), Amharic (`am`) LTR. URL pattern `/{locale}/…`. Privacy policy on all 6 languages.

**Storage:** Short UI → JSON per locale; campaign/demand long text → Markdown in `demand_translations`; appeal templates → DB `message_templates`. Political/legal text only after human review. **No silent language substitution** — missing translation shows explicit fallback UI (e.g. language picker), not wrong language content.

**RTL/LTR:** Set `lang` and `dir` on `<html>`; use logical CSS properties (`margin-inline`, `padding-inline`, `text-align: start`); isolate emails/URLs/phones in LTR (`bdi` / `dir="ltr"`).

**MVP builder note:** i18n/RTL infrastructure from E1; DoD requires all six languages at launch (not Russian-only UI).

---

## 7. Environment Variables & External Services

| Variable | Required | Purpose | Where to obtain |
|----------|----------|---------|-----------------|
| `PORT` | yes | HTTP bind port | Set by Render automatically |
| `NODE_ENV` | yes | `production` / `development` | Set in Render dashboard |
| `APP_BASE_URL` | yes | Canonical HTTPS URL for email links | Your domain (Cloudflare DNS → Render) |
| `SQLITE_PATH` | yes | Path to SQLite file on persistent disk | DECISION: `/data/app.db` on Render disk mount |
| `SESSION_SECRET` | yes | Sign CSRF/session cookies | Generate: `openssl rand -hex 32` |
| `TURNSTILE_SITE_KEY` | yes | Client widget | Cloudflare Dashboard → Turnstile |
| `TURNSTILE_SECRET_KEY` | yes | Server verification | Cloudflare Dashboard → Turnstile |
| `CF_ACCESS_TEAM_DOMAIN` | yes | JWKS URL host | Cloudflare Zero Trust → Access → team domain |
| `CF_ACCESS_AUD` | yes | JWT `aud` validation | Cloudflare Access application settings for `/admin/*` |
| `EMAIL_PROVIDER_API_KEY` | yes | Send verification emails | Resend / SendGrid / Postmark / SES — provider dashboard |
| `EMAIL_FROM` | yes | From address | Verified sender in email provider |
| `RATE_LIMIT_*` | no | Override default limits | Optional env config (plan: configurable without redeploy logic — use env reload) |

**External services summary:** Render (web + persistent disk), Cloudflare (DNS, CDN, Turnstile, Access), transactional email provider. No S3/R2 buckets.

---

## 8. Non-Functional Requirements (MVP)

### Security
- Cloudflare Turnstile on every public form
- Rate limits (defaults, env-overridable):

| Endpoint | Limit | Window |
|----------|-------|--------|
| `POST /support` | 5 / IP | 15 min |
| `POST /verify-email` | 10 / IP | 1 hour |
| `POST /request/preview` | 30 / IP | 1 hour |
| `POST /request/action` | 30 / IP | 1 hour |
| `POST /responses` | 3 / IP | 1 hour |

- CSRF tokens on mutating forms; `Secure` + `HttpOnly` cookies; strict Content-Security-Policy
- Request body size limits; file type validation (JPG/PNG/WebP/PDF) and ≤10 MB
- Admin: Cloudflare Access (SSO + mandatory 2FA policy) **and** origin JWT validation — direct Render URL must return 403
- Kill-switch to disable any user-facing form quickly

### Privacy
- Collect minimum PII; no electoral choice without separate need
- No publishing individual data without consent (`public_name_allowed`)
- User data deletion flow; privacy policy in all 6 locales
- Analytics: **aggregates only** — never log personalized appeal text
- HTTPS only for pages, email links, and file handling

### Performance & reliability
- Targets: 100k visitors/hour via edge cache; 25 rps dynamic sustained, 50 rps burst; p95 GET ≤300ms, POST ≤500ms; <1% errors under load
- SQLite: single writer, short transactions on the Render persistent disk
- External SQLite object backups are optional; default reliability is the disk (and host snapshots)

### Accessibility
- WCAG 2.1 AA: keyboard navigation, visible focus, semantic HTML, real labels, HTMX updates via `aria-live`, skip link, no horizontal scroll at 320px
- Lighthouse Accessibility ≥95; axe-core zero critical/serious

### Moderation
- Submitted responses enter queue with status workflow; admin review required before any public use (MVP: no public response table)

**Metrics (aggregates only, admin):** generated requests, email/WhatsApp opens, copies, reported sent, submitted responses — by party and locale. Public pages must not surface these as campaign counters. **Build order:** E0→E7 sequentially.
