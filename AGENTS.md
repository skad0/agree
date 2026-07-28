# Repository guidance

## Commands

- Requires Node.js 22.13+; install with `npm ci --ignore-scripts`.
- Copy `.env.example` to `.env`; the app boots without third-party keys.
- Use `npm run dev` locally. Run `npm run typecheck` and `npm test` for source changes; `npm test` rebuilds before running compiled Node tests from `dist/test/`.
- Use `npm run smoke` for an isolated compiled-server check, or `npm run smoke:pages` for representative in-process routes.
- Build output is generated in ignored `dist/`; do not edit it.

## Architecture and deployment

- `src/server.ts` is the process entrypoint; `src/app.tsx` creates the server-rendered Hono JSX app and `src/db.ts` owns SQLite access.
- SQL files in `migrations/` apply at boot. SQLite seed text must use literal newlines, not `\n` escape sequences.
- Production is one Render instance using SQLite WAL at `/data/app.db`; keep changes compatible with that single persistent disk model.

## Constraints

- CSP disallows inline scripts and styles. Use server-side RTL geometry/SVG presentation attributes and same-origin hashed theme assets instead.
- Never persist personal appeal text: store only recipient, locale, demand identifiers, and aggregate actions.
- Keep secrets out of source control and `.env.example`.
