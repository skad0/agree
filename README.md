# Contract in Advance · Договор заранее

A multilingual civic transparency platform. It puts the same set of questions to every registered party before an election — which coalitions they would join, how large a government they would form, whether they will comply with final court rulings, the inquiry into 7 October, and their first 100 days — and lets a citizen support those requirements and send a party a specific question themselves.

The platform does not recommend how to vote, does not rank parties, and never stores the link between a verified supporter and the party they wrote to.

Supporters verify their email, create a personal appeal to a recipient, send it privately or post it publicly through their own channel, and may submit any reply for moderation.

The authoritative source for all site text is `docs/Каноническийпакеттекстовиправилпроекта.docx` (Russian). **Translations into Hebrew, Arabic, Yiddish, English, Amharic and Ukrainian are machine-generated and unreviewed — see [docs/TRANSLATION-REVIEW.md](docs/TRANSLATION-REVIEW.md) before launch.** It is server-rendered with Hono JSX and native HTML forms, with progressive enhancement from the same-origin client asset, uses Pico CSS, and stores state in SQLite WAL mode.

## Quick start

Requires Node.js 22.13 or newer (Node 24 is used on Render).

```sh
npm ci --ignore-scripts
cp .env.example .env
npm run dev
```

No third-party keys are needed to boot. With no keys:

- Turnstile checks are disabled.
- production email-dependent actions remain unverified and return an unavailable message; development/test responses expose a local confirmation link.
- text-only response submissions work; file submissions return 503 until R2 is configured.
- `/admin/*` fails closed with 403 until Cloudflare Access is configured.
- external backups stay disabled until the backup bucket is configured.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Build, then run the compiled server in watch mode |
| `npm run typecheck` | Type-check without emitting files |
| `npm run build` | Compile application, scripts, and tests to `dist/` |
| `npm test` | Build and run Node integration tests |
| `npm run smoke` | Build, start a keyless isolated server, and request main pages |
| `npm run load -- http://127.0.0.1:3000` | Exercise local GET and support-write latency targets |
| `npm run backup` | Upload daily and weekly SQLite backup objects |
| `AGREE_RESTORE_SERVICE_STOPPED=1 AGREE_RESTORE_CONFIRMED=1 npm run restore -- daily/YYYY-MM-DD.db` | Staged, reconciled restore (the service must be stopped; maintenance mode is not implemented) |

## Architecture

- `src/server.ts` binds `0.0.0.0:$PORT`, schedules response-object maintenance, and schedules a backup every 24 hours when backup credentials exist.
- `src/app.tsx` builds one Hono app and one SQLite connection.
- `migrations/` contains the schema, localized seed content, and additive upgrades applied on boot. `004` carries the canonical campaign: 10 standard clauses, 5 coalition clauses, 11 first-100-days items and 18 portfolios.
- `src/content.tsx` renders the political documents. A clause is a commitment plus three fixed callouts — why it matters, how it is checked, permitted exceptions — always in that order, so the page can be skimmed by position rather than read end to end.
- **Inline `style` attributes do not work here.** The CSP sets `style-src 'self' https://cdn.jsdelivr.net` with no `'unsafe-inline'`, so browsers discard style attributes silently. Data-driven geometry, such as the first-100-days bars, uses SVG presentation attributes instead; SVG does not mirror on its own, so RTL offsets are computed server-side from the locale.
- The appeal preview generates email, WhatsApp and public-post text from localized templates; every field is editable before the supporter acts on it.
- Public posting targets X, Facebook, WhatsApp and Telegram. The post mentions the recipient's `social_handle`, or falls back to `Knesset member <name>` for politicians. Facebook's sharer accepts a URL only, so that path also shows the text for manual copy.
- `src/locales/` contains all seven short-string dictionaries: Hebrew, Arabic, Yiddish, Russian, English, Amharic, and Ukrainian. Hebrew, Arabic, and Yiddish render RTL. Languages are always offered by endonym, never by ISO code.
- `src/assets.ts` holds the stylesheet and the clipboard helper, and derives a content hash for each. The served URL contains that hash, so assets are cached `immutable` and a deploy still reaches browsers immediately.
- Public POST routes use signed CSRF cookies, optional Turnstile, body limits, validation, and per-IP limits.
- Cloudflare Access JWTs are verified at origin through the team JWKS. There is no application password system.
- Appeal personalization stays in the response HTML and form payload; only recipient, locale, selected demand IDs, and aggregate actions are stored. This holds for public-post text too — the text a supporter posts is never written to the database.
- Response submissions use signed opaque tokens so replay creates at most one response. Files are held in memory only long enough to validate and upload after a durable intent is committed; only metadata and retryable upload/delete work enter SQLite, and object cleanup is retried outside transactions.

## Visual design

Pico is retuned through its own custom properties rather than by overriding its selectors.

The palette is **techelet and white**, the national colours: `#0038b8` on white. The Flag and Emblem Law describes the colour but fixes no hex; `#0038b8` is the value in common use. These are deliberately the *national* colours and not the gov.il service palette — the canonical package states the project does not represent a state body, and looking like an official government service would work against that.

Two hues only. Techelet carries every action, link, counter and clause number; amber `#9a5b00` appears nowhere except caveats — the permitted-exceptions callout and the "does not recommend how to vote" disclaimer — where a warning colour is the accurate signal. Rank is expressed by scale and weight rather than by hue. A dark counterpart follows `prefers-color-scheme`, lifting techelet toward sky so it stays legible on a dark ground.

