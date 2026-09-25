/**
 * Civic accountability scorecard schemas for the 26th Knesset election cycle.
 * Types are the contract; runtime helpers reject incomplete or unverified datasets.
 * Zod is not used: the project keeps a zero-new-runtime-dependency policy.
 */

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

export type Criterion = {
  id: CriterionId;
  titleHe: string;
  descriptionHe: string;
  category: CriterionCategory;
};

export const EVIDENCE_TYPES = [
  "KNESSET_PLENUM_VOTE",
  "COALITION_AGREEMENT",
  "BAGATZ_RULING",
  "OFFICIAL_BILL"
] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export type EvidenceRecord = {
  id: string;
  type: EvidenceType;
  referenceNumber: string;
  date: string;
  summaryHe: string;
  officialSourceUrl: string;
  verified: true;
};

export const COMPLIANCE_STATUSES = ["PASS", "FAIL", "PARTIAL", "UNCOMMITTED"] as const;
export type ComplianceStatus = (typeof COMPLIANCE_STATUSES)[number];

export const PARTY_IDS = [
  "likud",
  "yesh-atid",
  "national-unity",
  "the-democrats",
  "yisrael-beiteinu",
  "shas",
  "utj",
  "religious-zionism",
  "otzma-yehudit",
  "raam",
  "hadash-taal"
] as const;
export type PartyId = (typeof PARTY_IDS)[number];

export const PARTY_BLOCKS = ["coalition-37", "opposition", "arab"] as const;
export type PartyBlock = (typeof PARTY_BLOCKS)[number];

export type OfficialResponse = {
  textHe: string;
  receivedAt: string;
};

export type PartyCompliance = {
  partyId: PartyId;
  partyNameHe: string;
  leaderHe: string;
  block: PartyBlock;
  scores: Record<CriterionId, ComplianceStatus>;
  /** Neutral parliamentary/legal basis for each status, shown next to evidence. */
  basisHe: Record<CriterionId, string>;
  evidenceMap: Record<CriterionId, string[]>;
  officialResponse?: OfficialResponse;
};

export type ScorecardDataset = {
  electionLabelHe: string;
  publishedAt: string;
  criteria: Criterion[];
  evidence: EvidenceRecord[];
  parties: PartyCompliance[];
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const OFFICIAL_HOST =
  /^(https:\/\/)(main\.knesset\.gov\.il|fs\.knesset\.gov\.il|supremedecisions\.court\.gov\.il|next\.obudget\.org)(\/|$)/i;

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

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Scorecard dataset invalid: ${message}`);
}

/** Fails fast if a published dataset drifts from the verified-evidence contract. */
export function assertScorecardDataset(dataset: ScorecardDataset): void {
  assert(dataset.criteria.length === CRITERION_IDS.length, "expected five criteria");
  const criterionIds = new Set<string>();
  for (const criterion of dataset.criteria) {
    assert(isCriterionId(criterion.id), `unknown criterion ${criterion.id}`);
    assert(!criterionIds.has(criterion.id), `duplicate criterion ${criterion.id}`);
    criterionIds.add(criterion.id);
    assert(criterion.titleHe.trim().length > 0, `empty title for ${criterion.id}`);
    assert(criterion.descriptionHe.trim().length > 0, `empty description for ${criterion.id}`);
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
    assert(record.referenceNumber.trim().length > 0, `empty reference on ${record.id}`);
    assert(record.summaryHe.trim().length > 0, `empty summary on ${record.id}`);
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
    for (const criterionId of CRITERION_IDS) {
      const status = party.scores[criterionId];
      assert(isComplianceStatus(status), `bad score ${party.partyId}/${criterionId}`);
      const basis = party.basisHe[criterionId];
      assert(typeof basis === "string" && basis.trim().length > 0, `missing basis ${party.partyId}/${criterionId}`);
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
      assert(party.officialResponse.textHe.trim().length > 0, `empty official response ${party.partyId}`);
      assert(ISO_DATE.test(party.officialResponse.receivedAt.slice(0, 10)), `bad response date ${party.partyId}`);
    }
  }
  for (const id of PARTY_IDS) assert(partyIds.has(id), `missing party ${id}`);
}
