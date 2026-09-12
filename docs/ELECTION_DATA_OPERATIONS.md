# Election directory operations (deployment)

Status: schema, directory journey, stances, fail-closed enrichment scaffolding, and admin directory activate/rollback are in the application tree. Production import and schedule remain **off** until the target election and source contracts are confirmed. Activation is an explicit admin POST on an **accepted** publication only; dry-run/import never activate.

## Runtime shape

- One Render web instance (`render.yaml`), SQLite at `/data/app.db`, 5 GB disk.
- ETL jobs, if ever enabled, run **in-process** on that same instance. Do not add a second service or assume a Render cron can see `/data`.
- Ordinary page requests must not call government sites. CLI and future scheduled work use the versioned source manifest and bounded HTTPS client.

## Environment (defaults are safe)

| Variable | Production default | Notes |
| --- | --- | --- |
| `ELECTION_ETL_ENABLED` | `false` | Required `true` only after election number + verified manifest resources exist. |
| `ELECTION_ETL_ELECTION_NUMBER` | unset | Required when ETL is enabled. |
| `ELECTION_ETL_SCHEDULE_ENABLED` | `false` | Requires ETL enabled. Leave false until polling budgets are proven. |
| `ELECTION_ETL_SOURCE_MANIFEST` | unset | Absolute or repo-relative path to the versioned manifest JSON. |
| `ELECTION_ETL_ARTIFACT_DIR` | `/data/election-artifacts` in production | Must live on the persistent disk. Cap total size; do not store unnecessary raw payloads. |

Boot fails closed if ETL is enabled without election number or manifest path. See `src/config.ts` and `.env.example`.

## CLI (operator machine or one-off shell)

```sh
npm run build
node dist/scripts/elections.js source-check [manifest]
node dist/scripts/elections.js dry-run [manifest] [fixture]
node dist/scripts/elections.js report
```

- `source-check` loads the manifest; live probe only when `ELECTION_ETL_ENABLED=true`.
- `dry-run` refuses blocked/unverified resources and **never** activates a directory publication.
- `report` prints local coverage counts from SQLite.

## Deploy checklist (election stack)

1. Deploy with ETL flags **false** (Blueprint defaults). Migrations `016`/`017` apply at boot; imported recipients stay unpublished until an accepted publication is activated deliberately.
2. Confirm `/health`, seven locale homes, `/en/request` (and one RTL locale), `/admin` via Access.
3. Do **not** set `ELECTION_ETL_ENABLED=true` until: election number confirmed; CEC/newer and finance contracts closed in the manifest; a complete dry-run against fixtures passes; the SQLite disk still has headroom with the new tables.
4. Artifact directory under `/data` only. Keep within the disk budget alongside `app.db`.
5. After any future publication activation (Admin → Directory), verify rollback to the previous publication version and that old single-recipient links still resolve. Confirm list/party filters only appear for reviewed affiliations (joint-list candidates need `candidacy_party_memberships`).

## What this deploy does **not** do

- No automatic import of CEC or finance data.
- No activation of imported candidates into the selectable directory.
- No guarantee that list/party filters are populated until enrichment + publication land.
- Human translation review and participant UX testing remain launch gates, not deploy gates.
