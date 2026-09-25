import {
  assertScorecardDataset,
  type Criterion,
  type EvidenceRecord,
  type PartyCompliance,
  type ScorecardDataset
} from "../types/scorecard.js";

/**
 * Verified historical evidence for מדד רף משותף — 25th Knesset (2022–2026) record,
 * used as the baseline for the 26th Knesset election conversation.
 *
 * Equal-draft High Court ruling: בג"ץ 6198/23 (25 June 2024).
 * Every URL targets an official host; party statuses include a neutral basisHe.
 */

const criteria: Criterion[] = [
  {
    id: "equal-service",
    titleHe: "שוויון בנטל השירות",
    descriptionHe:
      "קריטריון הבודק הצבעה והתחייבות ביחס לגיוס שוויוני לפי חוק שירות ביטחון, יישום פסיקת בג\"ץ בעניין פטור גורף, והחלת דין רציפות על הצעות חוק שירות ביטחון בעניין שילוב תלמידי ישיבות.",
    category: "civic"
  },
  {
    id: "core-curriculum",
    titleHe: "לימודי ליבה בחינוך המתוקצב",
    descriptionHe:
      "קריטריון הבודק האם הסיעה חתמה על הסכמים קואליציוניים המעגנים עצמאות פדגוגית ותקצוב לרשתות חינוך (ובכללן החינוך העצמאי ומעיין החינוך התורני) מחוץ לפיקוח לימודי ליבה ממלכתי מלא.",
    category: "civic"
  },
  {
    id: "budget-integrity",
    titleHe: "שקיפות וכספים קואליציוניים",
    descriptionHe:
      "קריטריון הבודק הצבעה על חוקי התקציב לשנים 2023–2024 והמסגרות ליישום הסכמים קואליציוניים בעלי משמעות תקציבית, כפי שפורסמו בכנסת ובמפתח התקציב.",
    category: "fiscal"
  },
  {
    id: "judicial-independence",
    titleHe: "עצמאות מערכת המשפט",
    descriptionHe:
      "קריטריון הבודק הצבעה על תיקון מס' 3 לחוק-יסוד: השפיטה (עילת הסבירות) מ-24 ביולי 2023, ואת פסק הדין בבג\"ץ 5658/23 מ-1 בינואר 2024 שהכריז על בטלות התיקון.",
    category: "constitutional"
  },
  {
    id: "term-limits",
    titleHe: "הגבלת כהונה וטוהר מידות",
    descriptionHe:
      "קריטריון הבודק תמיכה או קידום הצעות חוק-יסוד להגבלת כהונת ראש ממשלה לשמונה שנים, כפי שתועדו בהודעות הכנסת ובנוסחי הצעות החוק של הכנסת ה-24 וה-25.",
    category: "constitutional"
  }
];

