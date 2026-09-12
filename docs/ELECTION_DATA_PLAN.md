# Israeli election enrichment: verified architecture and implementation plan

Status: slices 1–5 merged; slice 6 verification hardening landed. **Target election confirmed: Knesset 26** (autumn 2026; evidence in `docs/ELECTION_TARGET.md`). Configurable default `electionTargetElectionNumber = 26`. CEC machine feed for 26 still blocked in the manifest; draft-only closed-list **artifact import** path added. Party-fallback send destinations wired from verified resolutions (no invented contacts). Finance contract still blocked. No production import activation, no unreviewed imported recipients published, no production stance seeds. Remaining gates: close CEC-26 + finance machine contracts; import one reviewed official closed-list artifact (still draft until accept/activate); parliamentary enrichment; participant UX/a11y and translation review.
Audit date: 2026-09-12. Repository baseline includes merged PRs #2–#6 plus slice-6 verification.

This adapts the supplied mission to the existing civic platform. Build a repeatable, source-attributed candidate directory, parliamentary enrichment, explicit contact resolution, and election-scoped financial transparency. Coverage must be measurable; missing data must remain missing rather than being inferred as fact.

**User-journey extension:** [Recipient journey verification](RECIPIENT_JOURNEY_VERIFICATION.md) is part of this plan and defines the subsequently requested visual directory, name/list/party search, filters, multiselect, sequential personal handoffs and reviewed question-specific stances. It supersedes earlier final-scope limits to one recipient and earlier deferral of public stance presentation. Single-recipient compatibility remains; a private confirmed response still does not become public automatically. The original ETL/source-verification work remains required.

The journey plan's section 8 specifies autosuggest in the search text box, integration with existing request routes, accessible question explanations and mandatory reuse of the current theme/components. Suggestions identify names, parties and lists and narrow results; adding recipients remains an explicit manual selection. Existing question defaults are defined separately. These requirements are part of the planned delivery.

## 1. Verified repository findings

| Area | Observed implementation | Consequence |
| --- | --- | --- |
| Runtime | `package.json`: Node >=22.13, npm lockfile, TypeScript 5.9.3, ESM; local Node 24.18.0 | Implement in TypeScript; retain npm and existing compilation/test conventions. |
| Web | Hono 4.12.29, server-rendered JSX; `src/server.ts` starts `src/app.tsx` | ETL must run independently of page requests. No framework replacement. |
| Persistence | `src/db.ts`: built-in `node:sqlite` DatabaseSync, prepared raw SQL, foreign keys, WAL, 5-second busy timeout | Add SQL migrations and typed query modules; no ORM required. Keep transactions short because SQLite calls are synchronous. |
| Migrations | Files 001–015; filename tracking in `schema_migrations`, each applied in `BEGIN IMMEDIATE` at boot | Reserve the next available numbers at implementation time. No downloads or changing external data inside migrations. |
| Existing directory | `recipients`, `recipient_translations`; email, WhatsApp, website, social data; party/politician type | Preserve IDs and references from requests/responses. Add an explicit bridge to enriched entities. |
| Existing Knesset seed | Migration 006 describes a snapshot dated 2026-07-31 of 89 members, including null emails, sourced through PersonToPosition | This is a historical seed, not a verified complete current roster. IDs resembling PersonID are not an identity contract. |
| Missing models | No election, candidacy, legal-party, faction-history, source-provenance, matching-review, or finance schema | Add these separately from user activity. |
| Jobs | `src/server.ts`: daily backup timer and one-minute response maintenance; `src/response-storage.ts`: persisted object-deletion work, capped backoff, in-process overlap guard | No general queue or external scheduler. Use a separate SQLite-backed election job runner on the same instance; reuse the architectural pattern, not the deletion queue. |
| HTTP | Native `fetch` in email, security, S3 modules; some calls use `AbortSignal.timeout` | Introduce an election-specific HTTP wrapper. No existing universal retry/cache policy. Incoming per-IP limits do not limit outgoing source requests. |
| Configuration | `src/config.ts` reads supplied/process environment; `.env.example` documents deployment/security/storage values | Add optional ETL settings, disabled by default. No automatic `.env` loading was found in the inspected entry/config code; implementation must document actual environment injection. |
| Deployment | `render.yaml`: one instance, `/data/app.db`, 5 GB persistent disk, Node 24.16.0 configured | Keep jobs on that instance and disk. Do not assume a separate Render cron service can access this database. |
| Product constraints | `AGENTS.md`, current request routes and `docs/main-page-redesign-strategy/DATA_COVERAGE_MAP.md` | Preserve appeal-text non-persistence, seven locales, CSP, existing IDs and old single-recipient links while adding the requested multiselect journey. Public directory activation is separate from collecting records. |

