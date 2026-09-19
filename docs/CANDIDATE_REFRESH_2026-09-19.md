# Candidate refresh — 2026-09-19

Source: [Central Elections Committee, 26th Knesset candidate lists](https://www.gov.il/he/pages/candidates-lists-26), index updated September 18; all 38 linked roster pages read September 19. Snapshot retrieval time: 2026-09-19T09:27:03.566Z.

The official index explicitly says the lists are submitted and not yet approved. This refresh does not claim approval. No production database was imported or activated.

| Measure | Checkpoint aee7690 (September 13) | September 19 |
| --- | ---: | ---: |
| Lists | 38 | 38 |
| Published rosters | 35 | 38 |
| Candidate rows | 1,258 | 1,379 |
| Missing rosters | 3 | 0 |

128 names appear in the new snapshot that were absent before; seven names from the old snapshot are absent now. This is a source-text comparison, not cross-snapshot identity matching or a claim about legal withdrawal. No name changes were inferred. Counts changed for these lists:

| Official list | Before | Now |
| --- | ---: | ---: |
| השותפות לכולם | 0 | 7 |
| שמע בראשות נפתלי גולדמן | 0 | 1 |
| הליכוד עם בנימין נתניהו לראשות הממשלה | 0 | 120 |
| סדר חדש | 29 | 26 |
| הדמוקרטים בראשות יאיר גולן | 120 | 119 |
| התאחדות הספרדים שומרי תורה תנועתו של מרן הרב עובדיה יוסף זצ"ל | 120 | 119 |
| כחול לבן | 41 | 40 |
| הרשימה המשותפת | 120 | 119 |

All other roster counts are unchanged. List titles and submitted ballot letters come from the index. The candidate's full Hebrew name and any published party annotation come from the roster. Empty table padding was excluded. Shama's single candidate has rank 1 from the source's HTML ordered-list marker, verified separately. The index's HTTP link for Hashutafut was normalized to the verified HTTPS page.

Submitted-by descriptions are null in this refresh: that metadata was not captured reliably. This omission is explicit rather than filled with navigation text or stale metadata. Contacts, inferred identity, translated candidate names and approval decisions were not added.

Schema consolidation also removes redundant per-candidate list titles/ballot letters: those belong to the list version. Party annotations now retain the source's full wording, including its introductory phrase. These formatting changes account for much of the JSON diff and are separate from roster membership changes.

Validation: 38 distinct source list keys; declared counts match parsed rows; unique contiguous ranks starting at 1; official HTTPS source links; repeat-import no-op; draft isolation; activate/rollback without contact changes. The immutable snapshot and list metadata are written by parser `transcript-2`.

Before production activation, review the normalized JSON diff and this report, take the existing recoverable SQLite backup, import a draft, and activate its returned publication ID separately. Future approval requires a new official-source check and evidence URL; it is not a UI flag to toggle merely because rosters are complete.