const evidence: EvidenceRecord[] = [
  {
    id: "ev-draft-continuity-2024-06-10",
    type: "KNESSET_PLENUM_VOTE",
    referenceNumber: "החלת דין רציפות על הצעת חוק שירות הביטחון (תיקון מס' 26) — 10 ביוני 2024",
    date: "2024-06-10",
    summaryHe:
      "מליאת הכנסת אישרה ברוב 63 מול 57 להחיל דין רציפות על הצעת חוק שירות ביטחון (תיקון – שילוב תלמידי ישיבות) שעברה בקריאה ראשונה בכנסת ה-24, והחזירה אותה לוועדת החוץ והביטחון לקריאה שנייה ושלישית.",
    officialSourceUrl: "https://main.knesset.gov.il/News/PressReleases/pages/press11.06.24.aspx",
    verified: true
  },
  {
    id: "ev-draft-bill-dossier-2024",
    type: "OFFICIAL_BILL",
    referenceNumber: "הצעת חוק שירות ביטחון (תיקון מס' 26) (שילוב תלמידי ישיבות), התשפ\"ב-2022 — תיק ועדה",
    date: "2024-06-10",
    summaryHe:
      "תיק הוועדה של הכנסת ה-25 מתעד את הודעת הממשלה מ-27.5.2024 על רצונה להחיל דין רציפות, את עמדת היועצת המשפטית לממשלה בדבר מניעה משפטית, ואת החלטת המליאה מ-10.6.2024 להעביר את ההצעות להמשך דיון בוועדת החוץ והביטחון.",
    officialSourceUrl: "https://fs.knesset.gov.il/25/law/25_ls_bk_4564473.pdf",
    verified: true
  },
  {
    id: "ev-bagatz-6198-23",
    type: "BAGATZ_RULING",
    referenceNumber: "בג\"ץ 6198/23 התנועה למען איכות השלטון בישראל נ' שר הביטחון (פסק דין, 25.6.2024)",
    date: "2024-06-25",
    summaryHe:
      "בית המשפט העליון קבע פה אחד כי בהיעדר מסגרת חוקית לפטור אין סמכות להורות על הימנעות גורפת מגיוס תלמידי ישיבות, וכי לא ניתן להמשיך ולהעביר כספי תמיכות למוסדות עבור תלמידים שלא קיבלו פטור או דחיית שירות כדין.",
    officialSourceUrl:
      "https://supremedecisions.court.gov.il/Home/Download?fileName=23061980.T68.SUM&path=HebrewVerdicts%2F23%2F980%2F061%2Ft68&type=4",
    verified: true
  },
  {
    id: "ev-coalition-agreements-index-37",
    type: "COALITION_AGREEMENT",
    referenceNumber: "הסכמים קואליציוניים לכינון הממשלה ה-37 — מאגר הכנסת הרשמי",
    date: "2022-12-29",
    summaryHe:
      "עמוד הכנסת מפרסם את ההסכמים הקואליציוניים של הממשלה ה-37 בין הליכוד לבין יהדות התורה, ש\"ס, הציונות הדתית ועוצמה יהודית. בהסכמים עם יהדות התורה וש\"ס מעוגנים מעמד, עצמאות פדגוגית ותקצוב של רשתות החינוך העצמאי ומעיין החינוך התורני.",
    officialSourceUrl: "https://main.knesset.gov.il/mk/government/pages/coalitionagreements.aspx",
    verified: true
  },
  {
    id: "ev-budget-2023-lawbill",
    type: "OFFICIAL_BILL",
    referenceNumber: "חוק התקציב לשנת הכספים 2023, התשפ\"ג-2023 — הצעת חוק הממשלה",
    date: "2023-05-24",
    summaryHe:
      "דף החקיקה הרשמי של הכנסת מתעד את חוק התקציב לשנת 2023, שאושר במליאה במסגרת חקיקת התקציב הדו-שנתית של הממשלה ה-37 וקבע את המסגרת הכספית לאותה שנה.",
    officialSourceUrl:
      "https://main.knesset.gov.il/activity/legislation/laws/pages/LawBill.aspx?lawitemid=2203819&t=lawsuggestionssearch",
    verified: true
  },
  {
    id: "ev-budget-2024-lawbill",
    type: "OFFICIAL_BILL",
    referenceNumber: "חוק התקציב לשנת הכספים 2024, התשפ\"ג-2023 — הצעת חוק הממשלה",
    date: "2023-05-24",
    summaryHe:
      "דף החקיקה הרשמי של הכנסת מתעד את חוק התקציב לשנת 2024, שאושר יחד עם תקציב 2023. יישום ההסכמים הקואליציוניים בעלי המשמעות התקציבית פורט בהחלטות ממשלה נלוות.",
    officialSourceUrl:
      "https://main.knesset.gov.il/Activity/Legislation/Laws/pages/lawbill.aspx?lawitemid=2203820&t=lawsuggestionssearch",
    verified: true
  },
  {
    id: "ev-coalition-funds-obudget-2024",
    type: "COALITION_AGREEMENT",
    referenceNumber: "החלטות ממשלה — יישום הסכמים קואליציוניים בשנת הכספים 2024 (מפתח התקציב)",
    date: "2023-05-14",
    summaryHe:
      "מפתח התקציב (next.obudget.org) מתעד את החלטות הממשלה ליישום הסכמים קואליציוניים בשנת 2024, ובכללן הפניה להחלטות 241, 511, 562 ו-861 ולמסגרות ההקצאה שנקבעו בהן.",
    officialSourceUrl: "https://next.obudget.org/i/gov_decisions/9aff6f75-7f24-474e-bef0-a241b84a5120",
    verified: true
  },
  {
    id: "ev-reasonableness-plenum-2023-07-24",
    type: "KNESSET_PLENUM_VOTE",
    referenceNumber: "חוק-יסוד: השפיטה (תיקון מס' 3) — קריאה שנייה ושלישית, 24 ביולי 2023",
    date: "2023-07-24",
    summaryHe:
      "מליאת הכנסת אישרה ברוב 64 מול 0 את תיקון מס' 3 לחוק-יסוד: השפיטה, שקבע כי מי שבידו סמכות שפיטה לא ידון בסבירות החלטת הממשלה, ראש הממשלה או שר ולא ייתן צו בעניין. חברי האופוזיציה יצאו מהמליאה לפני ההצבעה הסופית.",
    officialSourceUrl:
      "https://main.knesset.gov.il/activity/legislation/laws/pages/lawbill.aspx?lawitemid=2207472&t=lawsuggestionssearch",
    verified: true
  },
  {
    id: "ev-bagatz-5658-23",
    type: "BAGATZ_RULING",
    referenceNumber: "בג\"ץ 5658/23 התנועה למען איכות השלטון בישראל נ' הכנסת (פסק דין, 1.1.2024)",
    date: "2024-01-01",
    summaryHe:
      "בית המשפט העליון, בדעת רוב, הכריז על בטלות תיקון מס' 3 לחוק-יסוד: השפיטה — התיקון ששלל דיון שיפוטי בסבירות החלטות הממשלה והשרים — וקבע כי במקרה קצה זה חרגה הכנסת מסמכותה המכוננת.",
    officialSourceUrl:
      "https://supremedecisions.court.gov.il/Home/Download?fileName=23056580.T31.SUM&path=HebrewVerdicts%2F23%2F580%2F056%2Ft31&type=4",
    verified: true
  },
  {
    id: "ev-term-limits-press-2021-11-22",
    type: "OFFICIAL_BILL",
    referenceNumber: "הצעת חוק-יסוד: הממשלה (תיקון – הגבלת כהונת ראש הממשלה לשמונה שנים) — קריאה ראשונה",
    date: "2021-11-22",
    summaryHe:
      "הודעת הכנסת מתעדת את הדיון וההצבעה בקריאה ראשונה על הגבלת כהונת ראש הממשלה לשמונה שנים. הצעות זהות הונחו גם בכנסת ה-25 (בין היתר פ/315/25 ופ/5096/25) אך לא הושלמו לחוק.",
    officialSourceUrl: "https://main.knesset.gov.il/News/PressReleases/pages/press221121z.aspx",
    verified: true
  },
  {
    id: "ev-term-limits-bill-25",
    type: "OFFICIAL_BILL",
    referenceNumber: "הצעת חוק-יסוד: הממשלה (תיקון – תקופה מרבית לכהונה) — נוסח הכנסת ה-25",
    date: "2023-03-15",
    summaryHe:
      "נוסח רשמי של הכנסת ה-25 מציע להוסיף לחוק-יסוד: הממשלה סעיף שלפיו מי שכיהן כראש ממשלה תקופה רצופה של שמונה שנים לא יהיה רשאי עוד לכהן בתפקיד. ההצעה מציינת נוסחים קודמים מהכנסת ה-24 ואת הסרת הצעות זהות מסדר היום בכנסת ה-25.",
    officialSourceUrl: "https://fs.knesset.gov.il/25/law/25_lst_10244471.pdf",
    verified: true
  }
];