Verification was read-only against repository inputs. No production database was inspected. On the second pass, all 15 migrations were executed against an isolated in-memory SQLite database: integrity check was `ok`, foreign-key check returned no violations, and the seed produced one party and 89 politicians. There were 90 recipient names each in Hebrew and Ukrainian, but only one each in the other five locales. There were 89 active recipients with email or WhatsApp before applying locale filters. These are seed facts, not live-directory coverage. `node_modules/typescript` is absent; typecheck/tests were not run for this documentation-only audit. Source changes will require installation and the repository checks.

### Reconciliation with project documents

The second audit inspected `docs/SPEC.md`, `README.md`, `STATUS.md`, both redesign planning documents, `docs/TRANSLATION-REVIEW.md`, and the text of the canonical Russian DOCX, as well as the request/admin/response/backup code and all migrations. Current code and migrations establish current behavior; the canonical document establishes editorial boundaries. Older status/spec claims are not treated as current implementation facts: they still mention six locales, placeholder-only recipients, HTMX and workers being out of MVP scope, while the code has seven locales, 89 seeded politicians, native forms and a bounded maintenance task.

This ETL is a requested extension to the MVP. Its persisted jobs extend the old no-queues scope through an in-process maintenance runner, without adding an external worker service. During implementation, amend the relevant SPEC/README sections to describe that explicit extension rather than silently declaring compliance with the old scope. The redesign's ban on a legacy renderer/feature-version gate remains intact: a directory publication version is a data snapshot, not a second UI or campaign feature flag.

The canonical package requires equal questions and treatment, no party ranking or voting recommendations, no electoral-preference database, and user-controlled sending. Consequently:

- Apply the same source rules and completeness reporting to every list. Order by an explicit neutral rule such as official list order/name and candidate rank; do not select recipients using donations, popularity, assumed ideology or supporter activity.
- Finance enrichment is factual source data. Do not introduce a party score, endorsement, corruption inference or personalized recommendation. Distinguish missing data from a favorable or unfavorable finding.
- Use the existing ten standard demands unchanged. Do not automatically insert finance allegations, donor names or personalized political conclusions into appeal templates.
- Preserve private response intake and moderation. Directory publication does not authorize publishing received responses or describing an unverified sender as the party's official position.
- Preserve the documented right to correct source-backed records and retain material change history. Non-Russian political/legal copy still requires the existing human translation review; importing data does not clear that launch gate.

## 2. External source verification and corrections to the prompt

Read-only live Node fetch probes succeeded after the network sandbox restriction was lifted for those requests. A successful sample/schema request proves accessibility and observed fields, not full-dataset completeness or long-term reliability.

