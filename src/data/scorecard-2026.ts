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
 * Case-number correction: the equal-draft High Court ruling is בג"ץ 6198/23
 * (25 June 2024), not "4398/24". Every URL targets an official host.
 */

const criteria: Criterion[] = [
  {
    id: "equal-service",
    titleHe: "שוויון בנטל השירות",
    descriptionHe:
      "עמידה בחובת גיוס שוויונית לפי חוק שירות ביטחון, יישום פסיקת בג\"ץ נגד פטור גורף, והתנגדות להחלת דין רציפות על מתווי פטור מגיוס שאינם עונים לצורכי הביטחון.",
    category: "civic"
  },
  {
    id: "core-curriculum",
    titleHe: "לימודי ליבה בחינוך המתוקצב",
    descriptionHe:
      "דרישה לפיקוח ממלכתי וללימודי ליבה בכל רשת חינוך המקבלת תקציב ציבורי, לרבות החינוך העצמאי ומעיין החינוך התורני, בלי פטור קואליציוני מפיקוח.",
    category: "civic"
  },
  {
    id: "budget-integrity",
    titleHe: "שקיפות וכספים קואליציוניים",
    descriptionHe:
      "שקיפות בהקצאות הנובעות מהסכמים קואליציוניים, התנגדות להעברות מגזריות לא-שקופות, והצבעה אחראית על חוקי התקציב הכוללים הקצאות קואליציוניות חריגות.",
    category: "fiscal"
  },
  {
    id: "judicial-independence",
    titleHe: "עצמאות מערכת המשפט",
    descriptionHe:
      "שמירה על ביקורת שיפוטית, לרבות עילת הסבירות, והימנעות מתיקוני יסוד המרוקנים את בג\"ץ מסמכותו לבקר החלטות ממשלה ושרים.",
    category: "constitutional"
  },
  {
    id: "term-limits",
    titleHe: "הגבלת כהונה וטוהר מידות",
    descriptionHe:
      "תמיכה בחקיקה המגבילה כהונת ראש ממשלה לשמונה שנים רצופות או מצטברות, כמנגנון ליציבות דמוקרטית ולמניעת קיפאון בשלטון.",
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
      "תיק הוועדה של הכנסת ה-25 מתעד את הודעת הממשלה על רצונה להחיל דין רציפות (27.5.2024), את עמדת היועצת המשפטית לממשלה על מניעה משפטית, ואת החלטת המליאה מ-10.6.2024 להעביר את ההצעות להמשך דיון בוועדת החוץ והביטחון.",
    officialSourceUrl: "https://fs.knesset.gov.il/25/law/25_ls_bk_4564473.pdf",
    verified: true
  },
  {
    id: "ev-bagatz-6198-23",
    type: "BAGATZ_RULING",
    referenceNumber: "בג\"ץ 6198/23 התנועה למען איכות השלטון בישראל נ' שר הביטחון (פסק דין, 25.6.2024)",
    date: "2024-06-25",
    summaryHe:
      "בית המשפט העליון קבע פה אחד כי בהיעדר מסגרת חוקית לפטור אין סמכות להימנע מגיוס גורף של תלמידי ישיבות, וכי לא ניתן להמשיך ולהעביר כספי תמיכות למוסדות עבור תלמידים שלא קיבלו פטור או דחיית שירות כדין.",
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
      "עמוד הכנסת מפרסם את ההסכמים הקואליציוניים של הממשלה ה-37 בין הליכוד לבין יהדות התורה, ש\"ס, הציונות הדתית ועוצמה יהודית. ההסכמים עם יהדות התורה וש\"ס מעגנים עצמאות פדגוגית ותקצוב של רשתות החינוך העצמאי ומעיין החינוך התורני.",
    officialSourceUrl: "https://main.knesset.gov.il/mk/government/pages/coalitionagreements.aspx",
    verified: true
  },
  {
    id: "ev-budget-2023-lawbill",
    type: "OFFICIAL_BILL",
    referenceNumber: "חוק התקציב לשנת הכספים 2023, התשפ\"ג-2023 — הצעת חוק הממשלה",
    date: "2023-05-24",
    summaryHe:
      "חוק התקציב לשנת 2023 אושר במליאה במסגרת חקיקת התקציב הדו-שנתית של הממשלה ה-37, וכלל את המסגרת הכספית ליישום הסכמים קואליציוניים בשנת הכספים.",
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
      "חוק התקציב לשנת 2024 אושר יחד עם תקציב 2023. ההקצאות הקואליציוניות ליישום ההסכמים הפוליטיים פורטו בהחלטות ממשלה נלוות ופורסמו במפתח התקציב.",
    officialSourceUrl:
      "https://main.knesset.gov.il/Activity/Legislation/Laws/pages/lawbill.aspx?lawitemid=2203820&t=lawsuggestionssearch",
    verified: true
  },
  {
    id: "ev-coalition-funds-obudget-2024",
    type: "COALITION_AGREEMENT",
    referenceNumber: "החלטות ממשלה — יישום הסכמים קואליציוניים בשנת הכספים 2024 (מפתח התקציב)",
    date: "2024-01-01",
    summaryHe:
      "מפתח התקציב (next.obudget.org) מתעד את תיקוני החלטות הממשלה ליישום הסכמים קואליציוניים בשנת 2024, כולל עדכון מסגרות ההקצאה והפניה להחלטות 241, 511, 562 ו-861.",
    officialSourceUrl: "https://next.obudget.org/i/gov_decisions/9aff6f75-7f24-474e-bef0-a241b84a5120",
    verified: true
  },
  {
    id: "ev-reasonableness-plenum-2023-07-24",
    type: "KNESSET_PLENUM_VOTE",
    referenceNumber: "חוק-יסוד: השפיטה (תיקון מס' 3) — קריאה שנייה ושלישית, 24 ביולי 2023",
    date: "2023-07-24",
    summaryHe:
      "מליאת הכנסת אישרה ברוב 64 מול 0 את התיקון ששלל דיון שיפוטי בסבירות החלטות הממשלה, ראש הממשלה או שר. חברי האופוזיציה החרימו את ההצבעה הסופית ויצאו מהמליאה.",
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
      "בית המשפט העליון, בדעת רוב, הכריז על בטלות תיקון מס' 3 לחוק-יסוד: השפיטה — התיקון שביטל את עילת הסבירות ביחס להחלטות הממשלה והשרים — וקבע כי הכנסת חרגה מסמכותה המכוננת במקרה קצה זה.",
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
      "נוסח רשמי של הכנסת ה-25 מציע להוסיף לחוק-יסוד: הממשלה סעיף הקובע כי מי שכיהן כראש ממשלה תקופה רצופה של שמונה שנים לא יהיה רשאי עוד לכהן בתפקיד. ההצעה מפנה לנוסחים קודמים מהכנסת ה-24.",
    officialSourceUrl: "https://fs.knesset.gov.il/25/law/25_lst_10244471.pdf",
    verified: true
  }
];

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
      "core-curriculum": "PARTIAL",
      "budget-integrity": "PASS",
      "judicial-independence": "PASS",
      "term-limits": "UNCOMMITTED"
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