const coalitionEqualFail =
  "סיעת הקואליציה נמנתה עם הרוב שאישר במליאה ב-10.6.2024 את החלת דין הרציפות על הצעת חוק שירות הביטחון (63 מול 57), כמתועד בהודעת הכנסת.";
const oppositionEqualPass =
  "סיעת האופוזיציה נמנתה עם המיעוט שהתנגד במליאה ב-10.6.2024 להחלת דין הרציפות על הצעת חוק שירות הביטחון (57 מתנגדים מול 63 תומכים), כמתועד בהודעת הכנסת.";
const coalitionCoreFail =
  "הסיעה הייתה צד להסכמים הקואליציוניים של הממשלה ה-37 המפורסמים במאגר הכנסת, ובהם מעוגנים מעמד ועצמאות פדגוגית לרשתות החינוך העצמאי ומעיין החינוך התורני.";
const coalitionPartnerCorePartial =
  "הסיעה הייתה שותפה לקואליציית הממשלה ה-37 שחתמה על ההסכמים המעגנים עצמאות פדגוגית לרשתות החינוך החרדי, אף שלא הייתה הצד הישיר לסעיפי החינוך מול יהדות התורה או ש\"ס.";
const outsideCorePass =
  "הסיעה לא הייתה צד להסכמים הקואליציוניים של הממשלה ה-37 המעגנים עצמאות פדגוגית לרשתות החינוך החרדי, כפי שעולה ממאגר ההסכמים הרשמי של הכנסת.";
