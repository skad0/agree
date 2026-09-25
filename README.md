# רף משותף · Common Bar

Identity exports, logo usage, social images, and regeneration instructions are in
[the brand guide](docs/brand/README.md).

A multilingual civic transparency platform. It puts the same set of questions to every registered party before an election — which coalitions they would join, how large a government they would form, whether they will comply with final court rulings, the inquiry into 7 October, and their first 100 days — and lets visitors understand a problem and share a short explanation and public link.

The platform does not recommend how to vote, does not rank parties, and never stores personalized appeal text.

Visitors choose a problem and share its link through WhatsApp, Facebook, Telegram, X, the device share menu, or copy. Candidates are optional context. No account, recipient selection, email address, or message submission is needed. Sharing creates no action records or counters. New appeal, support, and reply submissions are paused; historical privacy deletion remains available.

The authoritative source for all site text is `docs/Каноническийпакеттекстовиправилпроекта.docx` (Russian). **Translations into Hebrew, Arabic, Yiddish, English, Amharic and Ukrainian are machine-generated and unreviewed — see [docs/TRANSLATION-REVIEW.md](docs/TRANSLATION-REVIEW.md) before launch.** It is server-rendered with Hono JSX and native HTML forms, with progressive enhancement from the same-origin client asset, uses Pico CSS, and stores state in SQLite WAL mode.

## Quick start

Requires Node.js 22.13 or newer (Node 24 is used on Render).

```sh
npm ci --ignore-scripts
cp .env.example .env
npm run dev
```

