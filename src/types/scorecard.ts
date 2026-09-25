/**
 * Civic accountability scorecard schemas for the 26th Knesset election cycle.
 * Types are the contract; runtime helpers reject incomplete or unverified datasets.
 * Zod is not used: the project keeps a zero-new-runtime-dependency policy.
 */

import { locales, type Locale } from "../i18n.js";

export const CRITERION_IDS = [
  "equal-service",
  "core-curriculum",
  "budget-integrity",
  "judicial-independence",
  "term-limits"
] as const;
export type CriterionId = (typeof CRITERION_IDS)[number];

export const CRITERION_CATEGORIES = ["fiscal", "constitutional", "civic"] as const;
export type CriterionCategory = (typeof CRITERION_CATEGORIES)[number];

/** Every public scorecard string must exist in all seven site locales. */
export type Localized = Record<Locale, string>;

export type Criterion = {
  id: CriterionId;
  title: Localized;
  description: Localized;
  category: CriterionCategory;
};

export const EVIDENCE_TYPES = [
  "KNESSET_PLENUM_VOTE",
  "COALITION_AGREEMENT",
  "BAGATZ_RULING",
  "OFFICIAL_BILL",
  "OFFICIAL_PLATFORM",
  "SIGNED_PLEDGE"
] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export type EvidenceRecord = {
  id: string;
  type: EvidenceType;
  referenceNumber: Localized;
  date: string;
  summary: Localized;
  officialSourceUrl: string;
  verified: true;
};

export const COMPLIANCE_STATUSES = ["PASS", "FAIL", "PARTIAL", "UNCOMMITTED"] as const;
export type ComplianceStatus = (typeof COMPLIANCE_STATUSES)[number];

export const PARTY_IDS = [
  "likud",
  "beyachad",
  "yashar",
  "blue-white",
  "the-democrats",
  "yisrael-beiteinu",
  "shas",
  "utj",
  "religious-zionism",
  "otzma-yehudit",
  "noam",
  "raam",
  "joint-list",
  "reservists-economy",
  "amcha-yisrael",
  "israel-first",
  "pirates",
  "sharshar",
  "partnership-for-all",
  "together-succeed",
  "womens-voice",
  "gan-eden",
  "justice-law",
  "shema",
  "new-order",
  "haredi-public",
  "ani-veata",
  "brit-olam",
  "electoral-reform",
  "biblical-bloc",
  "social-security",
  "orot-hashachar",
  "personal-security",
  "black-banner",
  "ahi",
  "tzomet-beit-yisrael",
  "tkuma",
  "hakahal"
] as const;
export type PartyId = (typeof PARTY_IDS)[number];

export const PARTY_BLOCKS = ["coalition-37", "opposition", "arab", "other"] as const;
export type PartyBlock = (typeof PARTY_BLOCKS)[number];

/** Incumbent: held seats in the 25th Knesset. Challenger: no 25th-Knesset voting record. */
export const PARLIAMENTARY_STATUSES = ["INCUMBENT", "CHALLENGER"] as const;
export type ParliamentaryStatus = (typeof PARLIAMENTARY_STATUSES)[number];

export type ComplianceMetrics = {
  totalCriteria: number;
  passedCount: number;
  compliancePercentage: number;
};

export type OfficialResponse = {
  text: Localized;
  receivedAt: string;
};

export type PartyCompliance = {
  partyId: PartyId;
  /** Official Hebrew list/party name; always rendered with lang=he like the candidate directory. */
  partyNameHe: string;
  leaderHe: string;
  /** Extra Hebrew search terms: predecessor factions, joint-list partners, ballot letters. */
  searchAliasesHe?: string;
  /** One Hebrew line explaining the 2026 ballot name. Rendered with lang=he. */
  ballotNoteHe?: string;
  block: PartyBlock;
  parliamentaryStatus: ParliamentaryStatus;
  scores: Record<CriterionId, ComplianceStatus>;
  /** Neutral parliamentary/legal basis for each status, localized. */
  basis: Record<CriterionId, Localized>;
  evidenceMap: Record<CriterionId, string[]>;
  officialResponse?: OfficialResponse;
  /** Official CEC roster page for this submitted 2026 list, when published. */
  rosterUrl?: string;
};

/** PASS count over the five criteria. Partial and uncommitted do not count as passed. */
export function complianceMetrics(party: Pick<PartyCompliance, "scores">): ComplianceMetrics {
  const totalCriteria = CRITERION_IDS.length;
  let passedCount = 0;
  for (const id of CRITERION_IDS) {
    if (party.scores[id] === "PASS") passedCount += 1;
  }
  return {
    totalCriteria,
    passedCount,
    compliancePercentage: Math.round((passedCount / totalCriteria) * 100)
  };
}

