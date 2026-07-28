# Contract in Advance · Договор заранее

A multilingual civic transparency platform. It puts the same set of questions to every registered party before an election — which coalitions they would join, how large a government they would form, whether they will comply with final court rulings, the inquiry into 7 October, and their first 100 days — and lets a citizen support those requirements and send a party a specific question themselves.

The platform does not recommend how to vote, does not rank parties, and never stores the link between a verified supporter and the party they wrote to.

Supporters verify their email, create a personal appeal to a recipient, send it privately or post it publicly through their own channel, and may submit any reply for moderation.

The authoritative source for all site text is `docs/Каноническийпакеттекстовиправилпроекта.docx` (Russian). **Translations into Hebrew, Arabic, Yiddish, English and Amharic are machine-generated and unreviewed — see [docs/TRANSLATION-REVIEW.md](docs/TRANSLATION-REVIEW.md) before launch.** It is server-rendered with Hono JSX and progressively enhanced with HTMX, uses Pico CSS, and stores state in SQLite WAL mode.

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
| `npm run restore -- daily/YYYY-MM-DD.db` | Integrity-check and restore one external backup |

## Architecture

- `src/server.ts` binds `0.0.0.0:$PORT` and schedules a backup every 24 hours when backup credentials exist.
- `src/app.tsx` builds one Hono app and one SQLite connection.
- `migrations/` contains the schema, localized seed content, and additive upgrades applied on boot. `004` carries the canonical campaign: 10 standard clauses, 5 coalition clauses, 11 first-100-days items and 18 portfolios.
- `src/content.tsx` renders the political documents. A clause is a commitment plus three fixed callouts — why it matters, how it is checked, permitted exceptions — always in that order, so the page can be skimmed by position rather than read end to end.
- **Inline `style` attributes do not work here.** The CSP sets `style-src 'self' https://cdn.jsdelivr.net` with no `'unsafe-inline'`, so browsers discard style attributes silently. Data-driven geometry, such as the first-100-days bars, uses SVG presentation attributes instead; SVG does not mirror on its own, so RTL offsets are computed server-side from the locale.
- The appeal preview generates email, WhatsApp and public-post text from localized templates; every field is editable before the supporter acts on it.
- Public posting targets X, Facebook, WhatsApp and Telegram. The post mentions the recipient's `social_handle`, or falls back to `Knesset member <name>` for politicians. Facebook's sharer accepts a URL only, so that path also shows the text for manual copy.
- `src/locales/` contains all six short-string dictionaries: Hebrew, Arabic, Yiddish, Russian, English, and Amharic. Hebrew, Arabic, and Yiddish render RTL. Languages are always offered by endonym, never by ISO code.
- `src/assets.ts` holds the stylesheet and the clipboard helper, and derives a content hash for each. The served URL contains that hash, so assets are cached `immutable` and a deploy still reaches browsers immediately.
- Public POST routes use signed CSRF cookies, optional Turnstile, body limits, validation, and per-IP limits.
- Cloudflare Access JWTs are verified at origin through the team JWKS. There is no application password system.
- Appeal personalization stays in the response HTML and form payload; only recipient, locale, selected demand IDs, and aggregate actions are stored. This holds for public-post text too — the text a supporter posts is never written to the database.
- Response files are held in memory only long enough to validate and stream to S3-compatible storage; only metadata enters SQLite.

## Visual design

Pico is retuned through its own custom properties rather than by overriding its selectors.

The palette is **techelet and white**, the national colours: `#0038b8` on white. The Flag and Emblem Law describes the colour but fixes no hex; `#0038b8` is the value in common use. These are deliberately the *national* colours and not the gov.il service palette — the canonical package states the project does not represent a state body, and looking like an official government service would work against that.

Two hues only. Techelet carries every action, link, counter and clause number; amber `#9a5b00` appears nowhere except caveats — the permitted-exceptions callout and the "does not recommend how to vote" disclaimer — where a warning colour is the accurate signal. Rank is expressed by scale and weight rather than by hue. A dark counterpart follows `prefers-color-scheme`, lifting techelet toward sky so it stays legible on a dark ground.

Measured contrast: light theme 17.4:1 body text, 9.3:1 links and button labels, 5.4:1 amber; dark theme 15.6:1, 7:1, 8:1. All above WCAG AA, most above AAA.

There are deliberately **no webfonts**. Covering Hebrew, Arabic, Ge'ez, Cyrillic and Latin in a display face would cost this audience hundreds of kilobytes on the low-end phones many of them use, and every operating system already ships these scripts. Personality comes from the type scale and a small monospace utility register instead.

The home page opens on the campaign name set simultaneously in all six scripts, each one a link into that language. It is both the identity of the page and the language switcher.

Two Pico behaviours are worth knowing before editing `src/assets.ts`: Pico declares its tokens at `:root:not([data-theme=dark])`, so plain `:root` overrides silently lose; and Pico scales the root font-size with the viewport, so `rem` widths hold a constant line length in characters rather than a constant pixel width.

The product contract and route inventory are in [docs/SPEC.md](docs/SPEC.md). Credential setup is in [docs/SECRETS.md](docs/SECRETS.md).

## Render deployment

`render.yaml` creates one paid Starter web instance with a 5 GB disk mounted at `/data`; SQLite is `/data/app.db`. Keep `numInstances: 1`: a Render persistent disk cannot be shared horizontally, and this MVP intentionally uses one SQLite writer.

1. Create a Render Blueprint from this repository and verify `APP_BASE_URL` matches the assigned domain.
2. Deploy once keyless and check `/health`, `/en`, and `/admin` (expected 403).
3. Add the integration secrets from `docs/SECRETS.md` in the Render environment and redeploy.
4. Proxy the production domain through Cloudflare. Cache only public `GET` pages/assets for a short TTL. Bypass cache for every `POST`, `/admin/*`, `/verify-email`, support/request/response/delete forms, and any response carrying `Set-Cookie`.
5. Protect `/admin*` with a Cloudflare Access application whose audience equals `CF_ACCESS_AUD`; require SSO and 2FA in its policy.

Render disks require a paid instance and prevent horizontal scaling. Only data under `/data` survives deploys. External SQLite backups remain mandatory even though Render also snapshots disks.

## Backup and recovery

When all `BACKUP_S3_*` values exist, the web process backs up immediately after start and every 24 hours. It writes stable keys under `daily/YYYY-MM-DD.db` and `weekly/YYYY-Www.db`; configure bucket lifecycle rules to retain at least 7 daily and 8 weekly objects.

To restore, put the service in maintenance mode or stop it, then run:

```sh
npm run restore -- daily/2026-07-19.db
npm start
curl -f https://your-domain.example/health
```

The restore command downloads to a temporary directory, runs `PRAGMA integrity_check`, and only then replaces `SQLITE_PATH`. Roll back application code by redeploying the previous Git commit; migrations are additive, so the previous build can continue reading the database.

## Launch gates

Before public launch: complete human review of political/legal translations, run Lighthouse and axe in a configured real browser at 320/768/1024/1440 px, configure Cloudflare/Render monitoring and alerts, exercise a production backup restore, and run the load command against staging. Never place secrets in `.env.example` or source control.

