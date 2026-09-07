import { createHash } from "node:crypto";
import type { Db } from "./db.js";
import type { Locale } from "./i18n.js";

export const STANCE_CLASSIFICATIONS = [
  "supports",
  "supports_with_reservations",
  "opposes",
  "statement_available",
  "unknown",
  "under_review",
  "multiple"
] as const;
export type StanceClassification = (typeof STANCE_CLASSIFICATIONS)[number];

export const PUBLIC_CLASSIFICATIONS = [
  "supports",
  "supports_with_reservations",
  "opposes",
  "statement_available",
  "multiple"
] as const;
export type PublicClassification = (typeof PUBLIC_CLASSIFICATIONS)[number];

export const PUBLICATION_STATES = ["draft", "published", "retracted", "under_review"] as const;
export type PublicationState = (typeof PUBLICATION_STATES)[number];

export type StanceSubjectKind = "person" | "party" | "list";
export type StanceSubject =
  | { kind: "person"; personId: number }
  | { kind: "party"; partyId: number }
  | { kind: "list"; listId: number };

export type QuestionChoice = {
  versionId: number;
  demandId: number;
  semanticVersion: string;
  title: string;
  body: string | null;
  rationale: string | null;
};

export type StanceDisplay =
  | { state: "none" }
  | { state: "unknown" }
  | { state: "under_review" }
  | {
      state: "published";
      attribution: StanceSubjectKind;
      individualUnknown: boolean;
      historical: boolean;
      classification: PublicClassification;
      summary: string | null;
      excerpt: string | null;
      sourceUrl: string | null;
      statementAt: string | null;
      verifiedAt: string | null;
    };

export type StanceWriteInput = {
  id?: number;
  subject: StanceSubject;
  questionVersionId: number;
  electionId?: number | null;
  classification: StanceClassification;
  summary?: string | null;
  excerpt?: string | null;
  sourceUrl?: string | null;
  statementAt?: string | null;
  verifiedAt?: string | null;
};

export type QuestionVersionWrite = {
  demandId: number;
  semanticVersion: string;
  reviewed: boolean;
};

export type WriteResult = { ok: true; id: number } | { ok: false; error: string };

export type AdminStanceRow = {
  id: number;
  publicationState: string;
  classification: string;
  question: string;
  semanticVersion: string;
  subject: string;
};

const SUMMARY_MAX = 500;
const URL_MAX = 500;
const SEMVER = /^[0-9]+\.[0-9]+\.[0-9]+$/;

export function isStanceClassification(value: string): value is StanceClassification {
  return (STANCE_CLASSIFICATIONS as readonly string[]).includes(value);
}

export function isPublicClassification(value: string): value is PublicClassification {
  return (PUBLIC_CLASSIFICATIONS as readonly string[]).includes(value);
}

export function isPublicationState(value: string): value is PublicationState {
  return (PUBLICATION_STATES as readonly string[]).includes(value);
}

export function parseSemanticVersion(value: string): [number, number, number] | undefined {
  if (!SEMVER.test(value)) return undefined;
  const [major, minor, patch] = value.split(".").map(Number);
  if (![major, minor, patch].every((part) => Number.isInteger(part))) return undefined;
  return [major!, minor!, patch!];
}

export function compareSemanticVersion(a: string, b: string): number {
  const left = parseSemanticVersion(a);
  const right = parseSemanticVersion(b);
  if (!left && !right) return 0;
  if (!left) return -1;
  if (!right) return 1;
  return left[0] - right[0] || left[1] - right[1] || left[2] - right[2];
}

export function currentQuestionVersionForDemand(db: Db, demandId: number | null | undefined): number | null {
  if (!demandId) return null;
  const rows = db.prepare(`SELECT id, semantic_version AS semanticVersion FROM program_question_versions
    WHERE demand_id = ? AND reviewed_at IS NOT NULL`).all(demandId) as { id: number; semanticVersion: string }[];
  const current = rows.sort((a, b) => compareSemanticVersion(b.semanticVersion, a.semanticVersion))[0];
  return current?.id ?? null;
}