export type ScorecardDataset = {
  electionLabel: Localized;
  publishedAt: string;
  criteria: Criterion[];
  evidence: EvidenceRecord[];
  parties: PartyCompliance[];
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const OFFICIAL_HOST =
  /^(https:\/\/)(main\.knesset\.gov\.il|fs\.knesset\.gov\.il|supremedecisions\.court\.gov\.il|next\.obudget\.org|www\.gov\.il)(\/|$)/i;

export function isCriterionId(value: string): value is CriterionId {
  return (CRITERION_IDS as readonly string[]).includes(value);
}

export function isComplianceStatus(value: string): value is ComplianceStatus {
  return (COMPLIANCE_STATUSES as readonly string[]).includes(value);
}

export function isPartyId(value: string): value is PartyId {
  return (PARTY_IDS as readonly string[]).includes(value);
}

export function isPartyBlock(value: string): value is PartyBlock {
  return (PARTY_BLOCKS as readonly string[]).includes(value);
}

export function isParliamentaryStatus(value: string): value is ParliamentaryStatus {
  return (PARLIAMENTARY_STATUSES as readonly string[]).includes(value);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Scorecard dataset invalid: ${message}`);
}

export function assertLocalized(value: Localized, label: string): void {
  for (const locale of locales) {
    const text = value[locale];
    assert(typeof text === "string" && text.trim().length > 0, `missing ${locale} text for ${label}`);
  }
}

/** Build a fully populated locale map; fails if any site locale is omitted. */
export function L(parts: Localized): Localized {
  assertLocalized(parts, "L()");
  return parts;
}

/** Fails fast if a published dataset drifts from the verified-evidence contract. */
export function assertScorecardDataset(dataset: ScorecardDataset): void {
  assertLocalized(dataset.electionLabel, "electionLabel");
  assert(dataset.criteria.length === CRITERION_IDS.length, "expected five criteria");
  const criterionIds = new Set<string>();
  for (const criterion of dataset.criteria) {
    assert(isCriterionId(criterion.id), `unknown criterion ${criterion.id}`);
    assert(!criterionIds.has(criterion.id), `duplicate criterion ${criterion.id}`);
    criterionIds.add(criterion.id);
    assertLocalized(criterion.title, `criterion ${criterion.id} title`);
    assertLocalized(criterion.description, `criterion ${criterion.id} description`);
    assert((CRITERION_CATEGORIES as readonly string[]).includes(criterion.category), `bad category for ${criterion.id}`);
  }
  for (const id of CRITERION_IDS) assert(criterionIds.has(id), `missing criterion ${id}`);

  const evidenceIds = new Set<string>();
  for (const record of dataset.evidence) {
    assert(record.id.trim().length > 0, "empty evidence id");
    assert(!evidenceIds.has(record.id), `duplicate evidence ${record.id}`);
    evidenceIds.add(record.id);
    assert((EVIDENCE_TYPES as readonly string[]).includes(record.type), `bad evidence type ${record.id}`);
    assert(ISO_DATE.test(record.date), `bad date on ${record.id}`);
    assertLocalized(record.referenceNumber, `evidence ${record.id} reference`);
    assertLocalized(record.summary, `evidence ${record.id} summary`);
    assert(OFFICIAL_HOST.test(record.officialSourceUrl), `non-official URL on ${record.id}`);
    assert(record.verified === true, `unverified evidence ${record.id}`);
  }

  const partyIds = new Set<string>();
  for (const party of dataset.parties) {
    assert(isPartyId(party.partyId), `unknown party ${party.partyId}`);
    assert(!partyIds.has(party.partyId), `duplicate party ${party.partyId}`);
    partyIds.add(party.partyId);
    assert(party.partyNameHe.trim().length > 0, `empty party name ${party.partyId}`);
    assert(party.leaderHe.trim().length > 0, `empty leader ${party.partyId}`);
    assert(isPartyBlock(party.block), `bad block ${party.partyId}`);
    assert(isParliamentaryStatus(party.parliamentaryStatus), `bad parliamentary status ${party.partyId}`);
    if (party.rosterUrl) assert(OFFICIAL_HOST.test(party.rosterUrl), `non-official roster URL ${party.partyId}`);
    for (const criterionId of CRITERION_IDS) {
      const status = party.scores[criterionId];
      assert(isComplianceStatus(status), `bad score ${party.partyId}/${criterionId}`);
      assertLocalized(party.basis[criterionId], `basis ${party.partyId}/${criterionId}`);
      const linked = party.evidenceMap[criterionId] ?? [];
      assert(Array.isArray(linked), `evidence map missing ${party.partyId}/${criterionId}`);
      for (const evidenceId of linked) {
        assert(evidenceIds.has(evidenceId), `missing evidence ${evidenceId} for ${party.partyId}/${criterionId}`);
      }
      if (status !== "UNCOMMITTED") {
        assert(linked.length > 0, `status ${status} without evidence for ${party.partyId}/${criterionId}`);
      }
    }
    if (party.officialResponse) {
      assertLocalized(party.officialResponse.text, `official response ${party.partyId}`);
      assert(ISO_DATE.test(party.officialResponse.receivedAt.slice(0, 10)), `bad response date ${party.partyId}`);
    }
  }
  for (const id of PARTY_IDS) assert(partyIds.has(id), `missing party ${id}`);
}
