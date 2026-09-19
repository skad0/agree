# Election directory operations (deployment)

Status: the public directory is read-only and snapshot-based. The September 19 transcript has 38 lists and 1,379 candidates, explicitly submitted, not approved. No production activation was performed during implementation. Automatic import and scheduling remain **off**.

## Runtime shape

- One Render web instance (`render.yaml`), SQLite at `/data/app.db`, 5 GB disk.
- ETL jobs, if ever enabled, run **in-process** on that same instance. Do not add a second service or assume a Render cron can see `/data`.
- Ordinary page requests must not call government sites. CLI and future scheduled work use the versioned source manifest and bounded HTTPS client.

## Environment (defaults are safe)

| Variable | Production default | Notes |
| --- | --- | --- |
| `ELECTION_ETL_ENABLED` | `false` | Required `true` only after election number + verified manifest resources exist. |
| `ELECTION_ETL_ELECTION_NUMBER` | `26` | Selects the public directory election; does not import or activate data. |
| `ELECTION_ETL_SCHEDULE_ENABLED` | `false` | Requires ETL enabled. Leave false until polling budgets are proven. |
| `ELECTION_ETL_SOURCE_MANIFEST` | unset | Absolute or repo-relative path to the versioned manifest JSON. |
| `ELECTION_ETL_ARTIFACT_DIR` | `/data/election-artifacts` in production | Must live on the persistent disk. Cap total size; do not store unnecessary raw payloads. |

Boot fails closed if ETL is enabled without election number or manifest path. See `src/config.ts` and `.env.example`.

## CLI (operator machine or one-off shell)

```sh
npm run build
node dist/scripts/elections.js source-check [manifest]
node dist/scripts/elections.js dry-run [manifest] [fixture]
node dist/scripts/elections.js import <transcript.json>
node dist/scripts/elections.js activate <publicationId>
node dist/scripts/elections.js report
```

- `source-check` loads the manifest; live probe only when `ELECTION_ETL_ENABLED=true`.
- `dry-run` refuses blocked/unverified resources and **never** activates a directory publication.
- `import` loads a manual official transcript and writes a **draft** publication. It needs no
  network and ignores `ELECTION_ETL_ENABLED`; the public directory is unchanged until activation.
  Re-importing normalized identical content returns `already_imported` with CLI exit code 0. Retrieval timestamp alone does not create a new snapshot.
- `activate` atomically selects a validated snapshot for the read-only directory. It changes no contact recipients. The previous publication becomes `rolled_back`. Run `activate <previousPublicationId>` to roll back data.
- `report` prints local coverage counts from SQLite.

## Candidate transcripts

`data/elections/knesset-26-lists.json` is a transcript of the official CEC pages, taken with a
browser because the host returns HTTP 403 to non-browser clients. Shape and rules:

- `source.approvalState` is `submitted_not_approved` or `approved`. Submitted lists are what the
  parties filed; the CEC approves them later. The directory banner is driven by this field, so
  never label a submitted transcript as approved to make the notice go away.
- `fullNameHe` is authoritative. The CEC publishes one concatenated string, family name first, and
  the family/given split is not mechanically derivable (`השכל שרן מרים` is Haskel / Sharan Miriam,
  not `השכל שרן` / `מרים`). `candidacy_versions.given_name_raw` and `family_name_raw` stay null
  until a reviewed source fills them.
- `ballotLetters` are the letters as submitted. They are neither final nor unique across lists
  (`ב`, `כן`, `יד` and `רץ` each appear twice in the 26th-Knesset submissions). Never key on them.
- A list that publishes no roster is recorded with `rosterPublished: false` and zero rows, and the
  directory says how many such lists exist. Do not fill those rows from media or encyclopedias:
  the import refuses a list that claims a roster but carries none, and vice versa.

Migration `021` stores approval metadata and list labels in snapshot-owned tables. Public reads never combine an active roster with mutable identity-table labels. A pre-021 active publication is not displayed until its source is reviewed and re-imported with `transcript-2`; do not fabricate missing historical metadata. The unique active-publication index fails migration if an existing database has multiple active publications for an election; inspect and resolve those records deliberately before retrying.

Imported candidates need no contact channel and produce no recipient records. Each snapshot creates fresh person/candidacy rows rather than guessing identity across snapshots. Reviewed identity matching remains separate and no automatic schedule is enabled.

`source.approvalState=approved` requires an official HTTPS `approvalEvidenceUrl`; review the actual source before import. Schema/election mismatches, non-boolean roster flags, duplicate list keys/ranks, rank gaps, unknown row references and count mismatches fail validation. Missing-roster lists remain explicit.

Review [the September 19 source diff](CANDIDATE_REFRESH_2026-09-19.md) before importing. Use a staging/local database first. No page request fetches official sources.

## Deploy checklist (election stack)

1. Deploy with ETL flags **false** (Blueprint defaults). Migrations through `021` apply at boot. Take a recoverable SQLite backup first. Imported drafts stay unpublished until explicitly activated.
2. Confirm `/health`, seven locale homes, `/en/issues/elections-on-time`, `/en/candidates` (and one RTL locale), `/admin` via Access.
3. Do **not** set `ELECTION_ETL_ENABLED=true` until: election number confirmed; CEC/newer and finance contracts closed in the manifest; a complete dry-run against fixtures passes; the SQLite disk still has headroom with the new tables.
4. Artifact directory under `/data` only. Keep within the disk budget alongside `app.db`.
5. After any future publication activation, verify rollback to the previous publication version and that historical result links and legacy request redirects still resolve.

## What this deploy does **not** do

- No automatic import of CEC or finance data.
- No automatic activation of imported candidate snapshots.
- The directory remains empty until a compatible snapshot is activated.
- Human translation review and remaining browser/device/assistive-technology checks remain release gates; see SHARE_FIRST_VERIFICATION.md.