export function listSelectableQuestions(db: Db, locale: Locale): QuestionChoice[] {
  const rows = db.prepare(`SELECT v.id AS versionId, v.demand_id AS demandId, v.semantic_version AS semanticVersion,
      dt.title, dt.body, dt.rationale
    FROM program_question_versions v
    JOIN demands d ON d.id = v.demand_id
    JOIN campaigns c ON c.id = d.campaign_id
    JOIN demand_translations dt ON dt.demand_id = d.id AND dt.locale = ?
    WHERE c.status = 'active' AND d.is_active = 1 AND d.document = 'standard' AND v.reviewed_at IS NOT NULL
    ORDER BY d.sort_order, v.id`).all(locale) as QuestionChoice[];
  const best = new Map<number, QuestionChoice>();
  for (const row of rows) {
    const existing = best.get(row.demandId);
    if (!existing || compareSemanticVersion(row.semanticVersion, existing.semanticVersion) > 0) best.set(row.demandId, row);
  }
  return [...best.values()];
}

export function listQuestionVersions(db: Db): { id: number; demandId: number; semanticVersion: string; reviewedAt: string | null; title: string | null }[] {
  return db.prepare(`SELECT v.id, v.demand_id AS demandId, v.semantic_version AS semanticVersion, v.reviewed_at AS reviewedAt,
      (SELECT title FROM demand_translations WHERE demand_id = v.demand_id ORDER BY locale = 'en' DESC, locale LIMIT 1) title
    FROM program_question_versions v ORDER BY v.demand_id, v.id`).all() as { id: number; demandId: number; semanticVersion: string; reviewedAt: string | null; title: string | null }[];
}

export function saveQuestionVersion(db: Db, input: QuestionVersionWrite): WriteResult {
  const version = parseSemanticVersion(input.semanticVersion);
  if (!version) return { ok: false, error: "Semantic version must look like 1.0.0." };
  const demand = db.prepare(`SELECT id, document, campaign_id AS campaignId FROM demands WHERE id = ? AND is_active = 1`).get(input.demandId) as { id: number; document: string; campaignId: number } | undefined;
  if (!demand || demand.document !== "standard") return { ok: false, error: "Question versions attach only to active standard demands." };
  const body = db.prepare(`SELECT body FROM demand_translations WHERE demand_id = ? ORDER BY locale = 'en' DESC, locale LIMIT 1`).get(input.demandId) as { body: string } | undefined;
  if (!body?.body.trim()) return { ok: false, error: "The demand needs canonical text before it can be versioned." };
  const hash = createHash("sha256").update(body.body).digest("hex");
  const reviewedAt = input.reviewed ? new Date().toISOString() : null;
  try {
    const row = db.prepare(`INSERT INTO program_question_versions (demand_id, campaign_id, semantic_version, canonical_text_hash, reviewed_at)
      VALUES (?, ?, ?, ?, ?) RETURNING id`).get(input.demandId, demand.campaignId, input.semanticVersion, hash, reviewedAt) as { id: number };
    return { ok: true, id: row.id };
  } catch {
    return { ok: false, error: "That demand already has this semantic version." };
  }
}

export function displayStanceForRecipient(db: Db, recipientId: number, questionVersionId: number | null, locale: Locale): StanceDisplay {
  return displayStancesForRecipients(db, [recipientId], questionVersionId, locale).get(recipientId) ?? { state: "none" };
}

export function displayStancesForRecipients(db: Db, recipientIds: number[], questionVersionId: number | null, locale: Locale): Map<number, StanceDisplay> {
  const result = new Map<number, StanceDisplay>();
  for (const id of recipientIds) result.set(id, { state: "none" });
  if (!questionVersionId || !recipientIds.length) return result;
  const selected = db.prepare(`SELECT id, demand_id AS demandId, semantic_version AS semanticVersion FROM program_question_versions WHERE id = ?`)
    .get(questionVersionId) as { id: number; demandId: number; semanticVersion: string } | undefined;
  if (!selected) {
    for (const id of recipientIds) result.set(id, { state: "unknown" });
    return result;
  }
  const placeholders = recipientIds.map(() => "?").join(",");
  const links = db.prepare(`SELECT recipient_id AS recipientId, person_id AS personId, party_id AS partyId
    FROM recipient_entity_links WHERE review_state = 'accepted' AND recipient_id IN (${placeholders})`).all(...recipientIds) as RecipientLink[];
  const personIds = [...new Set(links.flatMap((row) => row.personId ? [row.personId] : []))];
  const memberships = personIds.length
    ? db.prepare(`SELECT c.person_id AS personId, cpm.party_id AS partyId
        FROM candidacies c
        JOIN candidacy_party_memberships cpm ON cpm.candidacy_id = c.id AND cpm.review_state = 'accepted'
        WHERE c.person_id IN (${personIds.map(() => "?").join(",")})`).all(...personIds) as { personId: number; partyId: number }[]
    : [];
  const partyByPerson = new Map<number, number[]>();
  for (const row of memberships) {
    const current = partyByPerson.get(row.personId) ?? [];
    current.push(row.partyId);
    partyByPerson.set(row.personId, current);
  }
  const partyIds = [...new Set([
    ...links.flatMap((row) => row.partyId ? [row.partyId] : []),
    ...memberships.map((row) => row.partyId)
  ])];
  const records = loadDemandStances(db, selected.demandId, locale, personIds, partyIds, []);
  for (const id of recipientIds) {
    const link = links.find((row) => row.recipientId === id);
    result.set(id, projectStance(records, selected, {
      personId: link?.personId ?? null,
      partyIds: link?.personId ? partyByPerson.get(link.personId) ?? [] : link?.partyId ? [link.partyId] : [],
      listId: null
    }));
  }
  return result;
}