const coalitionBudgetFail =
  "סיעות הקואליציה תמכו באישור חוקי התקציב לשנים 2023 ו-2024 במליאה, במסגרת שכללה את יישום ההסכמים הקואליציוניים בעלי המשמעות התקציבית כמתועד בדפי החקיקה ובמפתח התקציב.";
const oppositionBudgetPass =
  "סיעת האופוזיציה לא נמנתה עם קואליציית הממשלה ה-37 שאישרה את חוקי התקציב לשנים 2023–2024 ואת מסגרות יישום ההסכמים הקואליציוניים המתועדות במפתח התקציב.";
const coalitionJudicialFail =
  "סיעות הקואליציה תמכו באישור תיקון מס' 3 לחוק-יסוד: השפיטה בקריאה שנייה ושלישית ב-24.7.2023 ברוב 64 מול 0, כמתועד בדף החקיקה של הכנסת.";
const oppositionJudicialPass =
  "חברי האופוזיציה יצאו מהמליאה לפני ההצבעה הסופית על תיקון מס' 3 לחוק-יסוד: השפיטה ב-24.7.2023 ולא נמנו עם 64 התומכים, כמתועד בדף החקיקה של הכנסת.";
const termLimitsFailCoalition =
  "בתקופת הממשלה ה-37 לא הושלמה חקיקת הגבלת כהונת ראש ממשלה לשמונה שנים; הצעות זהות בכנסת ה-25 הוסרו מסדר היום, כמתועד בנוסח הכנסת ובהודעותיה.";
const termLimitsPassSponsors =
  "חברי הסיעה או קודמיה בכנסת ה-24/ה-25 קידמו או תמכו בהצעות חוק-יסוד להגבלת כהונת ראש ממשלה לשמונה שנים, כמתועד בהודעת הכנסת ובנוסחי ההצעות, אף שהחקיקה לא הושלמה.";
const termLimitsPartial =
  "הסיעה הביעה תמיכה ציבורית ברפורמות ממשל הכוללות הגבלת כהונה, אך לא הייתה היוזמת הראשית של הצעות החוק המתועדות בכנסת ה-24/ה-25 ולא הצביעה עליהן כחוק סופי.";
const termLimitsUncommitted =
  "לא אותרו במקורות הרשמיים שצוינו הצבעת מליאה או יוזמת חקיקה של הסיעה בעניין הגבלת כהונת ראש ממשלה לשמונה שנים.";
const equalUncommitted =
  "לא אותרה במקורות הרשמיים שצוינו הצבעת סיעתית אחידה של הסיעה בהחלת דין הרציפות מ-10.6.2024; הסטטוס מסומן כלא-מחויב עד לעדכון רשמי.";

