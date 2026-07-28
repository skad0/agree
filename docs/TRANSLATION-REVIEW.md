# Translation review status

**Every political and legal string on this site outside Russian is machine-translated and has not been reviewed by a human translator. None of it is cleared for public launch.**

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

Hebrew and Arabic matter most: they are the languages in which this campaign will actually be read and, if it is challenged, argued about.

## What to review

1. `migrations/004_campaign_content.sql` — the ten standard clauses, the five coalition clauses, the eleven first-100-days items, the eighteen portfolios, and the email/WhatsApp/social templates. Each clause has `title`, `body` (the commitment), `rationale`, `verification` and `exceptions`.
2. `src/locales/*.json` — interface strings, status messages, and the `aboutBody` / `methodologyBody` / `privacyBody` page prose.

Statements of existing Israeli law need the closest reading: the 80-member threshold for extending a Knesset term, the 3.25% electoral threshold, the Commissions of Inquiry Law mechanism, and the repeated distinction between what the law currently requires and what this project merely proposes. The canonical package is careful about that distinction in Russian; the translations must stay equally careful.

## After review

Correct the text in place, then note here who reviewed which locale and when. Until every row above says reviewed, `STATUS.md` keeps translation review listed as an open launch gate.