The development/start and database-operation npm commands load `.env` when present. Existing process variables (including Render's settings) take precedence. Tests and isolated smoke checks do not load your local `.env`.

No third-party keys are needed to boot. With no keys:

- Turnstile checks are disabled.
- production email-dependent actions remain unverified and return an unavailable message; development/test responses expose a local confirmation link.
- new response and support submissions return 503; retired appeal writes return 410.
- `/admin/*` fails closed with 403 until Cloudflare Access is configured.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Build, then run the compiled server in watch mode |
| `npm run typecheck` | Type-check without emitting files |
| `npm run build` | Compile application, scripts, and tests to `dist/` |
| `npm test` | Build and run Node integration tests |
| `npm run smoke` | Build, start a keyless isolated server, and request main pages |
| `npm run load -- http://127.0.0.1:3000` | Exercise local GET and support-write latency targets |

## Architecture

- `src/server.ts` binds `0.0.0.0:$PORT` and schedules response-object maintenance. It does not schedule external SQLite backups.
- `src/app.tsx` builds one Hono app and one SQLite connection.
- `migrations/` contains the schema, localized seed content, and additive upgrades applied on boot. `004` carries the canonical campaign: 10 standard clauses, 5 coalition clauses, 11 first-100-days items and 18 portfolios.
- `src/content.tsx` renders the political documents. A clause is a commitment plus three fixed callouts — why it matters, how it is checked, permitted exceptions — always in that order, so the page can be skimmed by position rather than read end to end.
- **Inline `style` attributes do not work here.** The CSP sets `style-src 'self' https://cdn.jsdelivr.net` with no `'unsafe-inline'`, so browsers discard style attributes silently. Data-driven geometry, such as the first-100-days bars, uses SVG presentation attributes instead; SVG does not mirror on its own, so RTL offsets are computed server-side from the locale.
- `src/share-pages.tsx`, `src/issues.ts`, and `src/components/share-options.tsx` render ten stable issue routes and one consistent sharing control. `src/issue-headings.ts` supplies plain-language questions; the existing localized standard supplies commitments and explanations.
- Platform links are ordinary links; sharing never auto-posts. `src/share-client.ts` adds clipboard and native sharing with visible failure feedback. Locale-specific raster preview assets are content-hashed and served anonymously.
- `src/locales/` contains all seven short-string dictionaries: Hebrew, Arabic, Yiddish, Russian, English, Amharic, and Ukrainian. Hebrew, Arabic, and Yiddish render RTL. Languages are always offered by endonym, never by ISO code.
- `src/assets.ts` holds the stylesheet and the clipboard helper, and derives a content hash for each. The served URL contains that hash, so assets are cached `immutable` and a deploy still reaches browsers immediately.
- Public POST routes use signed CSRF cookies, optional Turnstile, body limits, validation, and per-IP limits.
- Cloudflare Access JWTs are verified at origin through the team JWKS. There is no application password system.
- Historical request/result and deletion records remain intact. Production does not register the old request or response submission modules; isolated legacy test fixtures retain their storage/privacy regression coverage.
- `src/candidates.tsx` reads only one explicitly activated snapshot. Importing a draft cannot change visible names, list labels, ranks, or approval status. Activation and rollback never mutate contact recipients. See [candidate operations](docs/ELECTION_DATA_OPERATIONS.md).

## Visual design

Pico is retuned through its own custom properties rather than by overriding its selectors.

The palette is **techelet and white**, the national colours: `#0038b8` on white. The Flag and Emblem Law describes the colour but fixes no hex; `#0038b8` is the value in common use. These are deliberately the *national* colours and not the gov.il service palette — the canonical package states the project does not represent a state body, and looking like an official government service would work against that.

Two hues only. Techelet carries every action, link, counter and clause number; amber `#9a5b00` appears nowhere except caveats — the permitted-exceptions callout and the "does not recommend how to vote" disclaimer — where a warning colour is the accurate signal. Rank is expressed by scale and weight rather than by hue. A dark counterpart follows `prefers-color-scheme`, lifting techelet toward sky so it stays legible on a dark ground.

Measured contrast: light theme 17.4:1 body text, 9.3:1 links and button labels, 5.4:1 amber; dark theme 15.6:1, 7:1, 8:1. All above WCAG AA, most above AAA.

Readers can override the system setting from the appearance switcher in the footer — light, dark, or follow the system. The choice lives in `localStorage` and is applied by a small render-blocking script served from `/assets/theme-{hash}.js`. It has to be a separate same-origin file rather than the usual inline snippet, because `script-src` carries no `'unsafe-inline'`, and the main bundle is deferred, which would paint the wrong theme first. With scripting off the control is hidden and the system preference applies, so nothing is left broken.

System fonts cover most scripts; Amharic uses the existing bundled same-origin WOFF2 fonts. No new font service is introduced.

The home page opens on ten problem cards. The header consistently offers Problems, Candidates, About, and one language selector. Navigation wraps on narrow screens. The language selector preserves the current issue or candidate filters.

Two Pico behaviours are worth knowing before editing `src/assets.ts`: Pico declares its tokens at `:root:not([data-theme=dark])`, so plain `:root` overrides silently lose; and Pico scales the root font-size with the viewport, so `rem` widths hold a constant line length in characters rather than a constant pixel width.

The product contract and route inventory are in [docs/SPEC.md](docs/SPEC.md). Credential setup is in [docs/SECRETS.md](docs/SECRETS.md). The consolidated contract is [docs/SHARE_FIRST_PLAN.md](docs/SHARE_FIRST_PLAN.md); verification and remaining release checks are in [docs/SHARE_FIRST_VERIFICATION.md](docs/SHARE_FIRST_VERIFICATION.md). Object storage is not part of the deploy ([docs/AWS_S3_SETUP.md](docs/AWS_S3_SETUP.md)).

## Render deployment

`render.yaml` creates one paid Starter web instance with a 5 GB disk mounted at `/data`; SQLite is `/data/app.db`. Keep `numInstances: 1`: a Render persistent disk cannot be shared horizontally, and this MVP intentionally uses one SQLite writer.

1. Create a Render Blueprint from this repository and verify `APP_BASE_URL` matches the assigned domain.
2. Add production perimeter inputs from `docs/SECRETS.md` (`SESSION_SECRET`, `TRUSTED_PROXY*`). No object-store credentials are required.
3. Proxy the production domain through Cloudflare. Cache only public `GET` pages/assets for a short TTL. Bypass cache for every `POST`, `/admin/*`, `/verify-email`, support/request/response/delete forms, and any response carrying `Set-Cookie`.
4. Protect `/admin*` with a Cloudflare Access application whose audience equals `CF_ACCESS_AUD`; require SSO and 2FA in its policy.
5. Set the production perimeter contract described in [docs/SECRETS.md](docs/SECRETS.md): `SESSION_SECRET`, `TRUSTED_PROXY=cloudflare`, a generated `TRUSTED_PROXY_SECRET`, and an HTTPS `APP_BASE_URL`. The server refuses to boot when any required value is absent or malformed.
6. Leave election ETL disabled (`ELECTION_ETL_ENABLED=false`, `ELECTION_ETL_SCHEDULE_ENABLED=false`). Put artifacts only under `/data` if you later enable tooling. Follow [docs/ELECTION_DATA_OPERATIONS.md](docs/ELECTION_DATA_OPERATIONS.md) before any import or schedule enablement.

Render disks require a paid instance and prevent horizontal scaling. Only data under `/data` survives deploys. Rely on the persistent disk (and Render's disk snapshots). Do not configure S3/R2 backup or ledger buckets for this deploy.

## Persistence and recovery

SQLite lives on the Render disk at `/data/app.db`. The web process does not upload scheduled backups and does not require an erasure ledger. Privacy deletion updates live SQLite only.

## Launch gates

Before public launch: complete human review of political/legal translations, run Lighthouse and axe in a configured real browser at 320/768/1024/1440 px, configure Cloudflare/Render monitoring and alerts, and run the load command against staging. Never place secrets in `.env.example` or source control.
