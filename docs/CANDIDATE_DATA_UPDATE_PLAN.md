# Candidate data correctness update — plan

_Drafted 2026-10-24 (+03). Baseline: `main` at `8cf84bf`, plus `STATUS.md` as updated on 2026-10-24._

This plan brings the repository's 26th-Knesset data in line with the official post-approval state. It also slots in every other open item from [`STATUS.md`](../STATUS.md). Nothing in it has been carried out yet. Each step lists the evidence it needs and the check that closes it.

## 1. Input under review

The input is an uploaded transcript, `knesset-26-candidates-lists.json`, 466,108 bytes, SHA-256 `0ae04f7bb2d9f36c6334ba2e7df73950d427417358a995eaf1d0357f29138d08`. It is not committed yet.

| Field | Upload | Repository (`data/elections/knesset-26-lists.json`) |
| --- | --- | --- |
| Retrieved | 2026-10-23T22:36:04+03:00 | 2026-09-19T09:27:03Z |
| Approval | Notes say "approved by the CEC plenum on 27.9.2026"; there is **no `approvalState` field** | `submitted_not_approved` |
| Index page | "updated 22.10.2026" (the index's own publish date is a reused 05.02.2023) | updated 18.9.2026 |
| Lists / running | 38 / **37**: כחול לבן (`kachol-lavan_list30`) is not running, with 0 candidates | 38 / 38 |
| Candidate rows | **1,322** | 1,379 |
| Ballot letters | One combination per list, **unique across all 38** | Several options per list, not unique |
| `submittedByHe` | Present on all 38 lists | Null on all lists |
| Party annotation (`viaPartyHe`) | **Absent** | Present on 854 rows |
| Family/given split | Mechanical split on 2-word names; 443 names left null | Not stored (the ops doc rule says it stays null until a reviewed source exists) |
| Per-list dates | `pagePublished`, `pageUpdated` | none |
| Shape | Adds row-level `listTitleHe`/`ballotLetters`, list `running`, `pageUrl`; drops `rosterPublished`, `sourceUrl` | `transcript-2` shape |

**The current importer rejects the upload** (`src/integrations/elections/import.ts`, `parseCandidateSource`). It has no `source.approvalState`, and `rosterPublished` is missing on every list. There is also no way to say that a list withdrew. `rosterPublished:false` means "no roster published", which is a different fact.

The upload's own note says it "replaces the earlier secondary-source compilation from Wikipedia and news sites". The repository describes the September file as a manual transcript of the official pages ([CANDIDATE_REFRESH_2026-09-19.md](CANDIDATE_REFRESH_2026-09-19.md)). The two provenance claims disagree. The repaired transcript must state its provenance once, accurately.

## 2. What changed, and what is wrong in the upload

### 2.1 Changes that look like real source changes (verify, then adopt)

- **Approval:** the lists were approved on 27.9.2026, according to the upload's notes. No approval evidence URL is recorded, and the importer requires one for `approved`.
- **Blue and White withdrew:** every candidate on the list resigned, and the list page was updated on 21.10.2026. 40 rows go away.
- **17 other candidates are gone, and later ranks were renumbered**. That fits official removals; see Appendix A, "absent from upload". By list: Bennett's list (ביחד בראשות נפתלי בנט) 2, New Order (סדר-חדש) 2, Torah Judaism / Degel HaTorah (יהדות התורה – דגל התורה) 2, the Reservists list (המילואימניקים) 3, and 1 each from Yashar (ישר!), the Joint List (הרשימה המשותפת), Religious Zionism–Zehut (הציונות הדתית וזהות), Amcha Yisrael (עמך ישראל), Black Banner (צבע שחור), Ra'am (רע"ם), Pirates (הפיראטים) and Mishpat Tzedek (משפט צדק).
- **18 list titles changed**, mostly to the full ballot wording. For example, the Likud title changes from "הליכוד עם בנימין נתניהו…" to "הליכוד בהנהגת בנימין נתניהו…", the Tkuma title from "מפלגת תקומה" to "דרך חזון ותקומה", and "בטחון אישי" becomes "ביטחון אישי". Several changes are only "-" → "–".
- **Final ballot letters**: Otzma Yehudit is `ב` and Bennett's list is `רק`, where both had claimed `ב` before. The old ops-doc rule "letters are neither final nor unique" no longer holds after approval.

### 2.2 Defects introduced by the upload's parser (must be fixed, not adopted)

| Class | Count | Example |
| --- | ---: | --- |
| Truncated name: the upload's name is a strict prefix of the September name | 14 | `גרוסמן ידידיה-` (dangling hyphen) for `גרוסמן ידידיה-חיים`; 8 of the 14 are on Otzma Yehudit |
| Punctuation or spacing artifact (besides the dangling hyphen above) | 2 | `אלקרינאוי ,טלאל`, `בר -שלום יוסף` |
| Party annotation dropped | 854 rows | `viaPartyHe` is missing entirely |
| Mechanical family/given split | 879 rows | Contradicts the rule in [ELECTION_DATA_OPERATIONS.md](ELECTION_DATA_OPERATIONS.md) (`השכל שרן מרים`) |
| Unattributed claim | 1 | `publishedAt` 18.10.2026 "from the CEC timeline"; not on the page; left null, which is correct |

### 2.3 Differences that need a source decision, one name at a time

There are 12 one- or two-character spelling differences, such as `יוגב מוטי`→`יוגב מטי`, `שאשא כהן אבישי`→`אביחי`, `אסתי`→`אסתר` and `וודגה`→`וודאג'ה`. There are also 7 differences that are geresh-only, mostly on the Joint List (`גבארין`→`ג'בארין`, `ג'טאס`→`גטאס`). Each one is either a correction the Committee made on its page or a parsing error. That can only be settled against the published page text, not by guessing. All of them are listed in Appendix A.

`הייב מוחמד` appears twice on Ra'am (ranks 11 and 33) in both files. Most likely they are two people with the same name. Confirm that on the page rather than de-duplicating.

### 2.4 Knock-on effects in the scorecard (`src/data/scorecard-2026.ts`)

- The evidence record `ev-cec-submitted-lists-26` says "as submitted (updated 25.9.2026)… not yet approved" in 7 locales. The roster chrome says "Final approval is not yet published" (`src/scorecard-copy.ts:216`). Hebrew `ballotNoteHe` defaults and notes describe the lists as filed ("רשימה שהוגשה"); 10 lines in the file mention filing or submission. After approval, all of these are false.
- `blue-white` is scored as a running opposition list with `rosterUrl` set, but the list no longer runs.
- `rosterUrls` hard-codes 38 page URLs, separately from the snapshot. The two sources can drift apart.
- Party names are short forms, which is fine for display. **12 leader spellings differ from the official rank-1 name.** One of them is Blue and White, which has no rank 1 now; most of the rest are nicknames or shortened names. Examples: `גדי איזנקוט`/`איזנקוט גד`, `מוטי ליטנר`/`ליטנר פנחס מרדכי`, `ישועה בן דוד`/`בן דוד ישוע ישראל`. Some are real spelling differences: `איתן שווילי`/`שוילי`, `משה סלומוביץ`/`סלמוביץ`, `טופצ'יאשווילי`/`טופצ'יאשוילי`, `אליהו בוימרינד`/`באומרינד`, `יובל אלימלך`/`אלמלך`, `אלקנה פדרמן`/`אלקנא`. `משה ליפקין` versus the official `ליפקין דניס` needs checking in particular.
- `publishedAt: "2026-03-01"` and the "2026-03" heading in TRANSLATION-REVIEW are wrong; the work is from 2026-09.
- Entity glosses (`src/data/scorecard-entity-glosses.ts`) follow the party and leader names, so they move with any rename.

## 3. Principles (unchanged from the existing operations rules)

1. Official CEC pages are the only source for list membership, rank, name text, letters and approval. Media and encyclopedias are never a source.
2. The pipeline rejects bad input and never repairs it silently. A transcript fails import if any validator fails. Every repair cites the page it was checked against.
3. Name text is reproduced verbatim from the page, including geresh and hyphens. There is no transliteration and no identity matching.
4. Approval is a fact with an evidence URL, never a display toggle.
5. Import and activation are separate steps, and each one comes after a backup.
6. The scorecard and the transcript must not disagree. Tests enforce this, not reviewers.

## 4. Workstreams

### WS-A — Source verification and transcript repair (blocking; owner and operator)

Fetching runs on an operator machine with a browser, because gov.il refuses non-browser clients and this cloud session's proxy refuses `www.gov.il`.

1. Capture the index page and all 38 list pages again, as saved HTML plus a screenshot each, under a dated artifact folder. That folder stays out of git if it contains personal data beyond what the pages publish.
2. Record the approval evidence: the URL of the Committee's announcement or decision of 27.9.2026 that approved the lists, on an official host (`gov.il` / `bechirot.gov.il`). If no official URL states it, the state stays `submitted_not_approved` and the UI keeps saying so.
3. Record the Blue and White withdrawal evidence: what the list page shows as of 21.10.2026, with a screenshot.
4. Resolve all 36 renamed pairs (14 truncated, 12 spelling, 10 punctuation, spacing or geresh) and the 17 removals in Appendix A against the captured pages. Mark each one `source-change` or `parser-error`, and fix the parser errors from the page text.
5. Restore `viaPartyHe` where the pages still show it. Where a page no longer shows the annotation, record null; do not copy it from September.
6. Drop the mechanical `familyNameHe`/`givenNameHe` split, or keep it in a non-imported field. Only `fullNameHe` is imported.
7. Keep `submittedByHe` (new and useful), but only where it is copied verbatim.

**Done when:** a repaired transcript exists. Every Appendix A row carries a classification and a page reference, and two people have spot-checked 5 random lists plus every list with changes.

### WS-B — Transcript schema `transcript-3` and importer (code)

1. Extend `CandidateSource` and `parseCandidateSource`:
   - Add list `running: boolean`, plus `withdrawnEvidenceUrl` when it is false. A non-running list carries zero rows and is **not** counted as "missing roster".
   - Add list `pagePublished` and `pageUpdated`, as dates in Israeli `dd.mm.yyyy` format normalized to ISO, and `pageUrl` as the official HTTPS URL. Accept `sourceUrl` as an alias for one release.
   - Require `source.approvalState`, and require `approvalEvidenceUrl` when it is `approved` (already enforced).
   - When the state is `approved`, ballot letters must be present and unique across running lists.
   - Row-level `listTitleHe`/`ballotLetters`, if present, must equal the list's values. Otherwise reject the transcript. They are not stored.
2. Add name-text lint rules that reject the transcript:
   - leading or trailing punctuation (`-` `–` `,`), the patterns ` ,` and `- `/` -` next to a space, double spaces;
   - any Latin letter or digit;
   - a single-token name;
   - a name that is a strict prefix of another name in the previous snapshot of the same list. This last rule only flags; an operator override with a page reference releases it.
3. Add migration `022`: `electoral_list_versions.running` (default 1), `withdrawn_evidence_url`, `page_published`, `page_updated`. It is additive and safe on the single `/data/app.db`.
4. Bump `TRANSCRIPT_PARSER_VERSION` to `transcript-3`. A re-import of `transcript-2` data still works.
5. Add a CLI command, `elections diff <old.json> <new.json>`. It produces the Appendix A tables and the per-list count table mechanically, so refresh reports are never written by hand.
6. Tests to add in `test/election-import.test.ts`: approved without evidence → reject; withdrawn list with rows → reject; duplicate letters when approved → reject; each lint class → reject; prefix-truncation flag; mismatched row-level title → reject; idempotent re-import; migration upgrade on a populated database (`foreign_key_check`, `integrity_check`).

**Done when:** typecheck passes, the full test suite passes, and the repaired WS-A transcript imports into a scratch database as a draft.

### WS-C — Commit the snapshot and the refresh report (data)

1. Replace `data/elections/knesset-26-lists.json` with the repaired `transcript-3` file. The September file stays in git history and is not kept as a second copy.
2. Write `docs/CANDIDATE_REFRESH_2026-10-xx.md` from `elections diff`. It covers approval, the withdrawal, the 17 removals, letters, titles, the repair log and provenance. In [ELECTION_DATA_OPERATIONS.md](ELECTION_DATA_OPERATIONS.md), update the letters rule (final and unique after approval) and document `running`.

### WS-D — Scorecard alignment (code and copy; depends on WS-A facts, not on WS-B)

1. **One source of truth.** Map each `PartyId` to its `officialListKey`, and read the roster URL, final letters, full title and running state from the snapshot JSON at build time. Delete the hard-coded `rosterUrls`.
2. **Consistency test** (`test/scorecard.test.ts`):
   - every scorecard party maps to exactly one list key, and every running list has a party;
   - `leaderHe` matches the rank-1 `fullNameHe` token-wise, or appears in an explicit `leaderAliasHe` table that justifies a common-name display;
   - a non-running list is shown as such and is excluded from shares and pass counts.
3. **Approval copy** in all 7 locales:
   - the evidence record becomes "approved by the CEC plenum, 27.9.2026; index updated 22.10.2026", with its date fields;
   - the roster chrome becomes "Lists as approved by the Central Elections Committee";
   - the filed/submitted notes become approved wording.

   All of this is gated on the WS-A evidence URL.
4. **Blue and White.** Pick the display per Decision 1 below. Its 25th-Knesset votes stay historical evidence either way.
5. **Leader names.** Apply Decision 2, then fix the 6 real spelling differences. Update the glosses to match.
6. Set `publishedAt` to the real publication date, and fix the "2026-03" heading in TRANSLATION-REVIEW.
7. Re-check the 38 → 37 numbers in the copy, the segment counts and the share sentence.

**Done when:** typecheck passes, the tests pass, `smoke:pages` passes, and the `/he/scorecard` and `/en/scorecard` pages have been checked in a browser at 375 px and 1440 px.

### WS-E — Production data (operator; optional while no public page reads the snapshot)

The candidate directory is retired, so activation only matters if WS-D reads the snapshot at runtime. Under the recommended build-time reading, it doesn't. If activation happens, follow [ELECTION_DATA_OPERATIONS.md](ELECTION_DATA_OPERATIONS.md): back up first, `elections import`, review `report`, `activate <id>`, and keep the previous ID for rollback.

### WS-F — Remaining gates from STATUS.md (not data, but scheduled here so nothing is lost)

| Item | Action | Gate |
| --- | --- | --- |
| Dependency advisories, including the `hono/jsx` XSS advisory (GHSA-hxh3-vqpv-xpqv) | Upgrade `hono` to ≥4.13.13 and `@hono/node-server` to ≥1.19.17, both non-major; run the full suite and both smoke suites; remove the expired 2026-09-30 audit exception | Before deploy |
| Translation review | Name a reviewer for each locale. The scorecard approval copy from WS-D joins the review list | Launch |
| Accessibility | Lighthouse and axe at 320/768/1024/1440; screen readers; 200% zoom; forced colors | Launch |
| Device sharing and crawler previews | Real iOS/Android share sheets; X/Facebook/WhatsApp/Telegram previews on staging | Launch |
| Deploy | Render Blueprint, secrets, Cloudflare Access/WAF/cache, persistence of `/data` across redeploys, `npm run load` on staging, monitoring | Launch |
| Open PRs | #1 (terms/accessibility/corrections): rebase and review. #7: close as superseded by the share-first importer. #9: close or rework, since it contradicts the current header | Owner |
| Initiator / operator naming | Restore it or record the decision | Owner |

## 5. Decisions needed from the owner

1. **Blue and White on the scorecard.** Recommended: keep a row marked "withdrew, not on the ballot (CEC, 21.10.2026)", excluded from counts and sharing, so people searching for Gantz get an explanation. The alternative is to remove the row.
2. **Leader names.** Recommended: show the common name, as now, but keep the official rank-1 spelling as the search alias and in the test table. The alternative is to show the official spelling only.
3. **Family/given split.** Recommended: don't import it. That keeps the ops rule.
4. **Does the scorecard read the snapshot at build time (recommended) or at runtime?** Runtime would require production activation (WS-E).
5. **Election date.** It is not confirmed in this repository. If polling day is imminent, run WS-A (evidence) and WS-D steps 3–4 first, as a small correctness patch. WS-B and WS-C can follow.

## 6. Order of work

1. WS-A evidence capture (approval URL, withdrawal, per-name checks).
2. WS-D steps 3, 4 and 6: approval copy, Blue and White, dates. This is the smallest change that removes statements that are now false.
3. WS-B schema, lint and diff tool, then WS-C committing the repaired transcript and its report.
4. WS-D steps 1, 2, 5 and 7: single source of truth and the consistency tests.
5. WS-F dependency upgrade, then the launch gates. WS-E only if Decision 4 chooses runtime reads.

Each step is one commit, with a typecheck, the test suite and `smoke:pages` run before every push.

## Appendix A — candidate name differences, September snapshot → upload

Generated mechanically from the two JSON files; the 40 Blue and White rows are omitted. Classes:

- **truncated in upload**: the upload's name is a strict prefix of the September name. Treat as a parser error.
- **punctuation/spacing/geresh only**: the two names are equal once spaces, commas, hyphens and geresh are removed.
- **spelling**: the names differ by 1–2 characters.
- **absent from upload**: the candidate has no counterpart in the upload.

Ranks are September → upload.

| List | Rank | September | Upload | Class |
| --- | --- | --- | --- | --- |
| הדמוקרטים בראשות יאיר גולן | 41→41 | דה לם אולביה עמנואל | דה לם אוליביה עמנואל | spelling (1–2 chars) |
| הדמוקרטים בראשות יאיר גולן | 68→68 | זקהיים גראוס אסתי | זקהיים גראוס אסתר | spelling (1–2 chars) |
| עוצמה יהודית בראשות איתמר בן גביר | 7→7 | דורפמן חנמאל שיראי | דורפמן חנמאל | truncated in upload |
| עוצמה יהודית בראשות איתמר בן גביר | 10→10 | ניימן איתיאל יעקב | ניימן איתיאל | truncated in upload |
| עוצמה יהודית בראשות איתמר בן גביר | 20→20 | יומטוביאן אור אליה | יומטוביאן אור | truncated in upload |
| עוצמה יהודית בראשות איתמר בן גביר | 23→23 | מיוחס פנחס יעקב | מיוחס פנחס | truncated in upload |
| עוצמה יהודית בראשות איתמר בן גביר | 28→28 | גרוסמן ידידיה-חיים | גרוסמן ידידיה- | truncated in upload |
| עוצמה יהודית בראשות איתמר בן גביר | 29→29 | אוחנה דרור מאיר | אוחנה דרור | truncated in upload |
| עוצמה יהודית בראשות איתמר בן גביר | 34→34 | גפשטיין דביר רחמים | גפשטיין דביר | truncated in upload |
| עוצמה יהודית בראשות איתמר בן גביר | 35→35 | רחמים שמעון מאיר | רחמים שמעון | truncated in upload |
| יהדות התורה והשבת אגודת ישראל – דגל התורה | 35→34 | ברסלר אברהם אלכסנדר זיסקינד | ברסלר אברהם אלכסנדר | truncated in upload |
| יהדות התורה והשבת אגודת ישראל – דגל התורה | 62→61 | גיטלר נחום אהרן | גיטלר נחום אהרון | spelling (1–2 chars) |
| יהדות התורה והשבת אגודת ישראל – דגל התורה | 105→103 | ברנשטיין מנחם שמעון שלמה אריה | ברנשטיין מנחם שמעון | truncated in upload |
| יהדות התורה והשבת אגודת ישראל – דגל התורה | 24→— | מורגנשטרן משה דוד | — | absent from upload |
| יהדות התורה והשבת אגודת ישראל – דגל התורה | 66→— | רוזנשטין יעקב צבי | — | absent from upload |
| השותפות לכולם | 1→1 | אלקרינאוי, טלאל | אלקרינאוי ,טלאל | punctuation/spacing/geresh only |
| המילואימניקים והכלכלית בראשות יועז הנדל וירון זליכה | 15→— | בהט יונתן | — | absent from upload |
| המילואימניקים והכלכלית בראשות יועז הנדל וירון זליכה | 17→— | רום אלמוג | — | absent from upload |
| המילואימניקים והכלכלית בראשות יועז הנדל וירון זליכה | 37→— | שמיאן בר | — | absent from upload |
| ישר! עם איזנקוט לראשות הממשלה מאחדים את ישראל | 78→— | אלמוג אלירן | — | absent from upload |
| הרשימה המשותפת | 1→1 | גבארין יוסף | ג'בארין יוסף | punctuation/spacing/geresh only |
| הרשימה המשותפת | 4→3 | ג'טאס פאתן | גטאס פאתן | punctuation/spacing/geresh only |
| הרשימה המשותפת | 14→13 | עבדאללה ג'סאן | עבדאללה גסאן | punctuation/spacing/geresh only |
| הרשימה המשותפת | 32→31 | ג'בארה אלמאסה | גבארה אלמאסה | punctuation/spacing/geresh only |
| הרשימה המשותפת | 37→36 | ויצמן דיאמונד עינאת | ויצמן דיאמונד עינת | spelling (1–2 chars) |
| הרשימה המשותפת | 61→60 | חאג' יחיא מטאנע | חאג' יחיא מטאוע | spelling (1–2 chars) |
| הרשימה המשותפת | 76→75 | מחאג'נה חאלד | מחאג'נה ח'אלד | punctuation/spacing/geresh only |
| הרשימה המשותפת | 103→102 | חורי סמירה | ח'ורי סמירה | punctuation/spacing/geresh only |
| הרשימה המשותפת | 111→110 | יזבק היבא | יזבק היבה | spelling (1–2 chars) |
| הרשימה המשותפת | 3→— | אבו שחאדה סאמי | — | absent from upload |
| הציונות הדתית בראשות בצלאל סמוטריץ' וזהות בראשות משה פייגלין | 28→28 | דיסקין אברהם חיים אלבר | דיסקין אברהם חיים | truncated in upload |
| הציונות הדתית בראשות בצלאל סמוטריץ' וזהות בראשות משה פייגלין | 31→— | לייבלר אברהם שמואל | — | absent from upload |
| עמך ישראל בראשות עופר וינטר | 8→— | בן ציון דוד נחום | — | absent from upload |
| הליכוד בהנהגת בנימין נתניהו לראשות הממשלה | 52→52 | הכהן רבין חיימוב אלישיב שר שלום | הכהן רבין חיימוב אלישיב | truncated in upload |
| הליכוד בהנהגת בנימין נתניהו לראשות הממשלה | 56→56 | יוגב מוטי | יוגב מטי | spelling (1–2 chars) |
| הליכוד בהנהגת בנימין נתניהו לראשות הממשלה | 80→80 | שאשא כהן אבישי ציון | שאשא כהן אביחי ציון | spelling (1–2 chars) |
| נעם לישראל למען עתיד הילדים בראשות אבי מעוז | 5→5 | חיימוב יסכה איילת השחר | חיימוב יסכה איילת | truncated in upload |
| נעם לישראל למען עתיד הילדים בראשות אבי מעוז | 9→9 | באבד אללקנה | באבד אלקנה | spelling (1–2 chars) |
| נעם לישראל למען עתיד הילדים בראשות אבי מעוז | 14→14 | נאה יהושע אליעזר | נאה יהושע | truncated in upload |
| צבע שחור – מגן עולם התורה | 12→11 | זבולוני ג'ד יאיר | זבולני ג'ד יאיר | spelling (1–2 chars) |
| צבע שחור – מגן עולם התורה | 13→12 | בר - שלום יוסף | בר -שלום יוסף | punctuation/spacing/geresh only |
| צבע שחור – מגן עולם התורה | 3→— | יששכר יונתן | — | absent from upload |
| רע"ם – הרשימה הערבית המאוחדת | 34→— | חסן אחמד | — | absent from upload |
| תנועת אחי תנועתו של הרב יורם אברג'ל זצ"ל | 8→8 | וודגה גרמה גד | וודאג'ה גרמה גד | spelling (1–2 chars) |
| שרשר לאהבה ואחדות העם | 7→7 | מזלתרים מאיר | מזל תרים מאיר | punctuation/spacing/geresh only |
| הפיראטים – צפים לטוב | 22→— | פוויץ יהודה אריה | — | absent from upload |
| דרך חזון ותקומה | 5→5 | פרץ חיימוביץ' ליאנה מירלה | פרץ חיימוביץ ליאנה מירלה | punctuation/spacing/geresh only |
| סדר-חדש לכינון חוקה, להפרדת רשויות ולבחירות אישיות | 21→— | מיכאלוב אורי | — | absent from upload |
| סדר-חדש לכינון חוקה, להפרדת רשויות ולבחירות אישיות | 22→— | אשטון גולן | — | absent from upload |
| משפט צדק | 9→— | אייזנשטיין מיכאל | — | absent from upload |
| הקהל – מפלגה כלל חרדית שנציגיה נבחרים על ידי הציבור בראשות הרב שלמה אלבוים | 4→4 | קובן ידידיה צבי אמית | קובן ידידיה צבי אמיתי | spelling (1–2 chars) |
| ביחד בראשות נפתלי בנט | 69→— | מאור עפר פליקס | — | absent from upload |
| ביחד בראשות נפתלי בנט | 118→— | בראל אנטולי | — | absent from upload |