Measured contrast: light theme 17.4:1 body text, 9.3:1 links and button labels, 5.4:1 amber; dark theme 15.6:1, 7:1, 8:1. All above WCAG AA, most above AAA.

Readers can override the system setting from the appearance switcher in the footer — light, dark, or follow the system. The choice lives in `localStorage` and is applied by a small render-blocking script served from `/assets/theme-{hash}.js`. It has to be a separate same-origin file rather than the usual inline snippet, because `script-src` carries no `'unsafe-inline'`, and the main bundle is deferred, which would paint the wrong theme first. With scripting off the control is hidden and the system preference applies, so nothing is left broken.

There are deliberately **no webfonts**. Covering Hebrew, Arabic, Ge'ez, Cyrillic and Latin in a display face would cost this audience hundreds of kilobytes on the low-end phones many of them use, and every operating system already ships these scripts. Personality comes from the type scale and a small monospace utility register instead.

The home page opens on the campaign name set simultaneously in all seven scripts, each one a link into that language. It is both the identity of the page and the language switcher.

Two Pico behaviours are worth knowing before editing `src/assets.ts`: Pico declares its tokens at `:root:not([data-theme=dark])`, so plain `:root` overrides silently lose; and Pico scales the root font-size with the viewport, so `rem` widths hold a constant line length in characters rather than a constant pixel width.

The product contract and route inventory are in [docs/SPEC.md](docs/SPEC.md). Credential setup is in [docs/SECRETS.md](docs/SECRETS.md); the recommended AWS S3 backup and immutable-ledger procedure is [docs/AWS_S3_SETUP.md](docs/AWS_S3_SETUP.md).

## Render deployment

`render.yaml` creates one paid Starter web instance with a 5 GB disk mounted at `/data`; SQLite is `/data/app.db`. Keep `numInstances: 1`: a Render persistent disk cannot be shared horizontally, and this MVP intentionally uses one SQLite writer.

1. Create a Render Blueprint from this repository and verify `APP_BASE_URL` matches the assigned domain.
2. Add every production input from `docs/SECRETS.md` to Render before the first production boot, including the dedicated ledger bucket and HMAC keys; keyless boot is for local development only.
3. For the recommended AWS S3 path, follow [docs/AWS_S3_SETUP.md](docs/AWS_S3_SETUP.md), including bucket-created Object Lock and default retention, then run the signed ledger bootstrap and verification before accepting deletion traffic: `npm run build && node dist/scripts/setup-erasure-ledger.js`. This repository does not configure AWS resources.
4. Proxy the production domain through Cloudflare. Cache only public `GET` pages/assets for a short TTL. Bypass cache for every `POST`, `/admin/*`, `/verify-email`, support/request/response/delete forms, and any response carrying `Set-Cookie`.
5. Protect `/admin*` with a Cloudflare Access application whose audience equals `CF_ACCESS_AUD`; require SSO and 2FA in its policy.
6. Set the production perimeter contract described in [docs/SECRETS.md](docs/SECRETS.md): `SESSION_SECRET`, `TRUSTED_PROXY=cloudflare`, a generated `TRUSTED_PROXY_SECRET`, and an HTTPS `APP_BASE_URL`. The server refuses to boot when any required value is absent or malformed.

Render disks require a paid instance and prevent horizontal scaling. Only data under `/data` survives deploys. External SQLite backups remain mandatory even though Render also snapshots disks.

## Backup and recovery

When all `BACKUP_S3_*` values exist, the web process backs up immediately after start and every 24 hours. It writes stable keys under `daily/YYYY-MM-DD.db` and `weekly/YYYY-Www.db`. For AWS S3 lifecycle, Object Lock, IAM, and validation, follow [docs/AWS_S3_SETUP.md](docs/AWS_S3_SETUP.md). Provider lifecycle remains manual external control and is separate from SQLite retention.

To restore, stop the service (there is no implemented maintenance mode), verify the separate restore IAM credential and historical key escrow are available, and confirm no `app.db-wal` or `app.db-shm` sidecars exist. Then run:

```sh
AGREE_RESTORE_SERVICE_STOPPED=1 AGREE_RESTORE_CONFIRMED=1 npm run restore -- daily/2026-07-19.db
npm start
curl -f https://your-domain.example/health
```

The command downloads to same-filesystem staging, checks integrity, applies migrations, validates the authenticated ledger manifest and complete signed ledger, reconciles historic rows, checks integrity/foreign keys again, and atomically activates only on success. It never creates a PII rollback copy: before activation the target remains untouched, and the same-filesystem atomic rename leaves either the old or complete new database after a crash. Recovery uses the original external backup, not an indefinitely retained local copy. Run the required scratch restore/reconciliation drill before launch; this procedure does not claim provider controls are configured.

After a restore, check `/health`, the seven locale home pages, `/admin` through Access, current campaign content, response moderation, and one attachment download. Confirm that the newest expected backup remains present and that the next scheduled backup succeeds. A privacy deletion request does not rewrite historical backup objects: verify the live database, queued object-deletion work, and the provider's backup retention separately.

## Launch gates

Before public launch: complete human review of political/legal translations, run Lighthouse and axe in a configured real browser at 320/768/1024/1440 px, configure Cloudflare/Render monitoring and alerts, exercise a production backup restore, and run the load command against staging. Obtain provider lifecycle evidence and enforce Object Lock/WORM (or an equivalent provider append-only policy) on the ledger manifest/event prefix; this is not supplied or enforced by the app. Never place secrets in `.env.example` or source control.
