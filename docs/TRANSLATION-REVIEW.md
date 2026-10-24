# Translation review status

**Every political and legal string on this site outside Russian is unapproved for public launch.** Ukrainian in migration `007` is a high-quality implementation draft, but it still requires approval by a named native Ukrainian legal/political reviewer before launch; no human review is being claimed here.

The canonical source is `docs/Каноническийпакеттекстовиправилпроекта.docx`, written in Russian. Russian is authoritative; where a translation and the Russian disagree, the Russian wins.

## Share-first additions — 2026-09-19

New plain-language questions (`src/issue-headings.ts`), sharing/directory UI (`src/share-copy.ts`), and updated about/methodology/privacy paragraphs (`src/locales/*.json`) need named human review in **all seven locales, including Russian**. The Russian additions are new drafts, not verbatim canonical text. Existing canonical clause bodies and their obligations were reused unchanged. No new translation has been marked approved.

## Why this matters more than usual here

The content is not marketing copy. It is a set of political commitments put to registered parties during an Israeli election period, plus privacy and terms text. Section 0 of the canonical package is explicit that whether the project counts as regulated electoral activity depends on what it actually says and does, not only on intent. A mistranslation in Hebrew or Arabic is not a typo — it can change what a party is being asked to commit to, or how the platform's neutrality reads to a regulator.

## What needs review, by locale

| Locale | Political and legal content | UI chrome |
|---|---|---|
| `ru` | Canonical, taken verbatim from the package | Written from the package |
| `he` | **Machine-translated — review required** | Machine-translated |
| `ar` | **Machine-translated — review required** | Machine-translated |
| `yi` | **Machine-translated — review required** | Machine-translated |
| `en` | **Machine-translated — review required** | Machine-translated |
| `am` | **Machine-translated — review required** | Machine-translated |
| `uk` | **High-quality implementation draft — named native/legal reviewer approval required** | Draft UI/campaign copy; named native reviewer approval required |

Hebrew and Arabic matter most: they are the languages in which this campaign will actually be read and, if it is challenged, argued about.

## What to review

1. `migrations/004_campaign_content.sql` — the ten standard clauses, the five coalition clauses, the eleven first-100-days items, the eighteen portfolios, and the email/WhatsApp/social templates. Each clause has `title`, `body` (the commitment), `rationale`, `verification` and `exceptions`. Ukrainian implementations are in `migrations/007_uk_locale.sql`; they must be checked field-by-field against Russian, including numbers, alternatives, exceptions, legal mechanisms, placeholders and line breaks.
2. `src/locales/*.json` — interface strings, status messages, and the `aboutBody` / `methodologyBody` / `privacyBody` page prose.

Statements of existing Israeli law need the closest reading: the 80-member threshold for extending a Knesset term, the 3.25% electoral threshold, the Commissions of Inquiry Law mechanism, and the repeated distinction between what the law currently requires and what this project merely proposes. The canonical package is careful about that distinction in Russian; the translations must stay equally careful. In particular, Ukrainian demand 1 retains the objective-necessity limit and the examples that are not sufficient grounds; demand 5 retains the proposed 70-member condition and its non-legal status; and demand 8 retains the appointment mechanism, 14-day deadline and minimum investigation scope.

## Known deviations from the canonical package

- **The "Initiator" section was removed from `aboutBody` in all six locales** (2026-07-28). Part X of the package lists the initiator among the things the project publishes. The page currently runs from the introduction straight into Funding, so the operator is not named anywhere on the site. Decide before launch whether to restore the section with a real name or legal entity.
- **Ukrainian is an implementation draft, not a human-cleared translation.** The Ukrainian campaign/legal records were expanded to preserve the Russian constraints and options, but a named native Ukrainian reviewer with relevant legal/political competence must approve them before public launch. No reviewer or approval is recorded yet.
- **Action-only privacy cut (2026-09-09).** `aboutBody`, `methodologyBody`, `privacyBody`, deletion/report strings, and reply file-availability strings in all seven locales were aligned to the public contract: no account, no public counters, no personal appeal text stored, hosting-disk retention wording (no object-storage deploy claim). Support UI strings remain for admin re-enable only. Re-review those keys before launch.

## After review

Correct the text in place, then note here who reviewed which locale and when. Until every row above says reviewed, `STATUS.md` keeps translation review listed as an open launch gate.

## Added with the 26th-Knesset candidate import (unreviewed)

Four directory strings were added in every locale, Russian included, and none has been reviewed.
They are unusually sensitive because they state the legal status of a candidate list:

