# Target election (autumn 2026)

**Configured target:** Knesset **26** (`ELECTION_ETL_ELECTION_NUMBER=26`, code default `electionTargetElectionNumber = 26` when unset).

**ETL remains off by default.** Setting the target does not import, publish, or activate directory data.

## Evidence (recorded 2026-09-12)

| Claim | Evidence | Notes |
| --- | --- | --- |
| Autumn 2026 national election is for the **26th Knesset** | [Knesset Channel summary of list filing for כנסת ה-26](https://www.knesset.tv/main-articles/61384/94610/); [Israel Democracy Institute 2026 elections page](https://en.idi.org.il/israeli-elections-and-parties/elections/2026/) titled “The Elections for the 26th Knesset”; [Knesset press on special provisions for elections to the 26th Knesset](https://main.knesset.gov.il/News/PressReleases/Pages/press16072026o.aspx) | Consistent across official/Knesset-adjacent reporting. Not inferred from calendar alone. |
| Election day **27 Oct 2026** | IDI page lists `27.10.2026`; Hebrew press (e.g. JDN) states Tuesday 27 Oct 2026 / ט״ז בחשוון תשפ״ז | Date is supporting context for the cycle, not a substitute for the Knesset number. |
| Closed-list filing completed ~8–9 Sep 2026 (~2 days before 2026-09-12) | Knesset Channel / News 13 / Al Jazeera: list submission to the Central Elections Committee concluded; ~38 lists filed | Operator note that lists were “finalized ~2 days ago” matches **submission close**, not necessarily CEC final approval of every list (some reporting cites later committee finalization). |
| Machine CEC feed for 26 is **not** verified | Live `package_show` for CKAN `candidates-lists` on 2026-09-12 (re-probed same day) returned **only** resources for Knessets **19–24**; `www.gov.il/.../election-candidates26` returned **HTTP 403**; no downloadable Knesset-26 closed-list machine URL found on bechirot.gov.il | Do not treat historical 19–24 package rows as the 2026 closed list. Prefer an **official artifact** import into a **draft** publication until a verified DataStore/export contract exists. Operator refresh: `docs/ELECTION_DATA_OPERATIONS.md`. |

## Identifiers used in this repository

| Field | Value |
| --- | --- |
| `election.number` / `ELECTION_ETL_ELECTION_NUMBER` | `26` |
| Human label | 26th Knesset / כנסת ה-26 / autumn 2026 cycle |
| Manifest resource stub | `cec-knesset-26` (`blocked` until a verified machine resource exists) |
| Ingestion path while blocked | `npm run elections -- import-artifact <official-or-fixture.json>` → **draft** `directory_publications` only |

## Explicit non-claims

- No production activation of imported recipients from this confirmation alone.
- No assumption that CKAN will publish election 26 under the existing 19–24 package.
- Joint electoral lists still do not imply constituent-party affiliation without reviewed `candidacy_party_memberships`.
