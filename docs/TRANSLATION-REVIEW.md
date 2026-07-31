# Translation review status

**Every political and legal string on this site outside Russian is unapproved for public launch.** Ukrainian in migration `007` is a high-quality implementation draft, but it still requires approval by a named native Ukrainian legal/political reviewer before launch; no human review is being claimed here.

The canonical source is `docs/Каноническийпакеттекстовиправилпроекта.docx`, written in Russian. Russian is authoritative; where a translation and the Russian disagree, the Russian wins.

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

## After review

Correct the text in place, then note here who reviewed which locale and when. Until every row above says reviewed, `STATUS.md` keeps translation review listed as an open launch gate.
