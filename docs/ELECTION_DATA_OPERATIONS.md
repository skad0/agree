# Election directory operations (deployment)

Status: schema, directory journey, stances, fail-closed enrichment scaffolding, admin directory activate/rollback, and **draft-only** CEC closed-list artifact import (idempotent draft refresh) are in the application tree. Target election for autumn 2026 is Knesset **26** (see `docs/ELECTION_TARGET.md`). Production ETL and schedule remain **off**. Activation is an explicit admin POST on an **accepted** publication only; dry-run/import never activate.

## Runtime shape

- One Render web instance (`render.yaml`), SQLite at `/data/app.db`, 5 GB disk.
- ETL jobs, if ever enabled, run **in-process** on that same instance. Do not add a second service or assume a Render cron can see `/data`.
- Ordinary page requests must not call government sites. CLI and future scheduled work use the versioned source manifest and bounded HTTPS client.

## Environment (defaults are safe)

| Variable | Production default | Notes |
| --- | --- | --- |
| `ELECTION_ETL_ENABLED` | `false` | Required `true` only after election number + verified manifest resources exist. |
| `ELECTION_ETL_ELECTION_NUMBER` | `26` in `.env.example` | Configurable target; **required** when ETL is enabled. Code default target is also 26 when unset. |
| `ELECTION_ETL_SCHEDULE_ENABLED` | `false` | Requires ETL enabled. Leave false until polling budgets are proven. |
| `ELECTION_ETL_SOURCE_MANIFEST` | unset | Absolute or repo-relative path to the versioned manifest JSON. |
| `ELECTION_ETL_ARTIFACT_DIR` | `/data/election-artifacts` in production | Must live on the persistent disk. Cap total size; do not store unnecessary raw payloads. |
| `SQLITE_PATH` | local `./data/app.db` / prod `/data/app.db` | Import CLI writes here. |

Boot fails closed if ETL is enabled without election number or manifest path. See `src/config.ts` and `.env.example`.

## CLI (operator machine or one-off shell)

```sh
npm run build
node dist/scripts/elections.js source-check [manifest]
node dist/scripts/elections.js dry-run [manifest] [fixture]
node dist/scripts/elections.js import-artifact <closed-list.json>
node dist/scripts/elections.js report
```

Or via npm scripts (rebuilds first):

```sh
npm run elections -- source-check
npm run elections -- dry-run
npm run elections -- import-artifact path/to/closed-list.json
npm run elections -- report
```

- `source-check` loads the manifest; live probe only when `ELECTION_ETL_ENABLED=true`.
- `dry-run` refuses blocked/unverified resources and **never** activates a directory publication.
- `import-artifact` stages official/fixture closed-list JSON into a **draft** `directory_publications` row for the configured target election. Refuses election mismatch. Never activates. Re-running with the same content is a content-hash no-op; a changed file replaces prior **drafts** only and leaves **active**/`accepted` untouched.
- `report` prints local coverage counts from SQLite (includes target election number).

## Refreshing closed-list data in SQLite (operator path)

Machine CEC for Knesset 26 is still **blocked** (CKAN `candidates-lists` only 19–24; gov.il candidates26 → 403 as of 2026-09-12). Until a verified machine resource exists, Anton drops an official closed-list JSON artifact and re-imports.

### Artifact shape

JSON schema `schemaVersion: 1` — see `test/fixtures/elections/cec-knesset-26-closed-lists.fixture.json` and `src/integrations/elections/cec-artifact.ts`.

Required fields:

- `electionNumber` must equal the configured target (`26`)
- `source.publisher`, `source.title`, `source.retrievedAt`, `source.artifactKind` (`official-export` | `manual-official-transcript` | `fixture`)
- Non-empty `rows[]` with `listTitleHe`, `rank`, `familyNameHe`, `givenNameHe`; optional `ballotLetters`, `officialListKey`, `cityPublished`, `status`

### Exact refresh commands

```sh
# 1. Point at the production/staging DB (Render disk or local copy)
export SQLITE_PATH=/data/app.db   # or a local path for dry practice
export ELECTION_ETL_ELECTION_NUMBER=26

# 2. Stage / replace draft from the closed-list file (never activates)
npm run elections -- import-artifact /path/to/cec-knesset-26-closed-lists.json

# 3. Inspect coverage + sample lists from the CLI JSON output, then:
npm run elections -- report
```

CLI `import-artifact` JSON report includes:

| Field | Meaning |
| --- | --- |
| `result.unchanged` | `true` if an identical draft already existed (content-hash short-circuit) |
| `result.publicationId` / `publicationStatus` | Always `draft` on success |
| `result.replacedDraftPublicationIds` | Prior drafts rolled back by this refresh |
| `result.activePublicationId` | Active publication left untouched (or null) |
| `result.listsCreated` / `listsUpdated` / `peopleCreated` / `candidaciesReused` | Delta hints |
| `activePublicationsBefore` / `After` | Must stay equal; process exits `2` if active count rises |
| `sampleLists` | Up to five electoral lists for spot-check (keys, ballot letters, titles) |

### Safety gates (do not skip)

1. **Import never activates.** Only Admin → Directory can activate, and only an **`accepted`** publication (not draft).
2. **Draft replace does not touch active or accepted** publications, nor `recipient_entity_links`.
3. **Election mismatch is refused** (`artifact.electionNumber !== ELECTION_ETL_ELECTION_NUMBER` / target).
4. **Fixture data must not be activated** in production. Use `artifactKind: "fixture"` only for staging/tests.
5. After human review: mark publication **accepted** (review workflow), then **activate** via admin POST. Keep a rollback path: Admin → Directory → Rollback active.
6. Re-import the same official file anytime lists change; identical content is a no-op; changed content rolls back old drafts and opens a new draft for review.

### Admin accept → activate → rollback

1. Import → status `draft` (CLI above).
2. Reviewers accept entity links / publication (existing admin review; activate refuses drafts).
3. `POST /admin/directory` with `action=activate` + CSRF (admin JWT only) on an **accepted** publication id.
4. To undo: `action=rollback` on the **active** publication; previous accepted version can be restored per repository rules.
5. Every mutation writes `admin_audit_events`; moderator role cannot activate.

## Deploy checklist (election stack)

1. Deploy with ETL flags **false** (Blueprint defaults). Migrations `016`/`017` apply at boot; imported recipients stay unpublished until an accepted publication is activated deliberately.
2. Confirm `/health`, seven locale homes, `/en/request` (and one RTL locale), `/admin` via Access.
3. Do **not** set `ELECTION_ETL_ENABLED=true` until: CEC/finance machine contracts are closed in the manifest (Knesset 26 CKAN resource still **blocked** as of 2026-09-12); a complete dry-run against fixtures passes; the SQLite disk still has headroom with the new tables.
4. Artifact directory under `/data` only. Keep within the disk budget alongside `app.db`. Official closed lists may be staged via `import-artifact` into draft; do not activate unreviewed imports.
5. After any future publication activation (Admin → Directory), verify rollback to the previous publication version and that old single-recipient links still resolve. Confirm list/party filters only appear for reviewed affiliations (joint-list candidates need `candidacy_party_memberships`). Party-fallback send uses verified `candidate_contact_resolutions` only — never invents addresses.

## What this deploy does **not** do

- No automatic import of CEC or finance data.
- No activation of imported candidates into the selectable directory.
- No guarantee that list/party filters are populated until enrichment + publication land.
- Human translation review and participant UX testing remain launch gates, not deploy gates.
