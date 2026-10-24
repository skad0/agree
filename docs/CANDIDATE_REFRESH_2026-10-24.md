# Candidate refresh — 2026-10-24

The source is the official index, [רשימות המועמדים לכנסת ה-26](https://www.gov.il/he/pages/candidates-lists-26), updated 22.10.2026, together with its 38 list pages. They were captured on 2026-10-23 at 22:36 (+03); the capture file's SHA-256 is `0ae04f7bb2d9f36c6334ba2e7df73950d427417358a995eaf1d0357f29138d08`. The result is written to `data/elections/knesset-26-lists.json` with parser `transcript-3`. No production database was imported or activated.

## What changed

- **Approval:** the index presents the lists as approved by the CEC plenum on 27.9.2026, so `approvalState` is `approved`. The evidence URL is the index page itself.
- **Blue and White** (`כן`, `kachol-lavan_list30`) is not running. Every candidate resigned, and the list page was updated on 21.10.2026. The list is kept with `running: false`, zero rows, and its page as `withdrawnEvidenceUrl`. A withdrawn list does not count as a list without a roster.
- **17 other candidates** are no longer on their lists, and the ranks below them moved up.
- **Ballot letters** are final: one combination per list, unique across all 38. **18 list titles** now use the full ballot wording.
- Rows: 1,379 → 1,322. Running lists: 38 → 37.

## How the capture was repaired

The capture printed each list page to PDF and parsed the text mechanically. The parse lost or moved characters, so its text was checked before anything was stored:

1. **Name strings.** 36 names differ from the 2026-09-19 HTML transcript in text only; the candidate and rank match.
   - 14 are cut off; for example, `גרוסמן ידידיה-` instead of `גרוסמן ידידיה-חיים`.
   - 10 differ only in punctuation, spacing or geresh.
   - 12 differ by one or two letters.

   **All 36 keep the September text** until each one is checked against the page. Some of the 22 that aren't cut off may be real corrections by the Committee; this file does not guess which.
2. **Submitted-by text.** 12 lists had reflowed punctuation; for example, the capture has `יש עתיד -בראשות` where the September transcript has `יש עתיד - בראשות`. They are stored as null, not as damaged text. The other 26 are stored as captured.
3. **Not captured:** party annotations (`viaPartyHe`), now null on every row; cities, which the pages don't publish; and the index publication date, which is null. A family/given split was not imported, per the rule in [ELECTION_DATA_OPERATIONS.md](ELECTION_DATA_OPERATIONS.md).
4. **New rule:** `transcript-3` now refuses text with these marks. Re-importing the raw capture fails on `גרוסמן ידידיה-`, `אלקרינאוי ,טלאל`, `בר -שלום יוסף` and the 12 submitted-by strings.

`הייב מוחמד` appears at ranks 11 and 33 on Ra'am, in this file and in September's. It is kept as two rows.

## Still to verify on the pages

This update could not open gov.il: the network proxy refused it. Before relying on the following, check them in a browser and record the result here:

- the approval wording on the index, and a link to the plenum decision of 27.9.2026 if one is published;
- the Blue and White page as of 21.10.2026;
- each row in the first table below, keeping or replacing the September text;
- the 12 submitted-by strings;
- whether the pages still show party annotations.

## Generated comparison

Output of `node dist/scripts/elections.js diff <2026-09-19 file> data/elections/knesset-26-lists.json`. Ranks run September → now.

Rows: 1379 → 1322.
Name changes: truncated 0, punctuation 0, spelling 0, removed 57, added 0.

| List | Title | Letters | Rows | Running |
| --- | --- | --- | ---: | --- |
| yehudit-meuhedet_list14 | עוצמה יהודית → עוצמה יהודית בראשות איתמר בן גביר | ב | 35 | true |
| beyachad-natzliah_list10 | ביחד נצליח - רשימה משותפת ערבית יהודית → מפלגת ביחד נצליח – רשימה משותפת ערבית יהודית בראשות אבי שקד | בד / בי / בנ / רץ → בד | 9 | true |
| orot_list26 | אורות השחר מפלגה של כולם → אורות השחר בראשות ניסים לוק | בקר | 13 | true |
| yahadut-degel_list37 | יהדות התורה והשבת אגודת ישראל - דגל התורה → יהדות התורה והשבת אגודת ישראל – דגל התורה | ג | 120 → 118 | true |
| hashutafut-lekulam_iist | השותפות לכולם | ד / דק → ד | 7 | true |
| hamiluimnikim-vehakalkalit_list16 | המילואימניקים והכלכלית בראשות יועז הנדל וירון זליכה | די / צ / י → די | 39 → 36 | true |
| yashar_list_2 | ישר! עם איזנקוט לראשות הממשלה מאחדים את ישראל | דרך | 120 → 119 | true |
| gan-eden_list_8 | גן עדן בראשות ישוע ישראל בן דוד | יה / ה → ה | 7 | true |
| hareshima-hameshutefet_list35 | הרשימה המשותפת | ודם | 119 → 118 | true |
| betach_list25 | בטח → בטח – בטחון חברתי בראשות סמיון גרפמן | ז | 3 | true |
| tzionutdatit-zehut_list31 | הציונות הדתית בראשות בצלאל סמוטריץ' וזהות בראשות משה פייגלין | ט | 34 → 33 | true |
| israel-tchila_list7 | ישראל תחילה - בראשות שרן השכל → ישראל תחילה בראשות שרן השכל | י / ר → י | 12 | true |
| gush-tanachi_list24 | גה"ת-גוש התנ"כי → גה"ת – גוש התנ"כי | יק | 4 | true |
| amcha-israel_list6 | עמך ישראל → עמך ישראל בראשות עופר וינטר | ך | 18 → 17 | true |
| kachol-lavan_list30 | כחול לבן → כחול לבן בראשות בני גנץ | כן | 40 → 0 | true → false |
| halikud-tikvahadasha_iist29 | הליכוד עם בנימין נתניהו לראשות הממשלה → הליכוד בהנהגת בנימין נתניהו לראשות הממשלה | מחל | 120 | true |
| noam_list38 | נעם לישראל → נעם לישראל למען עתיד הילדים בראשות אבי מעוז | ני | 16 | true |
| demokratura_list27 | בטחון אישי → ביטחון אישי | נץ | 6 | true |
| shachor_list28 | צבע שחור - מגן עולם התורה → צבע שחור – מגן עולם התורה | נר | 18 → 17 | true |
| raam_list18 | רע"ם - הרשימה הערבית המאוחדת → רע"ם – הרשימה הערבית המאוחדת | עם | 73 → 72 | true |
| miflegat-am-israelit_list21 | אני ואתה מפלגת העם הישראלית | פה / כן / יד / ה → פה | 7 | true |
| chozrim-leshorashim_list32 | תנועת אחי תנועתו של הרב יורם אברג'ל זצ"ל | צ/צבי → צבי | 10 | true |
| pirates_list_5 | הפיראטים — צפים לטוב → הפיראטים – צפים לטוב | צף / ף / ר / ףז → צף | 25 → 24 | true |
| tekuma_list34 | מפלגת תקומה → דרך חזון ותקומה | ק | 13 | true |
| kol-ha-nashim_list9 | קול הנשים | קה / צח / נא → קה | 15 | true |
| seder-chadash_list15 | סדר חדש → סדר-חדש לכינון חוקה, להפרדת רשויות ולבחירות אישיות | קך | 26 → 24 | true |
| mishpat-tzedek_list12 | משפט צדק | קץ | 9 → 8 | true |
| machane-israel_list36 | הקהל - מפלגה כלל חרדית שנציגיה נבחרים על ידי הציבור בראשות הרב שלמה אלבוים → הקהל – מפלגה כלל חרדית שנציגיה נבחרים על ידי הציבור בראשות הרב שלמה אלבוים | רץ | 8 | true |
| beyahad_list1 | ביחד בראשות נפתלי בנט | ב / רק → רק | 120 → 118 | true |

| List | Rank | Before | After | Class |
| --- | --- | --- | --- | --- |
| יהדות התורה והשבת אגודת ישראל – דגל התורה | 24 → — | מורגנשטרן משה דוד | — | removed |
| יהדות התורה והשבת אגודת ישראל – דגל התורה | 66 → — | רוזנשטין יעקב צבי | — | removed |
| המילואימניקים והכלכלית בראשות יועז הנדל וירון זליכה | 15 → — | בהט יונתן | — | removed |
| המילואימניקים והכלכלית בראשות יועז הנדל וירון זליכה | 17 → — | רום אלמוג | — | removed |
| המילואימניקים והכלכלית בראשות יועז הנדל וירון זליכה | 37 → — | שמיאן בר | — | removed |
| ישר! עם איזנקוט לראשות הממשלה מאחדים את ישראל | 78 → — | אלמוג אלירן | — | removed |
| הרשימה המשותפת | 3 → — | אבו שחאדה סאמי | — | removed |
| הציונות הדתית בראשות בצלאל סמוטריץ' וזהות בראשות משה פייגלין | 31 → — | לייבלר אברהם שמואל | — | removed |
| עמך ישראל בראשות עופר וינטר | 8 → — | בן ציון דוד נחום | — | removed |
| כחול לבן בראשות בני גנץ | 1 → — | גנץ בנימין | — | removed |
| כחול לבן בראשות בני גנץ | 2 → — | תמנו פנינה (פנחש) | — | removed |
| כחול לבן בראשות בני גנץ | 3 → — | בלוך גאולה עליזה | — | removed |
| כחול לבן בראשות בני גנץ | 4 → — | קונקול רועי | — | removed |
| כחול לבן בראשות בני גנץ | 5 → — | אבידר צאליק רתם | — | removed |
| כחול לבן בראשות בני גנץ | 6 → — | שוסטר אלון נתן | — | removed |
| כחול לבן בראשות בני גנץ | 7 → — | מרעי מופיד | — | removed |
| כחול לבן בראשות בני גנץ | 8 → — | אוליאל מלכה יהודית | — | removed |
| כחול לבן בראשות בני גנץ | 9 → — | בזיז אריאל | — | removed |
| כחול לבן בראשות בני גנץ | 10 → — | סילפן מוריה | — | removed |
| כחול לבן בראשות בני גנץ | 11 → — | בן אברהם ג'וליאנה | — | removed |
| כחול לבן בראשות בני גנץ | 12 → — | לב-כהן מוניקה יעל | — | removed |
| כחול לבן בראשות בני גנץ | 13 → — | זולדן שי | — | removed |
| כחול לבן בראשות בני גנץ | 14 → — | קידר לילי | — | removed |
| כחול לבן בראשות בני גנץ | 15 → — | דוד שי | — | removed |
| כחול לבן בראשות בני גנץ | 16 → — | פרץ בן | — | removed |
| כחול לבן בראשות בני גנץ | 17 → — | עמר שרונה | — | removed |
| כחול לבן בראשות בני גנץ | 18 → — | שלו וודיסלבסקי רות | — | removed |
| כחול לבן בראשות בני גנץ | 19 → — | הרשקוביץ עירד | — | removed |
| כחול לבן בראשות בני גנץ | 20 → — | יוסף נאהי | — | removed |
| כחול לבן בראשות בני גנץ | 21 → — | אסייג דוד | — | removed |
| כחול לבן בראשות בני גנץ | 22 → — | מנטבר נעה | — | removed |
| כחול לבן בראשות בני גנץ | 23 → — | סטרבורבדיס עמנואל אליהו | — | removed |
| כחול לבן בראשות בני גנץ | 24 → — | רהב ציון | — | removed |
| כחול לבן בראשות בני גנץ | 25 → — | גרבי מיכאל שי | — | removed |
| כחול לבן בראשות בני גנץ | 26 → — | אדרי משה מור | — | removed |
| כחול לבן בראשות בני גנץ | 27 → — | שקד ישעיהו | — | removed |
| כחול לבן בראשות בני גנץ | 28 → — | זימבריס יוסף | — | removed |
| כחול לבן בראשות בני גנץ | 29 → — | ולנטי רות | — | removed |
| כחול לבן בראשות בני גנץ | 30 → — | גוטליב מיכאל | — | removed |
| כחול לבן בראשות בני גנץ | 31 → — | אבן זיו יגאל | — | removed |
| כחול לבן בראשות בני גנץ | 32 → — | אומיאל פדידה אפרת | — | removed |
| כחול לבן בראשות בני גנץ | 33 → — | ארדיטי יסמין | — | removed |
| כחול לבן בראשות בני גנץ | 34 → — | עמית עומר | — | removed |
| כחול לבן בראשות בני גנץ | 35 → — | סאלם רועי | — | removed |
| כחול לבן בראשות בני גנץ | 36 → — | עמית טליה חוה | — | removed |
| כחול לבן בראשות בני גנץ | 37 → — | רבינוביץ משה עדי | — | removed |
| כחול לבן בראשות בני גנץ | 38 → — | מאירמן רז | — | removed |
| כחול לבן בראשות בני גנץ | 39 → — | ענבר פקלמן ברק | — | removed |
| כחול לבן בראשות בני גנץ | 40 → — | פלד אמיר | — | removed |
| צבע שחור – מגן עולם התורה | 3 → — | יששכר יונתן | — | removed |
| רע"ם – הרשימה הערבית המאוחדת | 34 → — | חסן אחמד | — | removed |
| הפיראטים – צפים לטוב | 22 → — | פוויץ יהודה אריה | — | removed |
| סדר-חדש לכינון חוקה, להפרדת רשויות ולבחירות אישיות | 21 → — | מיכאלוב אורי | — | removed |
| סדר-חדש לכינון חוקה, להפרדת רשויות ולבחירות אישיות | 22 → — | אשטון גולן | — | removed |
| משפט צדק | 9 → — | אייזנשטיין מיכאל | — | removed |
| ביחד בראשות נפתלי בנט | 69 → — | מאור עפר פליקס | — | removed |
| ביחד בראשות נפתלי בנט | 118 → — | בראל אנטולי | — | removed |

## Repair log

The first table shows names where the capture's text was not stored. The second shows the submitted-by text that was not stored.

| List | Rank | Capture | Kept (19.9 HTML transcript) | Class |
| --- | ---: | --- | --- | --- |
| הדמוקרטים בראשות יאיר גולן | 41 | דה לם אוליביה עמנואל | דה לם אולביה עמנואל | spelling |
| הדמוקרטים בראשות יאיר גולן | 68 | זקהיים גראוס אסתר | זקהיים גראוס אסתי | spelling |
| עוצמה יהודית בראשות איתמר בן גביר | 7 | דורפמן חנמאל | דורפמן חנמאל שיראי | truncated |
| עוצמה יהודית בראשות איתמר בן גביר | 10 | ניימן איתיאל | ניימן איתיאל יעקב | truncated |
| עוצמה יהודית בראשות איתמר בן גביר | 20 | יומטוביאן אור | יומטוביאן אור אליה | truncated |
| עוצמה יהודית בראשות איתמר בן גביר | 23 | מיוחס פנחס | מיוחס פנחס יעקב | truncated |
| עוצמה יהודית בראשות איתמר בן גביר | 28 | גרוסמן ידידיה- | גרוסמן ידידיה-חיים | truncated |
| עוצמה יהודית בראשות איתמר בן גביר | 29 | אוחנה דרור | אוחנה דרור מאיר | truncated |
| עוצמה יהודית בראשות איתמר בן גביר | 34 | גפשטיין דביר | גפשטיין דביר רחמים | truncated |
| עוצמה יהודית בראשות איתמר בן גביר | 35 | רחמים שמעון | רחמים שמעון מאיר | truncated |
| יהדות התורה והשבת אגודת ישראל – דגל התורה | 34 | ברסלר אברהם אלכסנדר | ברסלר אברהם אלכסנדר זיסקינד | truncated |
| יהדות התורה והשבת אגודת ישראל – דגל התורה | 61 | גיטלר נחום אהרון | גיטלר נחום אהרן | spelling |
| יהדות התורה והשבת אגודת ישראל – דגל התורה | 103 | ברנשטיין מנחם שמעון | ברנשטיין מנחם שמעון שלמה אריה | truncated |
| השותפות לכולם | 1 | אלקרינאוי ,טלאל | אלקרינאוי, טלאל | punctuation/spacing/geresh |
| הרשימה המשותפת | 1 | ג'בארין יוסף | גבארין יוסף | punctuation/spacing/geresh |
| הרשימה המשותפת | 3 | גטאס פאתן | ג'טאס פאתן | punctuation/spacing/geresh |
| הרשימה המשותפת | 13 | עבדאללה גסאן | עבדאללה ג'סאן | punctuation/spacing/geresh |
| הרשימה המשותפת | 31 | גבארה אלמאסה | ג'בארה אלמאסה | punctuation/spacing/geresh |
| הרשימה המשותפת | 36 | ויצמן דיאמונד עינת | ויצמן דיאמונד עינאת | spelling |
| הרשימה המשותפת | 60 | חאג' יחיא מטאוע | חאג' יחיא מטאנע | spelling |
| הרשימה המשותפת | 75 | מחאג'נה ח'אלד | מחאג'נה חאלד | punctuation/spacing/geresh |
| הרשימה המשותפת | 102 | ח'ורי סמירה | חורי סמירה | punctuation/spacing/geresh |
| הרשימה המשותפת | 110 | יזבק היבה | יזבק היבא | spelling |
| הציונות הדתית בראשות בצלאל סמוטריץ' וזהות בראשות משה פייגלין | 28 | דיסקין אברהם חיים | דיסקין אברהם חיים אלבר | truncated |
| הליכוד בהנהגת בנימין נתניהו לראשות הממשלה | 52 | הכהן רבין חיימוב אלישיב | הכהן רבין חיימוב אלישיב שר שלום | truncated |
| הליכוד בהנהגת בנימין נתניהו לראשות הממשלה | 56 | יוגב מטי | יוגב מוטי | spelling |
| הליכוד בהנהגת בנימין נתניהו לראשות הממשלה | 80 | שאשא כהן אביחי ציון | שאשא כהן אבישי ציון | spelling |
| נעם לישראל למען עתיד הילדים בראשות אבי מעוז | 5 | חיימוב יסכה איילת | חיימוב יסכה איילת השחר | truncated |
| נעם לישראל למען עתיד הילדים בראשות אבי מעוז | 9 | באבד אלקנה | באבד אללקנה | spelling |
| נעם לישראל למען עתיד הילדים בראשות אבי מעוז | 14 | נאה יהושע | נאה יהושע אליעזר | truncated |
| צבע שחור – מגן עולם התורה | 11 | זבולני ג'ד יאיר | זבולוני ג'ד יאיר | spelling |
| צבע שחור – מגן עולם התורה | 12 | בר -שלום יוסף | בר - שלום יוסף | punctuation/spacing/geresh |
| תנועת אחי תנועתו של הרב יורם אברג'ל זצ"ל | 8 | וודאג'ה גרמה גד | וודגה גרמה גד | spelling |
| שרשר לאהבה ואחדות העם | 7 | מזל תרים מאיר | מזלתרים מאיר | punctuation/spacing/geresh |
| דרך חזון ותקומה | 5 | פרץ חיימוביץ ליאנה מירלה | פרץ חיימוביץ' ליאנה מירלה | punctuation/spacing/geresh |
| הקהל – מפלגה כלל חרדית שנציגיה נבחרים על ידי הציבור בראשות הרב שלמה אלבוים | 4 | קובן ידידיה צבי אמיתי | קובן ידידיה צבי אמית | spelling |

| List | Captured submitted-by text (not stored) |
| --- | --- |
| עוצמה יהודית בראשות איתמר בן גביר | רשימת המועמדים הוגשה מטעם מפלגת חזית יהודית לאומית ומטעם מפלגת ארץ ישראל שלנו -מפלגה יהודית מאוחדת לשלמות התורה העם והארץ |
| צומת בית ישראל | רשימת המועמדים הוגשה מטעם מפלגת צומת -התנועה לציונות מתחדשת ומטעם מפלגת בית ימני חברתי ציוני לכלל עם ישראל |
| יהדות התורה והשבת אגודת ישראל – דגל התורה | רשימת המועמדים הוגשה מטעם מפלגת אגודת החרדים -דגל התורה ומטעם מפלגת הסתדרות אגודת ישראל בארץ ישראל ומטעם מפלגת חומת תורת ישראל |
| השותפות לכולם | רשימת המועמדים הוגשה מטעם מפלגת איחוד בני הברית -איתחאד אבנאא אלעהד- בראשות רב חובל בשארה שליאן |
| הציונות הדתית בראשות בצלאל סמוטריץ' וזהות בראשות משה פייגלין | רשימת המועמדים הוגשה מטעם מפלגת האיחוד הלאומי -תקומה ומטעם מפלגת זהות - תנועה ישראלית יהודית ומטעם מפלגת עתיד אחד -עתיד טוב לישראל |
| ישראל תחילה בראשות שרן השכל | רשימת המועמדים הוגשה מטעם מפלגת ישראל תחילה -ביטחון ,כלכלה ,אחדות בעם ישראל |
| גה"ת – גוש התנ"כי | רשימת המועמדים הוגשה מטעם מפלגת מפלגת גה"ת -גוש התנ"כי |
| הליכוד בהנהגת בנימין נתניהו לראשות הממשלה | רשימת המועמדים הוגשה מטעם מפלגת הליכוד ,תנועה לאומית ליברלית ומטעם מפלגת תקווה חדשה הימין הממלכתי |
| נעם לישראל למען עתיד הילדים בראשות אבי מעוז | רשימת המועמדים הוגשה מטעם מפלגת לזוז ומטעם מפלגת אחריות לאומית -למען עתיד ילדינו |
| אני ואתה מפלגת העם הישראלית | רשימת המועמדים הוגשה מטעם מפלגת אני ואתה -מפלגת העם הישראלית |
| ביחד בראשות נפתלי בנט | רשימת המועמדים הוגשה מטעם מפלגת ביחד בראשות בנט מחזירים את התקווה ומטעם מפלגת יש עתיד -בראשות יאיר לפיד |
| התאחדות הספרדים שומרי תורה תנועתו של מרן הרב עובדיה יוסף זצ"ל | רשימת המועמדים הוגשה מטעם מפלגת ש"ס -התאחדות הספרדים העולמית שומרי תורה |