export function displayStanceForSubjects(
  db: Db,
  subjects: { personId?: number | null; partyIds?: number[]; listId?: number | null },
  questionVersionId: number | null,
  locale: Locale
): StanceDisplay {
  if (!questionVersionId) return { state: "none" };
  const selected = db.prepare(`SELECT id, demand_id AS demandId, semantic_version AS semanticVersion FROM program_question_versions WHERE id = ?`)
    .get(questionVersionId) as { id: number; demandId: number; semanticVersion: string } | undefined;
  if (!selected) return { state: "unknown" };
  const personIds = subjects.personId ? [subjects.personId] : [];
  const partyIds = subjects.partyIds ?? [];
  const listIds = subjects.listId ? [subjects.listId] : [];
  return projectStance(loadDemandStances(db, selected.demandId, locale, personIds, partyIds, listIds), selected, {
    personId: subjects.personId ?? null,
    partyIds,
    listId: subjects.listId ?? null
  });
}

export function saveStance(db: Db, input: StanceWriteInput, publicationState: PublicationState): WriteResult {
  if (!isStanceClassification(input.classification)) return { ok: false, error: "Choose a classification." };
  const version = db.prepare("SELECT id FROM program_question_versions WHERE id = ?").get(input.questionVersionId) as { id: number } | undefined;
  if (!version) return { ok: false, error: "Choose a question version." };
  if (!subjectExists(db, input.subject)) return { ok: false, error: "The chosen person, party or list does not exist." };
  const summary = boundText(input.summary, SUMMARY_MAX);
  const excerpt = boundText(input.excerpt, SUMMARY_MAX);
  const sourceUrl = boundText(input.sourceUrl, URL_MAX);
  if (sourceUrl && !/^https?:\/\//i.test(sourceUrl)) return { ok: false, error: "Source URL must be http or https." };
  const statementAt = boundText(input.statementAt, 40);
  const verifiedAt = boundText(input.verifiedAt, 40) ?? (publicationState === "published" ? new Date().toISOString() : null);
  if (publicationState === "published") {
    if (!isPublicClassification(input.classification)) return { ok: false, error: "Publishing needs a reviewed classification, not unknown." };
    if (!sourceUrl || !statementAt) return { ok: false, error: "Publishing needs a source URL and statement date." };
  }
  const columns = subjectColumns(input.subject);
  try {
    if (input.id) {
      const existing = db.prepare("SELECT id FROM public_stances WHERE id = ?").get(input.id) as { id: number } | undefined;
      if (!existing) return { ok: false, error: "That stance does not exist." };
      db.prepare(`UPDATE public_stances SET person_id = ?, party_id = ?, list_id = ?, question_version_id = ?, election_id = ?,
        classification = ?, publication_state = ?, summary = ?, excerpt = ?, source_url = ?, statement_at = ?, verified_at = ?, reviewer = ?
        WHERE id = ?`).run(
        columns.personId, columns.partyId, columns.listId, input.questionVersionId, input.electionId ?? null,
        input.classification, publicationState, summary, excerpt, sourceUrl, statementAt, verifiedAt, "admin", input.id
      );
      return { ok: true, id: input.id };
    }
    const row = db.prepare(`INSERT INTO public_stances (
        person_id, party_id, list_id, question_version_id, election_id, classification, publication_state,
        summary, excerpt, source_url, statement_at, verified_at, reviewer
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`).get(
      columns.personId, columns.partyId, columns.listId, input.questionVersionId, input.electionId ?? null,
      input.classification, publicationState, summary, excerpt, sourceUrl, statementAt, verifiedAt, "admin"
    ) as { id: number };
    return { ok: true, id: row.id };
  } catch {
    return { ok: false, error: "The stance could not be saved." };
  }
}

export function retractStance(db: Db, id: number): WriteResult {
  const row = db.prepare("SELECT id, publication_state AS publicationState FROM public_stances WHERE id = ?").get(id) as { id: number; publicationState: string } | undefined;
  if (!row) return { ok: false, error: "That stance does not exist." };
  db.prepare("UPDATE public_stances SET publication_state = 'retracted' WHERE id = ?").run(id);
  return { ok: true, id };
}

export function listAdminStances(db: Db): AdminStanceRow[] {
  return db.prepare(`SELECT ps.id, ps.publication_state AS publicationState, ps.classification,
      pqv.semantic_version AS semanticVersion,
      COALESCE((SELECT title FROM demand_translations WHERE demand_id = pqv.demand_id ORDER BY locale = 'en' DESC, locale LIMIT 1), 'question') question,
      CASE
        WHEN ps.person_id IS NOT NULL THEN 'person #' || ps.person_id
        WHEN ps.party_id IS NOT NULL THEN 'party #' || ps.party_id
        ELSE 'list #' || ps.list_id
      END AS subject
    FROM public_stances ps
    JOIN program_question_versions pqv ON pqv.id = ps.question_version_id
    ORDER BY ps.id DESC`).all() as AdminStanceRow[];
}

export function getAdminStance(db: Db, id: number): StanceWriteInput | undefined {
  const row = db.prepare(`SELECT id, person_id AS personId, party_id AS partyId, list_id AS listId, question_version_id AS questionVersionId,
      election_id AS electionId, classification, summary, excerpt, source_url AS sourceUrl, statement_at AS statementAt, verified_at AS verifiedAt
    FROM public_stances WHERE id = ?`).get(id) as {
    id: number;
    personId: number | null;
    partyId: number | null;
    listId: number | null;
    questionVersionId: number;
    electionId: number | null;
    classification: string;
    summary: string | null;
    excerpt: string | null;
    sourceUrl: string | null;
    statementAt: string | null;
    verifiedAt: string | null;
  } | undefined;
  if (!row || !isStanceClassification(row.classification)) return undefined;
  const subject = row.personId ? { kind: "person" as const, personId: row.personId }
    : row.partyId ? { kind: "party" as const, partyId: row.partyId }
      : row.listId ? { kind: "list" as const, listId: row.listId }
        : undefined;
  if (!subject) return undefined;
  return {
    id: row.id,
    subject,
    questionVersionId: row.questionVersionId,
    electionId: row.electionId,
    classification: row.classification,
    summary: row.summary,
    excerpt: row.excerpt,
    sourceUrl: row.sourceUrl,
    statementAt: row.statementAt,
    verifiedAt: row.verifiedAt
  };
}

export function parseStanceSubject(kind: string, id: number | undefined): StanceSubject | undefined {
  if (!id) return undefined;
  switch (kind) {
    case "person": return { kind: "person", personId: id };
    case "party": return { kind: "party", partyId: id };
    case "list": return { kind: "list", listId: id };
    default: return undefined;
  }
}

type RecipientLink = { recipientId: number; personId: number | null; partyId: number | null };
type StanceRecord = {
  id: number;
  personId: number | null;
  partyId: number | null;
  listId: number | null;
  classification: string;
  publicationState: string;
  summary: string | null;
  excerpt: string | null;
  sourceUrl: string | null;
  statementAt: string | null;
  verifiedAt: string | null;
  questionVersionId: number;
  semanticVersion: string;
};

function loadDemandStances(db: Db, demandId: number, locale: Locale, personIds: number[], partyIds: number[], listIds: number[]): StanceRecord[] {
  const clauses: string[] = [];
  const params: Array<string | number> = [locale, demandId];
  if (personIds.length) {
    clauses.push(`ps.person_id IN (${personIds.map(() => "?").join(",")})`);
    params.push(...personIds);
  }
  if (partyIds.length) {
    clauses.push(`ps.party_id IN (${partyIds.map(() => "?").join(",")})`);
    params.push(...partyIds);
  }
  if (listIds.length) {
    clauses.push(`ps.list_id IN (${listIds.map(() => "?").join(",")})`);
    params.push(...listIds);
  }
  if (!clauses.length) return [];
  return db.prepare(`SELECT ps.id, ps.person_id AS personId, ps.party_id AS partyId, ps.list_id AS listId,
      ps.classification, ps.publication_state AS publicationState, COALESCE(t.summary, ps.summary) AS summary,
      COALESCE(t.excerpt, ps.excerpt) AS excerpt, ps.source_url AS sourceUrl, ps.statement_at AS statementAt,
      ps.verified_at AS verifiedAt, ps.question_version_id AS questionVersionId, pqv.semantic_version AS semanticVersion
    FROM public_stances ps
    JOIN program_question_versions pqv ON pqv.id = ps.question_version_id
    LEFT JOIN public_stance_translations t ON t.stance_id = ps.id AND t.locale = ?
    WHERE pqv.demand_id = ? AND (${clauses.join(" OR ")})`).all(...params) as StanceRecord[];
}

function projectStance(
  records: StanceRecord[],
  selected: { id: number; demandId: number; semanticVersion: string },
  subjects: { personId: number | null; partyIds: number[]; listId: number | null }
): StanceDisplay {
  const personal = records.filter((row) => subjects.personId && row.personId === subjects.personId);
  const organizational = records.filter((row) =>
    (row.partyId != null && subjects.partyIds.includes(row.partyId))
    || (subjects.listId != null && row.listId === subjects.listId)
  );
  const selectedPersonal = personal.filter((row) => row.questionVersionId === selected.id);
  if (selectedPersonal.some((row) => row.publicationState === "under_review")) return { state: "under_review" };
  const publishedPersonal = selectedPersonal.filter((row) => row.publicationState === "published");
  if (publishedPersonal.length) return publishedView(publishedPersonal, "person", false, false);
  const olderPersonal = personal.filter((row) => row.publicationState === "published" && compareSemanticVersion(row.semanticVersion, selected.semanticVersion) < 0)
    .sort((a, b) => compareSemanticVersion(b.semanticVersion, a.semanticVersion));
  if (olderPersonal.length) return publishedView(olderPersonal, "person", false, true);

  const selectedOrg = organizational.filter((row) => row.questionVersionId === selected.id && row.publicationState === "published");
  if (selectedOrg.length) {
    const attribution: StanceSubjectKind = selectedOrg[0]!.listId != null ? "list" : "party";
    return publishedView(selectedOrg, attribution, Boolean(subjects.personId), false);
  }
  const olderOrg = organizational.filter((row) => row.publicationState === "published" && compareSemanticVersion(row.semanticVersion, selected.semanticVersion) < 0)
    .sort((a, b) => compareSemanticVersion(b.semanticVersion, a.semanticVersion));
  if (olderOrg.length) {
    const attribution: StanceSubjectKind = olderOrg[0]!.listId != null ? "list" : "party";
    return publishedView(olderOrg, attribution, Boolean(subjects.personId), true);
  }
  return { state: "unknown" };
}

function publishedView(rows: StanceRecord[], attribution: StanceSubjectKind, individualUnknown: boolean, historical: boolean): StanceDisplay {
  const publicRows = rows.filter((row) => isPublicClassification(row.classification));
  if (!publicRows.length) return { state: "unknown" };
  if (publicRows.length > 1 || publicRows[0]!.classification === "multiple") {
    const row = publicRows[0]!;
    return {
      state: "published",
      attribution,
      individualUnknown,
      historical,
      classification: "multiple",
      summary: row.summary,
      excerpt: row.excerpt,
      sourceUrl: row.sourceUrl,
      statementAt: row.statementAt,
      verifiedAt: row.verifiedAt
    };
  }
  const row = publicRows[0]!;
  if (!isPublicClassification(row.classification)) return { state: "unknown" };
  return {
    state: "published",
    attribution,
    individualUnknown,
    historical,
    classification: row.classification,
    summary: row.summary,
    excerpt: row.excerpt,
    sourceUrl: row.sourceUrl,
    statementAt: row.statementAt,
    verifiedAt: row.verifiedAt
  };
}

function subjectColumns(subject: StanceSubject): { personId: number | null; partyId: number | null; listId: number | null } {
  switch (subject.kind) {
    case "person": return { personId: subject.personId, partyId: null, listId: null };
    case "party": return { personId: null, partyId: subject.partyId, listId: null };
    case "list": return { personId: null, partyId: null, listId: subject.listId };
    default: {
      const _never: never = subject;
      return _never;
    }
  }
}

function subjectExists(db: Db, subject: StanceSubject): boolean {
  switch (subject.kind) {
    case "person": return Boolean(db.prepare("SELECT 1 FROM people WHERE id = ?").get(subject.personId));
    case "party": return Boolean(db.prepare("SELECT 1 FROM parties WHERE id = ?").get(subject.partyId));
    case "list": return Boolean(db.prepare("SELECT 1 FROM electoral_lists WHERE id = ?").get(subject.listId));
    default: {
      const _never: never = subject;
      return _never;
    }
  }
}

function boundText(value: string | null | undefined, max: number): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}