const parties: PartyCompliance[] = [
  {
    partyId: "likud",
    partyNameHe: "הליכוד",
    leaderHe: "בנימין נתניהו",
    block: "coalition-37",
    scores: {
      "equal-service": "FAIL",
      "core-curriculum": "FAIL",
      "budget-integrity": "FAIL",
      "judicial-independence": "FAIL",
      "term-limits": "FAIL"
    },
    basisHe: {
      "equal-service": coalitionEqualFail,
      "core-curriculum": coalitionCoreFail,
      "budget-integrity": coalitionBudgetFail,
      "judicial-independence": coalitionJudicialFail,
      "term-limits": termLimitsFailCoalition
    },
    evidenceMap: {
      "equal-service": ["ev-draft-continuity-2024-06-10", "ev-draft-bill-dossier-2024", "ev-bagatz-6198-23"],
      "core-curriculum": ["ev-coalition-agreements-index-37"],
      "budget-integrity": ["ev-budget-2023-lawbill", "ev-budget-2024-lawbill", "ev-coalition-funds-obudget-2024"],
      "judicial-independence": ["ev-reasonableness-plenum-2023-07-24", "ev-bagatz-5658-23"],
      "term-limits": ["ev-term-limits-press-2021-11-22", "ev-term-limits-bill-25"]
    }
  },
  {
    partyId: "yesh-atid",
    partyNameHe: "יש עתיד",
    leaderHe: "יאיר לפיד",
    block: "opposition",
    scores: {
      "equal-service": "PASS",
      "core-curriculum": "PASS",
      "budget-integrity": "PASS",
      "judicial-independence": "PASS",
      "term-limits": "PASS"
    },
    basisHe: {
      "equal-service": oppositionEqualPass,
      "core-curriculum": outsideCorePass,
      "budget-integrity": oppositionBudgetPass,
      "judicial-independence": oppositionJudicialPass,
      "term-limits": termLimitsPassSponsors
    },
    evidenceMap: {
      "equal-service": ["ev-draft-continuity-2024-06-10", "ev-bagatz-6198-23"],
      "core-curriculum": ["ev-coalition-agreements-index-37"],
      "budget-integrity": ["ev-budget-2023-lawbill", "ev-coalition-funds-obudget-2024"],
      "judicial-independence": ["ev-reasonableness-plenum-2023-07-24", "ev-bagatz-5658-23"],
      "term-limits": ["ev-term-limits-press-2021-11-22", "ev-term-limits-bill-25"]
    }
  },
  {
    partyId: "national-unity",
    partyNameHe: "המחנה הממלכתי",
    leaderHe: "בני גנץ",
    block: "opposition",
    scores: {
      "equal-service": "PASS",
      "core-curriculum": "PASS",
      "budget-integrity": "PASS",
      "judicial-independence": "PASS",
      "term-limits": "PASS"
    },
    basisHe: {
      "equal-service": oppositionEqualPass,
      "core-curriculum": outsideCorePass,
      "budget-integrity": oppositionBudgetPass,
      "judicial-independence": oppositionJudicialPass,
      "term-limits": termLimitsPassSponsors
    },
    evidenceMap: {
      "equal-service": ["ev-draft-continuity-2024-06-10", "ev-draft-bill-dossier-2024", "ev-bagatz-6198-23"],
      "core-curriculum": ["ev-coalition-agreements-index-37"],
      "budget-integrity": ["ev-budget-2023-lawbill", "ev-coalition-funds-obudget-2024"],
      "judicial-independence": ["ev-reasonableness-plenum-2023-07-24", "ev-bagatz-5658-23"],
      "term-limits": ["ev-term-limits-press-2021-11-22", "ev-term-limits-bill-25"]
    }
  },
  {
    partyId: "the-democrats",
    partyNameHe: "הדמוקרטים",
    leaderHe: "יאיר גולן",
    block: "opposition",
    scores: {
      "equal-service": "PASS",
      "core-curriculum": "PASS",
      "budget-integrity": "PASS",
      "judicial-independence": "PASS",
      "term-limits": "PASS"
    },
    basisHe: {
      "equal-service": oppositionEqualPass,
      "core-curriculum": outsideCorePass,
      "budget-integrity": oppositionBudgetPass,
      "judicial-independence": oppositionJudicialPass,
      "term-limits": termLimitsPassSponsors
    },
    evidenceMap: {
      "equal-service": ["ev-draft-continuity-2024-06-10", "ev-bagatz-6198-23"],
      "core-curriculum": ["ev-coalition-agreements-index-37"],
      "budget-integrity": ["ev-budget-2023-lawbill", "ev-coalition-funds-obudget-2024"],
      "judicial-independence": ["ev-reasonableness-plenum-2023-07-24", "ev-bagatz-5658-23"],
      "term-limits": ["ev-term-limits-press-2021-11-22", "ev-term-limits-bill-25"]
    }
  },
  {
    partyId: "yisrael-beiteinu",
    partyNameHe: "ישראל ביתנו",
    leaderHe: "אביגדור ליברמן",
    block: "opposition",
    scores: {
      "equal-service": "PASS",
      "core-curriculum": "PASS",
      "budget-integrity": "PASS",
      "judicial-independence": "PASS",
      "term-limits": "PARTIAL"
    },
    basisHe: {
      "equal-service": oppositionEqualPass,
      "core-curriculum": outsideCorePass,
      "budget-integrity": oppositionBudgetPass,
      "judicial-independence": oppositionJudicialPass,
      "term-limits": termLimitsPartial
    },
    evidenceMap: {
      "equal-service": ["ev-draft-continuity-2024-06-10", "ev-bagatz-6198-23"],
      "core-curriculum": ["ev-coalition-agreements-index-37"],
      "budget-integrity": ["ev-budget-2023-lawbill", "ev-coalition-funds-obudget-2024"],
      "judicial-independence": ["ev-reasonableness-plenum-2023-07-24", "ev-bagatz-5658-23"],
      "term-limits": ["ev-term-limits-bill-25"]
    }
  },
  {
    partyId: "shas",
    partyNameHe: "ש\"ס",
    leaderHe: "אריה דרעי",
    block: "coalition-37",
    scores: {
      "equal-service": "FAIL",
      "core-curriculum": "FAIL",
      "budget-integrity": "FAIL",
      "judicial-independence": "FAIL",
      "term-limits": "FAIL"
    },
    basisHe: {
      "equal-service": coalitionEqualFail,
      "core-curriculum": coalitionCoreFail,
      "budget-integrity": coalitionBudgetFail,
      "judicial-independence": coalitionJudicialFail,
      "term-limits": termLimitsFailCoalition
    },
    evidenceMap: {
      "equal-service": ["ev-draft-continuity-2024-06-10", "ev-bagatz-6198-23"],
      "core-curriculum": ["ev-coalition-agreements-index-37"],
      "budget-integrity": ["ev-budget-2023-lawbill", "ev-coalition-funds-obudget-2024"],
      "judicial-independence": ["ev-reasonableness-plenum-2023-07-24", "ev-bagatz-5658-23"],
      "term-limits": ["ev-term-limits-press-2021-11-22"]
    }
  },
  {
    partyId: "utj",
    partyNameHe: "יהדות התורה",
    leaderHe: "יצחק גולדקנופף",
    block: "coalition-37",
    scores: {
      "equal-service": "FAIL",
      "core-curriculum": "FAIL",
      "budget-integrity": "FAIL",
      "judicial-independence": "FAIL",
      "term-limits": "FAIL"
    },
    basisHe: {
      "equal-service": coalitionEqualFail,
      "core-curriculum": coalitionCoreFail,
      "budget-integrity": coalitionBudgetFail,
      "judicial-independence": coalitionJudicialFail,
      "term-limits": termLimitsFailCoalition
    },
    evidenceMap: {
      "equal-service": ["ev-draft-continuity-2024-06-10", "ev-bagatz-6198-23"],
      "core-curriculum": ["ev-coalition-agreements-index-37"],
      "budget-integrity": ["ev-budget-2023-lawbill", "ev-coalition-funds-obudget-2024"],
      "judicial-independence": ["ev-reasonableness-plenum-2023-07-24", "ev-bagatz-5658-23"],
      "term-limits": ["ev-term-limits-press-2021-11-22"]
    }
  },
  {
    partyId: "religious-zionism",
    partyNameHe: "הציונות הדתית",
    leaderHe: "בצלאל סמוטריץ'",
    block: "coalition-37",
    scores: {
      "equal-service": "FAIL",
      "core-curriculum": "PARTIAL",
      "budget-integrity": "FAIL",
      "judicial-independence": "FAIL",
      "term-limits": "FAIL"
    },
    basisHe: {
      "equal-service": coalitionEqualFail,
      "core-curriculum": coalitionPartnerCorePartial,
      "budget-integrity": coalitionBudgetFail,
      "judicial-independence": coalitionJudicialFail,
      "term-limits": termLimitsFailCoalition
    },
    evidenceMap: {
      "equal-service": ["ev-draft-continuity-2024-06-10", "ev-bagatz-6198-23"],
      "core-curriculum": ["ev-coalition-agreements-index-37"],
      "budget-integrity": ["ev-budget-2023-lawbill", "ev-coalition-funds-obudget-2024"],
      "judicial-independence": ["ev-reasonableness-plenum-2023-07-24", "ev-bagatz-5658-23"],
      "term-limits": ["ev-term-limits-press-2021-11-22"]
    }
  },
  {
    partyId: "otzma-yehudit",
    partyNameHe: "עוצמה יהודית",
    leaderHe: "איתמר בן גביר",
    block: "coalition-37",
    scores: {
      "equal-service": "FAIL",
      "core-curriculum": "PARTIAL",
      "budget-integrity": "FAIL",
      "judicial-independence": "FAIL",
      "term-limits": "FAIL"
    },
    basisHe: {
      "equal-service": coalitionEqualFail,
      "core-curriculum": coalitionPartnerCorePartial,
      "budget-integrity": coalitionBudgetFail,
      "judicial-independence": coalitionJudicialFail,
      "term-limits": termLimitsFailCoalition
    },
    evidenceMap: {
      "equal-service": ["ev-draft-continuity-2024-06-10", "ev-bagatz-6198-23"],
      "core-curriculum": ["ev-coalition-agreements-index-37"],
      "budget-integrity": ["ev-budget-2023-lawbill", "ev-coalition-funds-obudget-2024"],
      "judicial-independence": ["ev-reasonableness-plenum-2023-07-24", "ev-bagatz-5658-23"],
      "term-limits": ["ev-term-limits-press-2021-11-22"]
    }
  },
  {
    partyId: "raam",
    partyNameHe: "רע\"ם",
    leaderHe: "מנסור עבאס",
    block: "arab",
    scores: {
      "equal-service": "UNCOMMITTED",
      "core-curriculum": "PASS",
      "budget-integrity": "PASS",
      "judicial-independence": "PASS",
      "term-limits": "UNCOMMITTED"
    },
    basisHe: {
      "equal-service": equalUncommitted,
      "core-curriculum": outsideCorePass,
      "budget-integrity": oppositionBudgetPass,
      "judicial-independence": oppositionJudicialPass,
      "term-limits": termLimitsUncommitted
    },
    evidenceMap: {
      "equal-service": [],
      "core-curriculum": ["ev-coalition-agreements-index-37"],
      "budget-integrity": ["ev-budget-2023-lawbill", "ev-coalition-funds-obudget-2024"],
      "judicial-independence": ["ev-reasonableness-plenum-2023-07-24", "ev-bagatz-5658-23"],
      "term-limits": []
    }
  },
  {
    partyId: "hadash-taal",
    partyNameHe: "חד\"ש-תע\"ל",
    leaderHe: "איימן עודה",
    block: "arab",
    scores: {
      "equal-service": "UNCOMMITTED",
      "core-curriculum": "PASS",
      "budget-integrity": "PASS",
      "judicial-independence": "PASS",
      "term-limits": "UNCOMMITTED"
    },
    basisHe: {
      "equal-service": equalUncommitted,
      "core-curriculum": outsideCorePass,
      "budget-integrity": oppositionBudgetPass,
      "judicial-independence": oppositionJudicialPass,
      "term-limits": termLimitsUncommitted
    },
    evidenceMap: {
      "equal-service": [],
      "core-curriculum": ["ev-coalition-agreements-index-37"],
      "budget-integrity": ["ev-budget-2023-lawbill", "ev-coalition-funds-obudget-2024"],
      "judicial-independence": ["ev-reasonableness-plenum-2023-07-24", "ev-bagatz-5658-23"],
      "term-limits": []
    }
  }
];

export const scorecard2026: ScorecardDataset = {
  electionLabelHe: "מדד רף משותף לבחירות לכנסת ה-26",
  publishedAt: "2026-03-01",
  criteria,
  evidence,
  parties
};

assertScorecardDataset(scorecard2026);

export function evidenceById(id: string): EvidenceRecord | undefined {
  return scorecard2026.evidence.find((row) => row.id === id);
}

export function criterionById(id: string): Criterion | undefined {
  return scorecard2026.criteria.find((row) => row.id === id);
}

export function partyById(id: string): PartyCompliance | undefined {
  return scorecard2026.parties.find((row) => row.partyId === id);
}
