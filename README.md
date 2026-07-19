# Collective Civic Request Platform

A multilingual civic campaign MVP where supporters verify their email, create a personal appeal to an official recipient, send it through their own channel, and submit any reply for moderation. It is server-rendered with Hono JSX and progressively enhanced with HTMX, uses Pico CSS, and stores state in SQLite WAL mode.

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
- `migrations/` contains the 14-table schema and localized seed content.
- `src/locales/` contains all six short-string dictionaries: Hebrew, Arabic, Yiddish, Russian, English, and Amharic. Hebrew, Arabic, and Yiddish render RTL.
- Public POST routes use signed CSRF cookies, optional Turnstile, body limits, validation, and per-IP limits.
- Cloudflare Access JWTs are verified at origin through the team JWKS. There is no application password system.
- Appeal personalization stays in the response HTML and form payload; only recipient, locale, selected demand IDs, and aggregate actions are stored.
- Response files are held in memory only long enough to validate and stream to S3-compatible storage; only metadata enters SQLite.

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