| Key | What it asserts |
|---|---|
| `directoryListsSubmitted` | The lists are as **submitted** and the CEC has **not approved** them |
| `directoryListsApproved` | The lists **are** the approved ones |
| `directoryListsWithoutRoster` | How many submitted lists published no candidate roster |
| `directoryListRank` | A candidate's published place on their list |

A translation that blurs submitted into approved misstates an official act during an election
period. Review these against the Hebrew source wording on the CEC page —
`רשימות אלה אינן סופיות וועדת הבחירות המרכזית טרם אישרה אותן` — before public launch.

## Scorecard dataset and chrome — 2026-09-23 (unreviewed)

Civic scorecard UI (`src/scorecard-copy.ts`) and verified evidence/basis strings
(`src/data/scorecard-2026.ts`) now ship in all seven locales. Hebrew is the factual
source for criteria, evidence summaries, reference labels, and party basis text;
other locales are machine translations. Party and leader names remain Hebrew-only,
matching the candidate directory. No locale may omit the `/scorecard` page.
Named legal/political review is still required before treating non-Hebrew scorecard
copy as launch-ready.

## Scorecard roster and reading path — 2026-09-25 (unreviewed)

The scorecard now lists the 38 slates filed with the Central Elections Committee for the
26th Knesset (`https://www.gov.il/he/pages/candidates-lists-26`, updated 25.9.2026).
Those lists are submitted, not finally approved. Incumbent scores still rest on 25th
Knesset votes and agreements. Challenger rows stay uncommitted: a missing vote is not a
failure, and filing a list is not a platform clause or a signed pledge. New chrome in
`src/scorecard-copy.ts` (segments, sort, share sentence, reading steps) is unreviewed
in every locale, including Hebrew and Russian.

Party and leader readings in `src/data/scorecard-entity-glosses.ts` sit beside the
official Hebrew ballot name. They are unreviewed drafts in Arabic, Yiddish, Russian,
Ukrainian, English, and Amharic. Hebrew is copied from the ballot string and is not
a second translation.

## Approved lists and the Blue and White withdrawal — 2026-10-24 (unreviewed)

The scorecard now says the lists were approved by the CEC plenum on 27.9.2026, and that Blue and White is not on the ballot. These strings are new or rewritten in all seven locales, including Hebrew and Russian, and none is reviewed:

| Where | What it asserts |
|---|---|
| `src/scorecard-copy.ts` `listsApproved` | The lists shown are the ones the Committee approved on 27.9.2026 |
| `src/scorecard-copy.ts` `withdrawnBadge`, `withdrawnNote` | A list is not on the ballot because every candidate resigned (CEC page updated 21.10.2026) |
| `src/data/scorecard-2026.ts` evidence `ev-cec-approved-lists-26` | The CEC page lists the approved slates, and Blue and White is not running |
| `src/data/scorecard-2026.ts` `challengerBasis` | A new list was approved by the Committee (plenum, 27.9.2026) |
| `src/data/scorecard-entity-glosses.ts` | New readings for "דרך חזון ותקומה" and for the leaders renamed to their official spelling: Shvili, Yeshua Yisrael Ben David, Salomovich, Denis Lipkin, Topchiashvili, Baumrind, Elmalech, Elkana Federman |

"Approved" must not be weakened to "submitted", and "withdrew" must not read as "disqualified": the Committee did not disqualify the list.

## Public positions on the ten questions — 2026-10-24 (unreviewed)

New in all seven locales, including Hebrew and Russian. None of it is reviewed:

| Where | What it asserts |
|---|---|
| `src/positions-copy.ts` | Page chrome, the stance labels ("matches the commitment", "partly matches", "contrary", "on record, not a commitment", "declined", "no public statement found") and the scope note (14 lists; the rest not reviewed) |
| `src/data/positions-2026.ts` `records`, `other`, `context` | Paraphrases of dated party statements, each tied to a source URL. Speaker readings for Yoav Kisch, Moshe Feiglin and Yair Lapid |

Added 25.10.2026, also unreviewed: the browsing chrome in `src/positions-copy.ts` (Positions nav item, by question / by list, tap hints, the main-page card, the scorecard link, the jump link) and the Noam, Democrats 100-day and Bennett public-service entries in `src/data/positions-2026.ts`.

A reviewer should compare each summary with its linked source, not only with the English. A stance word must not be strengthened: "on record" is not support, and "declined to answer" is not opposition. Paraphrases must stay paraphrases; do not expand them into long quotations.