| Source | Verified evidence | Planning implication |
| --- | --- | --- |
| [CEC CKAN package](https://data.gov.il/api/3/action/package_show?id=candidates-lists) | HTTP 200; six candidate resources named for Knessets 19–24, with DataStore enabled | Do not treat this package as a current-election feed. Target election must be explicit. Absence here does not establish absence elsewhere. |
| [CEC 21 sample](https://data.gov.il/api/3/action/datastore_search?resource_id=597e0059-099e-4200-9131-b3ba645bc685&limit=1) | HTTP 200, success=true, reported total 1,626. Fields include `מס' כנסת`, `שם הרשימה`, `אותיות`, `מיקום ברשימה`, `שם משפחה`, `שם פרטי`; no city field | Map actual headers per resource. City is optional; list name and ballot letters are election-specific. Total is source-reported, not independently reconciled. |
| [CEC 25 landing page](https://www.gov.il/he/departments/dynamiccollectors/election-candidates25) | Official page found by search; direct fetch returned HTTP 403 | Current/newer CEC list extraction is not verified. Discover the exact approved publication, format and revision; use an official export/manual artifact import if automated access is unavailable. Do not bypass access controls. |
| [Knesset metadata](https://knesset.gov.il/Odata/ParliamentInfo.svc/$metadata) and [person sample](https://knesset.gov.il/Odata/ParliamentInfo.svc/KNS_Person?$top=1&$format=json) | Both HTTP 200. Person exposes PersonID, FirstName, LastName, Email, IsCurrent, LastUpdatedDate. Sample JSON uses a `value` array. No photo field | Verify portrait sources separately. Nullable email is expected. Do not assume all people in this entity are MKs. |
| Knesset related entities, verified in the same metadata | PersonToPosition exposes PersonID, PositionID, KnessetNum, start/finish dates, faction and committee IDs/names, IsCurrent. Position exposes descriptions. Faction exposes identity/term/dates, but no email/phone. Committee exposes Email | Determine MK service through position records and validated role descriptions. Faction resolves affiliation, not a contact channel. Committee email is not an individual's email. |
| [Party Registrar package](https://data.gov.il/api/3/action/package_show?id=justice-miflagot), [sample](https://data.gov.il/api/3/action/datastore_search?resource_id=1dbfc053-e92f-4354-92d6-1b99aadb20d7&limit=1) | HTTP 200. CSV/DataStore resource `1dbfc053-e92f-4354-92d6-1b99aadb20d7`; reported total 170. Name, registration number, objectives, address, email, registration date; no phone. Sample email has `mailto:` prefix | Normalize published emails, including non-government domains; distinguish party registration number from faction ID. Phone remains absent unless another official source supplies it. |
| [Registrar catalogue](https://data.gov.il/he/datasets/ministry_of_justice/justice-miflagot) | Describes monthly updates and email where supplied | Do not promise contact completeness. A registered address is not necessarily a campaign headquarters. |
| [Comptroller public finance page](https://www.mevaker.gov.il/state-audit/elections/donations) | HTTP 200. Describes public donation/guarantee/loan data as supplied by reporters, without Comptroller processing | Public reporting and audited findings need distinct metadata. Exact record/export endpoints, pagination, fields, and election coverage remain unverified. Finance adapter begins with a contract-discovery gate. |

Additional corrections:

- Preserve separate entities for people, election candidacies, electoral lists, registered parties and parliamentary factions. Lists may contain multiple parties, and names/affiliations change over time.
- A matched historical MK does not automatically have a usable current parliamentary mailbox. Contact status requires its own evidence and freshness.
- Both primaries finance and party guarantees may exist for the same political organization. They are independent enrichments, not mutually exclusive fallback branches.
- Reported donations do not necessarily equal all funds raised. Never calculate foreign-donation percentages from names or cities, or equate donation-row count with unique donors.

## 3. Data model proposal

Use additive migrations in three groups: identity/provenance, enrichment/finance, and jobs/publication. Names below are proposed. Use INTEGER internal primary keys, explicit TEXT external identifiers, foreign keys and source/effective timestamps. JSON is TEXT with `CHECK(json_valid(...))` and a payload schema version; frequently queried fields remain relational.

| Tables | Key fields and constraints |
| --- | --- |
| `elections`, `electoral_lists` | Election number unique; publication status/date. List belongs to election; official list key when available, ballot letters, exact Hebrew title, source revision. Ballot letters are not global identity. |
| `people`, `candidacies`, `candidacy_versions` | Person has nullable unique Knesset PersonID and preserved names. Stable candidacy belongs to election/list and has a nullable person link. Version has candidacy ID, snapshot ID, rank > 0, raw first/last names, nullable published city, status and source record ID; UNIQUE(snapshot_id, list_id, rank), and one version per candidacy per snapshot. Do not identify a person by name or rank alone. |
| `candidacy_party_memberships` | Explicit reviewed individual-to-party affiliation within an election/list, with effective dates and source evidence; a multi-party list alone cannot establish this. |
| `parties`, `factions`, `electoral_list_parties`, `faction_parties` | Unique registrar number / Knesset FactionID where supplied; term/effective dates; reviewed many-to-many mappings with evidence. |
| `parliamentary_positions`, `committees` | Unique source position-record ID; person, role, term, faction/committee, start/end and current flag; preserve history. Photo URL/snapshot reference is nullable on person metadata. |
| `contact_points`, `candidate_contact_resolutions` | Explicit owner FK (person, party or faction, exactly one), channel, normalized value, source, observation/verification/expiry dates. Resolution references candidacy and chosen contact; `contact_level`: individual / party_fallback / unresolved; status: verified / stale / missing / needs_review. CHECKs prevent individual contact labels on party contacts. |
| `source_snapshots`, `source_records` | Source URL/resource, fetch/publication time, content hash, parser version, media type, bounded artifact reference, extraction state and completeness. Record key unique per snapshot. Accepted fields link to records; material changes retain prior evidence. |
| `identity_matches`, `entity_aliases`, `review_decisions` | Proposed person/party links, normalized keys, algorithm version, score/features, conflicting candidates, pending/accepted/rejected state; reviewer/time/reason. Approved overrides persist across imports until explicitly revoked. |
| `entity_translations`, `recipient_field_overrides` | Locale-specific reviewed names/labels with source and review status; one explicit person/party/faction/committee owner. Override is keyed by recipient and allowed field, with reviewer, source, timestamp and explicit clear/revoke state. It can pin a reviewed value or intentional null without destroying imported evidence. |
| `finance_reports`, `finance_entries`, `finance_summaries` | Subject person or party (exactly one), election/primary contest and reporting period, source report/revision, reported/audited status. Entries distinguish donation/refund/loan/guarantee, amount in integer minor units, currency, published donor/guarantor name and city, country when supplied, stable source entry key. Summary stores bounded versioned audit JSON and calculation/coverage metadata. |
| `etl_jobs`, `etl_runs`, `etl_checkpoints` | Unique deduplication key, source/election/stage, pending/running/retry/succeeded/failed/blocked state, attempt budget, next due time, lease token/expiry, checkpoint and bounded error code. Runs track row counts, missing fields, review counts and active publication. |
| `recipient_entity_links`, `directory_publications` | Explicit mappings to existing recipient IDs; one checked person/party target per mapping. Versioned accepted projection, prior version and activation time; no IDs inferred from numerical resemblance. |
| `program_question_versions`, `public_stances`, stance evidence/translations | Versioned standard-demand context and reviewed person/party/list statements with attribution, publication state, source and dates; see the journey document for classification, publication/privacy boundaries and tests. |

Identity reconciliation must survive a corrected list rank or spelling: reconcile source identities/revisions first; ambiguous replacements enter review. A source refresh must not create duplicate people or collapse two people with the same name. Use soft status/history for withdrawals; do not delete referenced recipients.

Required SQL indexes include jobs(state, next_attempt_at), jobs(lease_expires_at), candidacies(election_id, list_id), versions(snapshot_id, list_id, rank), positions(person_id, knesset_num), contact resolutions(candidacy_id), matches(state, created_at), finance entries(report_id, source_entry_key), and translations(owner, locale). Enforce unique source-record keys within snapshots, positive ranks, explicit owner CHECKs, supported enum states and valid date/amount parsing. Avoid polymorphic IDs without enforceable foreign keys. Source timestamps use UTC ISO strings; distinguish publication, observation and effective time. Effective dates, not fetch order alone, determine which assertion applies.

Store only necessary public-source fields. Exclude national identity numbers, private contact discovery and unnecessary full donor addresses from retained payloads. Raw artifacts require field inspection, size/retention limits and private storage; hashes and minimal permitted fixtures may be retained when full artifacts are inappropriate. No linkage to supporters, appeal text or individual targeting history.

## 4. Modules and execution model

```text
src/integrations/elections/
  types.ts                  # canonical records and adapter contracts
  http.ts                   # bounded fetch, retry, allowlist and cache
  sources/{cec,knesset,registrar,comptroller}.ts
  normalize-hebrew.ts
  matching.ts
  contacts.ts
  finance.ts
  repository.ts             # prepared SQL and bounded transactions
  pipeline.ts               # acquire -> stage -> validate -> enrich -> publish
  jobs.ts                   # persisted scheduling, leases and checkpoints
  publication.ts            # accepted directory projection and rollback
scripts/elections.ts         # source-check / dry-run / import / resume / report
test/elections-*.test.ts
test/fixtures/elections/     # minimized, source-dated fixtures
docs/ELECTION_DATA_OPERATIONS.md
```

After approval, add a disabled-by-default scheduler hook in `src/server.ts`, and source/election configuration in `src/config.ts` / `.env.example`. Initially operate through the CLI, then enable persisted due-job scheduling on the existing instance. Do not introduce Redis, BullMQ or a second database for this scale.

Each job acquires an expiring SQLite lease with a fencing token; writes and checkpoints verify token ownership so a resumed worker cannot race an expired one. Fetch outside transactions, validate before writes, commit bounded batches, and yield between batches. Shutdown cancels requests and releases/lets leases expire before closing SQLite. Review failures and upstream outages do not prevent the web app from starting.

A CLI dry-run uses isolated staging and never changes published recipients. Promotion requires a complete validated core CEC snapshot. Optional source failures retain previous valid enrichment with an explicit stale state. A truncated response or failed page must never remove people. Manual imports use the same parser, provenance, validation and review gates.

## 5. Hebrew normalization and matching

Preserve original text for display/evidence. Build a versioned comparison key using Unicode normalization, removal of Hebrew combining marks (niqqud/cantillation), trimming/collapsing Unicode whitespace, removal of comparison-only bidi/zero-width controls, and canonical treatment of maqaf/hyphens and geresh/gershayim/quote variants. Keep meaningful name tokens.

Use separate weaker keys for final-letter variants, token-order variations and curated spelling aliases. Do not globally remove vav/yod to handle ktiv male/chaser: that can merge different names. Treat those differences as weighted fuzzy evidence only. Handle Arabic-script/source names without pretending the Hebrew normalizer transliterates them.

Matching order: approved external-ID mapping; approved alias; unique normalized full-name candidate with independent corroboration; otherwise scored proposals for review. Use role/term and source-backed affiliation or city as supporting evidence, not hard equality rules. Ambiguous names, contradictory IDs, or fuzzy-only matches cannot auto-publish identity, contacts or finance. Calibrate thresholds on reviewed positive/negative fixtures; do not choose an arbitrary universal score. Preserve rejections and reviewer overrides.

## 6. Contact and finance semantics

Resolve contact independently from identity. Prefer a published, sufficiently recent person email; otherwise follow a reviewed electoral-list-to-party/faction mapping to a published organizational channel. Store its actual owner and display that it reaches the party. Multi-party lists require a reviewed candidate-to-party assignment or an explicitly designated list contact; do not pick a party arbitrarily. Strip an email's `mailto:` prefix, reject malformed values and never manufacture an address or send verification messages. Source-verified means published by the source, not proven deliverable.

A historical Knesset email remains historical unless refreshed. A missing or stale individual channel can use a fresh party fallback. If neither is supported, use unresolved; do not label every non-MK as party_fallback. Phone is not automatically WhatsApp.

Finance computations are per contest/reporting period and currency. Preserve corrections/refunds and deduplicate by source transaction identity; do not merge equal-looking legitimate donations. Derive unique-donor count only when source identifiers or an explicit defensible method support it; otherwise null plus donation count. Top donors group only when identity is supported and show name/city/amount/source.

Separate gross donations, refunds, net donations, loans, guarantees and reported total funding. Foreign-donation share requires explicit source country/classification and a declared numerator/denominator; unknown origin is shown separately, and zero/unknown denominators produce null. Use source-provided ILS conversions or retain currency-separated totals. Never assign party guarantees as a candidate's personal finance. Missing, not applicable, not yet published and failed are distinct from zero.

## 7. Reliability and operational defaults

These are proposed conservative client defaults, not verified upstream quotas:

- One concurrent request per host, initially one request/second; configurable per source. Download each source once per run and match locally, avoiding person-by-person scans.
- 20-second request deadline; bounded response bytes, records/pages and total run duration. Allow only configured HTTPS source/download hosts, including reviewed CKAN resource hosts; validate redirects and pagination URLs.
- For 429, honor Retry-After (seconds/date), persist cooldown and yield long waits. Retry transient timeouts and 5xx with jittered exponential backoff, maximum five attempts. Schema changes, 403 and invalid payloads pause that source for review instead of retry storms.
- Cache by URL/query and content hash; use ETag/Last-Modified when available. Keep last successful snapshots independently of failed fetches. Handle OData continuation links and CKAN deterministic paging; detect repeated pages, changed totals and incomplete snapshots. Exact OData continuation field remains to be fixture-verified.
- Suggested polling: CEC daily once its target publication exists; Knesset daily; Registrar weekly (catalogue says monthly updates); finance weekly initially. Persist due times and resume after restarts. Validate expiry policy before publishing contact choices.
- Retain active and previous accepted snapshots plus 30 days of intermediate permitted artifacts; set a total artifact budget within the 5 GB disk (initial proposal 250 MB), with alerts before exhaustion. Preserve provenance needed by retained facts. Review this against actual artifact sizes before enabling schedules.
- Structured run logs contain source/stage/status/counts/duration/error codes, not raw response bodies. Operational reports show core coverage, matching review backlog, contact coverage/staleness, finance coverage and last success per source. `/health` stays a web liveness check; source outages appear in job/admin status.
- Existing SQLite backup covers ETL tables. If artifacts live outside SQLite, back up their manifest and required objects consistently. Test restoring accepted publication/checkpoints and cancel stale leases after restore.

## 8. Implementation sequence and acceptance gates

1. **Confirm election and close source contracts.** Capture metadata and minimized sample fixtures for selected CEC publication, related Knesset position/committee data, Registrar, portraits and finance. Verify role IDs, all-page behavior, field types, corrections and attribution/usage requirements. Deliver a source manifest marking supported, unavailable and blocked fields. Newer CEC and finance ingestion cannot be called verified until this passes.
2. **Add schema and ingestion foundation.** Add the next migrations, source manifest, bounded HTTP client, staging, CLI and durable jobs. Test old-database migration, foreign keys, duplicate imports, interrupted/resumed jobs, two competing runners and parser drift. No external calls during migration or normal page requests.
3. **Import one complete CEC election.** Reconcile every list and candidate against its selected official snapshot; require zero unexplained dropped rows, duplicate ranks or wrong-election rows. Test revised names/ranks, withdrawals, empty pages and mid-fetch changes. Publish no guessed identity links.
4. **Add parliamentary and contact enrichment.** Import role/committee history, match reviewed fixtures, resolve Registrar mappings and contact states. Test homonyms, spelling variants, historical/current role differences, coalitions, missing/stale channels and override persistence. Add portraits only after verifying their source/usage and same-origin caching; otherwise retain placeholders.
5. **Add finance adapter and summaries.** Verify actual record/export contract first. Test donations/refunds/currencies/unknown countries, legitimate repeated transactions, report revisions and party versus personal scope. Reconcile sample computed totals to source reports; keep reported and audited states distinct. If no reliable machine feed exists, support provenance-preserving official artifact imports and report the automation limitation.
6. **Integrate reviewed publication and operate.** Start with the existing single-recipient experience, bridging explicit IDs. Show fallback owner, source date and missing/stale states across seven locales; preserve existing request IDs and privacy rules. Add admin review/status using existing authorization. Test rollback to previous publication, backup/restore, source outage during serving and bounded import impact on web responsiveness.

For source changes run `npm ci --ignore-scripts`, `npm run typecheck`, `npm test`, and relevant smoke checks (`npm run smoke`, `npm run smoke:pages` when routes/server change). The build script contains Unix-style `mkdir -p`/`cp`; verify a compatible shell on Windows or fix portability in a separately identified prerequisite. Never edit generated `dist/`.

Tests should use fixtures and injected fetch/clock; ordinary CI must not depend on live government sites. Explicit live source checks validate contracts separately. Production readiness requires complete core-list reconciliation, visible optional-field coverage, tested recovery, and no unresolved identity match being treated as verified. It does not mean 100% email/photo/finance availability.

### Repository-specific integration requirements found on recheck

These are part of the implementation scope and acceptance criteria, not optional follow-up work.

**One shared directory query and resolver.** Add `src/recipients.ts` (or an equivalently named shared module) to serve the current request selection/build/preview/action paths, response recipient selection, and admin directory views. `src/requests.tsx:recipientRows()` currently requires an exact locale translation plus active email/WhatsApp; a website or social handle alone is not sufficient. Preserve this eligibility rule for sending. Keep unresolved profiles in staging/admin coverage reports; a future public browse-only profile must be clearly non-contactable. Response intake may retain its existing broader recipient eligibility, but must use the same identities and truthful names. No arbitrary profile/API route or group-send feature is implied by ETL.

**Newcomer titles and template wording.** `mention()` currently turns every `politician` into the localized Knesset-member label. Replace this with source-backed role wording, or a neutral name when no current role is known. Keep recipient type `politician` compatible; it does not itself prove current MK service. Inspect all email/WhatsApp/social template salutations so an appeal via a party fallback describes the person requested and the organization actually receiving it. A seed party template must not silently misdescribe an individual candidate. Preserve standard demand IDs and template editing behavior.

**Contact publication and action consistency.** Never flatten a fallback party email into a person's direct email field. The accepted projection stores the resolution and actual owner, and the shared resolver supplies the destination with a visible fallback label. At preview, bind the selected contact/publication fingerprint into signed transient form state; at action, recheck recipient activation, contact validity/owner and that fingerprint. If any destination or relevant label changed, require a fresh preview and do not record an opened-email/WhatsApp action. Existing request capability and CSRF checks remain mandatory. For legacy previews without the new binding, require re-preview before direct-contact handoff. Do not add appeal text, donor data or contact history to `generated_requests`. Recipient/public IDs and copy/report-sent privacy contracts stay intact.

**Publication, corrections and rollback.** Stage and validate outside publication transactions; atomically activate one directory version only after all required core rows and field policies pass. Imported data has lower priority than an explicit reviewed field override. Existing admin contact edits, intentional clearing, deactivation and translations must survive scheduled refreshes. Imported candidates start outside the selectable set. Revocations/expiry take effect in action resolution as well as browsing. Restoring a previous data publication must not revive a manual suppression or expired channel. Before rolling application code back to a version that cannot enforce contact provenance, pause ETL and deactivate imported-only recipients and affected new routing; verify the old recipient query exposes only its compatible reviewed direct channels. Do not assume an additive schema alone makes old code safe.

**Locale policy.** Import official Hebrew spelling only into Hebrew records. Import another-language name only when independently sourced or reviewed; never copy Hebrew into all locales or auto-publish transliteration as a reviewed translation. Missing locale names remain explicitly unavailable using the project's existing behavior. Track eligibility per locale, not just global candidate counts, and plan human review of the initial recipient's names and new fallback/status/methodology text across all seven locales. Proper names, dates, amounts, phones and emails need correct `lang`/`dir`/`bdi` behavior. New UI keys must exist in each dictionary; missing political text cannot be silently substituted.

**Admin authorization and audit.** Register ETL status, review and publication routes under the existing `/admin/*` protection. Only `admin` can run imports, accept links, edit overrides, activate/rollback data or change schedules; `moderator` retains response-only permissions. Every browser mutation uses POST + CSRF and writes `admin_audit_events` in the same transaction. Its current payload allowlist drops new keys: extend it with bounded operational identifiers such as runId, publicationId and decisionId, never raw source rows, emails, names, credentials or appeal contents. Detailed public-data review evidence belongs in typed review/source tables. CLI/system runs record actor kind and run identity in ETL audit records without inventing an admin account. Required negative tests cover absent JWT, moderator, CSRF failure, repeated submissions and audit-write rollback.

**Import safety and serving.** Validate email schemes/values and control characters, escape source HTML as text, restrict HTTP to reviewed hosts including redirects, and reject HTML error pages presented as CSV/JSON. CSV/XLSX imports must have bounded decompressed size/rows and reject formulas as executable content. Use DataStore JSON where verified to avoid unnecessary spreadsheet dependencies. Portraits, if supported, use validated image bytes and bounded dimensions with hashed same-origin URLs; no arbitrary image proxy or CSP relaxation. If admin CSV exports are added, preserve existing formula-injection escaping. Job exceptions must be sanitized before they can reach the application's raw error logger. Keep forms/admin private, no-store. On a future public profile, define bounded public cache TTL and cache invalidation for corrections; immutable portrait URLs change when bytes change.

**Runtime budgets and recovery.** The documented host budget is 0.5 CPU / 512 MB. Whole-source arrays, unbounded XLSX/PDF parsing or quadratic all-pairs name matching are inappropriate. Use indexed match blocking, bounded pages/batches and stream or reject oversized artifacts. Benchmark ETL while web traffic and the existing retention task run; retain the SPEC targets of p95 GET <=300 ms, p95 POST <=500 ms and error rate <1% at the documented load. `backupDatabase()` currently reads the entire SQLite backup into memory and restore downloads the database into memory: measure database size and peak memory with realistic finance history before launch. If that exceeds the budget, bounded/streamed backup and restore are a prerequisite for finance scale, not something pagination fixes. Keep binary source artifacts outside SQLite; existing response attachments remain off persistent app disk and separate from election artifacts.

**Retention boundaries.** Existing retention removes admin audit events after 12 months and the erasure ledger reconciles supporter/response data. Do not extend those joins to donor identities or reuse the ledger as a donor/profile matching index. Define separate retention for source artifacts, finance revisions and review decisions, preserving minimal source references for published assertions. A data correction/suppression applies to replay, cache, retained artifacts and restore where relevant; it is not a supporter deletion. Required retained artifact manifests must be included in backup/recovery checks. Normal restores must continue to require the stopped-service procedure and signed erasure-ledger reconciliation. Keep existing privacy/restore tests passing.

### Configuration and operational contract

Document these proposed settings in `src/config.ts`, `.env.example` and operations guidance: `ELECTION_ETL_ENABLED=false`, `ELECTION_ETL_ELECTION_NUMBER` (required before an import), `ELECTION_ETL_SCHEDULE_ENABLED=false`, `ELECTION_ETL_SOURCE_MANIFEST`, and `ELECTION_ETL_ARTIFACT_DIR` under `/data` in production. Validate booleans, election number, approved manifest path and artifact path. Put per-source resource IDs, expected headers/format, parser version, rate/size/page limits and cadence in the versioned manifest rather than accepting arbitrary public URLs. Reuse native fetch; add parser dependencies only when a verified format requires them.

Initial contact-expiry proposals are seven days after successful observation for current Knesset contact data and 45 days for Registrar contact data; these are operator policy, not upstream promises. Historical person email is ineligible without fresh supporting publication. Make the policy explicit in the manifest and public source-date wording. Choose final numeric limits from the contract fixtures and load results before scheduling is enabled; fail configuration validation if required production limits are absent.

CLI acceptance: source-check performs bounded reads and reports field/coverage status; dry-run reports insert/update/withdrawal/match/contact deltas against isolated staging; import applies to staging; resume obeys leases/checkpoints; report returns machine-readable counts and exit status. Public activation is an explicit audited operation on a completed publication. A successful process exit must not conceal a blocked required source. Retrying an optional source must not require re-importing a complete CEC snapshot.

### Requirement traceability and exit conditions

| Requested capability | Repository landing point | Required proof |
| --- | --- | --- |
| CEC candidate source of truth | CEC adapter, election/list/candidacy versions | Selected election reconciled completely, revisions/withdrawals preserved, city absence explicit. |
| Parliamentary enrichment | Knesset adapter, positions/committees, identity reviews | Current/historical role evidence, collision fixtures, no fabricated photo or email. |
| Individual/party fallback | Shared recipient resolver, contact resolutions, request preview/action | True contact owner, reviewed multi-party mapping, expiry and changed-preview tests. |
| Primaries totals/donors/foreign share/top donors | Comptroller adapter, reports/entries/summaries | Real export contract, source reconciliation, defined denominator/currency/refunds, unknowns distinct. |
| Party guarantors and amounts | Same finance adapter with party subject | Guarantor records source-linked, no candidate attribution or double-counting with donations. |
| Production resilience | Existing instance scheduler, HTTP wrapper, jobs/checkpoints | Retry/cooldown, crash/resume, duplicate runner, source outage, finite memory/disk and restore tests. |
| Existing product behavior | Requests, responses, admin, i18n, backup/privacy | Seven-locale eligibility, no false MK titles, override/audit rules, unchanged anonymous appeal contract. |

The plan covers all requested stages. Implementation cannot be declared complete by implementing tables alone, by silently dropping finance, or by substituting an old election for the selected one. If an official feed cannot be automated, deliver the verified official-artifact import path and state the remaining automation limitation. Public finance presentation must be defined before that slice is activated; ingestion can be reviewed through admin first, with no implied redesign or ranking feature.

## 9. Decisions for approval

1. **Target election:** recommend the intended upcoming-election directory, with Knesset 24 as a verified historical pipeline fixture and 25th-Knesset service data used only as parliamentary enrichment. Confirm the actual election number; do not silently substitute an older candidate list when newer lists are unavailable.
2. **Rollout:** implement candidates + identity + contacts, then the complete visual/search/filter/multiselect/stance journey described in `RECIPIENT_JOURNEY_VERIFICATION.md`. Finance retains its independent source-contract gate and is secondary profile information. Keep ambiguous identity, organizational mappings and stance publication under manual review.
3. **Finance display:** recommend the requested public donor names/cities/amounts and party guarantees, with explicit reported/audited labels and unknown metrics. Confirm this presentation scope; the data model also supports aggregate-only publication.

Approval of this plan starts implementation. It does not automatically activate imported recipients publicly or deploy changes; those become concrete reviewable steps once data quality and source contracts are demonstrated.
