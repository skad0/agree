import type { Db } from "./db.js";
import type { Locale } from "./i18n.js";
import {
  partyFallbackEmailForRecipient,
  partyFallbackEmailsByRecipient
} from "./integrations/elections/contacts.js";
import { normalizeHebrew } from "./integrations/elections/normalize-hebrew.js";

export type RecipientType = "party" | "politician";

export type Recipient = {
  id: number;
  type: RecipientType;
  name: string;
  email: string | null;
  whatsapp: string | null;
  socialHandle: string | null;
};

export type ContactableRecipient = Recipient;

export type DirectoryListOption = {
  id: number;
  label: string;
  ballotLetters: string | null;
};

export type DirectoryPartyOption = {
  id: number;
  label: string;
};

export type DirectoryBrowseItem = {
  id: number;
  name: string;
  type: RecipientType;
  contactable: boolean;
  list: DirectoryListOption | null;
  party: DirectoryPartyOption | null;
};

export type DirectoryQuery = {
  q: string;
  listId: number | null;
  partyId: number | null;
  personId: number | null;
  page: number;
  questionVersionId: number | null;
};

export type DirectoryPage = {
  rows: DirectoryBrowseItem[];
  total: number;
  page: number;
  pageCount: number;
  filters: { lists: DirectoryListOption[]; parties: DirectoryPartyOption[] };
};

export type ActiveDirectoryMeta = {
  electionId: number;
  electionNumber: number;
  publicationId: number;
  activatedAt: string | null;
};

export type DirectorySuggestion =
  | { kind: "person"; id: number; label: string; context: string | null; contactable: boolean; role: RecipientType }
  | { kind: "party"; id: number; label: string; context: string | null }
  | { kind: "list"; id: number; label: string; context: string | null };

export const DIRECTORY_PAGE_SIZE = 20;
export const DIRECTORY_MAX_QUERY = 100;
export const DIRECTORY_MAX_SUGGESTIONS = 8;

const namedRecipientSql = `SELECT r.id, r.type, rt.name, r.email, r.whatsapp, r.social_handle AS socialHandle FROM recipients r
    JOIN recipient_translations rt ON rt.recipient_id = r.id AND rt.locale = ?
    WHERE r.is_active = 1`;
const sendableChannelSql = `(NULLIF(TRIM(r.email), '') IS NOT NULL OR NULLIF(TRIM(r.whatsapp), '') IS NOT NULL)`;

export function listNamedRecipients(db: Db, locale: Locale): Recipient[] {
  return db.prepare(`${namedRecipientSql} ORDER BY rt.name`).all(locale) as Recipient[];
}

export function listContactableRecipients(db: Db, locale: Locale): ContactableRecipient[] {
  const direct = db.prepare(`${namedRecipientSql} AND ${sendableChannelSql} ORDER BY rt.name`).all(locale) as ContactableRecipient[];
  const byId = new Map(direct.map((row) => [row.id, row]));
  const named = listNamedRecipients(db, locale);
  const fallbacks = partyFallbackEmailsByRecipient(db, named.map((row) => row.id));
  for (const row of named) {
    if (byId.has(row.id)) continue;
    const email = fallbacks.get(row.id);
    if (!email) continue;
    byId.set(row.id, { ...row, email, whatsapp: null });
  }
  return [...byId.values()].sort((a, b) => compareText(a.name, b.name) || a.id - b.id);
}

export function getContactableRecipient(db: Db, locale: Locale, id: number): ContactableRecipient | undefined {
  const direct = db.prepare(`${namedRecipientSql} AND r.id = ? AND ${sendableChannelSql}`).get(locale, id) as ContactableRecipient | undefined;
  if (direct) return direct;
  const named = db.prepare(`${namedRecipientSql} AND r.id = ?`).get(locale, id) as ContactableRecipient | undefined;
  if (!named) return undefined;
  const email = partyFallbackEmailForRecipient(db, id);
  if (!email) return undefined;
  return { ...named, email, whatsapp: null };
}

export function hasSendableChannel(recipient: Pick<Recipient, "email" | "whatsapp">): boolean {
  return Boolean(recipient.email?.trim() || recipient.whatsapp?.trim());
}

export function listDirectoryBrowse(db: Db, locale: Locale): DirectoryBrowseItem[] {
  const named = listNamedRecipients(db, locale);
  const fallbacks = partyFallbackEmailsByRecipient(db, named.map((row) => row.id));
  const base = named.map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    contactable: hasSendableChannel(row) || fallbacks.has(row.id),
    list: null as DirectoryListOption | null,
    party: null as DirectoryPartyOption | null
  }));
  const publication = directoryPublicationRef(db);
  if (!publication) return base;
  const affiliations = loadPublishedAffiliations(db, publication.electionId);
  return base.map((row) => {
    const affiliation = affiliations.get(row.id);
    if (!affiliation) return row;
    return { ...row, list: affiliation.list, party: affiliation.party };
  });
}

export function activeDirectoryMeta(db: Db): ActiveDirectoryMeta | null {
  const row = db.prepare(`SELECT p.id AS publicationId, p.election_id AS electionId, p.activated_at AS activatedAt,
      e.number AS electionNumber
    FROM directory_publications p
    JOIN elections e ON e.id = p.election_id
    WHERE p.status = 'active'
    ORDER BY p.id DESC LIMIT 1`).get() as ActiveDirectoryMeta | undefined;
  return row ?? null;
}

export function parseDirectoryQuery(fields: {
  q?: string;
  listId?: string;
  partyId?: string;
  personId?: string;
  page?: string;
  currentPage?: string;
  clear?: string;
  questionVersionId?: string;
}): DirectoryQuery {
  const questionVersionId = parsePositiveId(fields.questionVersionId);
  if (fields.clear) {
    return { q: "", listId: null, partyId: null, personId: null, page: 1, questionVersionId };
  }
  return {
    q: (fields.q ?? "").trim().slice(0, DIRECTORY_MAX_QUERY),
    listId: parsePositiveId(fields.listId),
    partyId: parsePositiveId(fields.partyId),
    personId: parsePositiveId(fields.personId),
    page: Math.max(1, parsePositiveId(fields.page) ?? parsePositiveId(fields.currentPage) ?? 1),
    questionVersionId
  };
}

export function directoryFilters(items: DirectoryBrowseItem[]): DirectoryPage["filters"] {
  const lists = new Map<number, DirectoryListOption>();
  const parties = new Map<number, DirectoryPartyOption>();
  for (const item of items) {
    if (item.list) lists.set(item.list.id, item.list);
    if (item.party) parties.set(item.party.id, item.party);
  }
  return {
    lists: [...lists.values()].sort((a, b) => compareText(a.label, b.label) || a.id - b.id),
    parties: [...parties.values()].sort((a, b) => compareText(a.label, b.label) || a.id - b.id)
  };
}

function matchingDirectoryItems(items: DirectoryBrowseItem[], query: DirectoryQuery): DirectoryBrowseItem[] {
  const filters = directoryFilters(items);
  const knownLists = new Set(filters.lists.map((row) => row.id));
  const knownParties = new Set(filters.parties.map((row) => row.id));
  if (query.listId && !knownLists.has(query.listId)) return [];
  if (query.partyId && !knownParties.has(query.partyId)) return [];
  const terms = searchTokens(query.q);
  return items.filter((item) => {
    if (query.personId && item.id !== query.personId) return false;
    if (query.listId && item.list?.id !== query.listId) return false;
    if (query.partyId && item.party?.id !== query.partyId) return false;
    return rankItem(item, terms) !== null;
  }).sort((a, b) => {
    const rank = (rankItem(a, terms) ?? 9) - (rankItem(b, terms) ?? 9);
    return rank || compareText(a.name, b.name) || a.id - b.id;
  });
}

export function searchDirectory(items: DirectoryBrowseItem[], query: DirectoryQuery): DirectoryPage {
  const filters = directoryFilters(items);
  const matched = matchingDirectoryItems(items, query);
  const total = matched.length;
  const pageCount = Math.max(1, Math.ceil(total / DIRECTORY_PAGE_SIZE));
  const page = Math.min(query.page, pageCount);
  const start = (page - 1) * DIRECTORY_PAGE_SIZE;
  return { rows: matched.slice(start, start + DIRECTORY_PAGE_SIZE), total, page, pageCount, filters };
}

export function selectedHiddenByFilter(items: DirectoryBrowseItem[], query: DirectoryQuery, selectedIds: number[]): number {
  const matched = new Set(matchingDirectoryItems(items, query).map((row) => row.id));
  return selectedIds.filter((id) => !matched.has(id)).length;
}

export function directoryPublicationRef(db: Db): { electionId: number; publicationId: number } | null {
  const meta = activeDirectoryMeta(db);
  return meta ? { electionId: meta.electionId, publicationId: meta.publicationId } : null;
}

type PublishedAffiliation = {
  list: DirectoryListOption | null;
  party: DirectoryPartyOption | null;
};

/** Affiliations come only from accepted person links + candidacies in the active election publication.
 *  Joint-list party membership requires a reviewed candidacy_party_memberships row — list-party links alone never fill party. */
function loadPublishedAffiliations(db: Db, electionId: number): Map<number, PublishedAffiliation> {
  const byRecipient = new Map<number, PublishedAffiliation>();
  const personRows = db.prepare(`SELECT rel.recipient_id AS recipientId,
      el.id AS listId, el.title_he AS listLabel, el.ballot_letters AS ballotLetters,
      party.id AS partyId, party.name_he AS partyLabel
    FROM recipient_entity_links rel
    JOIN candidacies c ON c.person_id = rel.person_id AND c.election_id = ? AND c.status = 'active'
    JOIN electoral_lists el ON el.id = c.list_id
    LEFT JOIN candidacy_party_memberships cpm ON cpm.candidacy_id = c.id AND cpm.review_state = 'accepted'
      AND (cpm.effective_to IS NULL OR cpm.effective_to = '')
    LEFT JOIN parties party ON party.id = cpm.party_id
    WHERE rel.review_state = 'accepted' AND rel.person_id IS NOT NULL`).all(electionId) as {
    recipientId: number;
    listId: number;
    listLabel: string;
    ballotLetters: string | null;
    partyId: number | null;
    partyLabel: string | null;
  }[];
  for (const row of personRows) {
    byRecipient.set(row.recipientId, {
      list: { id: row.listId, label: row.listLabel, ballotLetters: row.ballotLetters },
      party: row.partyId && row.partyLabel ? { id: row.partyId, label: row.partyLabel } : null
    });
  }
  const partyOnly = db.prepare(`SELECT rel.recipient_id AS recipientId, p.id AS partyId, p.name_he AS partyLabel
    FROM recipient_entity_links rel
    JOIN parties p ON p.id = rel.party_id
    WHERE rel.review_state = 'accepted' AND rel.party_id IS NOT NULL`).all() as {
    recipientId: number;
    partyId: number;
    partyLabel: string;
  }[];
  for (const row of partyOnly) {
    if (byRecipient.has(row.recipientId)) continue;
    byRecipient.set(row.recipientId, {
      list: null,
      party: { id: row.partyId, label: row.partyLabel }
    });
  }
  return byRecipient;
}

export function recipientsByIds(db: Db, locale: Locale, ids: number[]): Recipient[] {
  if (!ids.length) return [];
  const found = new Map(listNamedRecipients(db, locale).filter((row) => ids.includes(row.id)).map((row) => [row.id, row]));
  return ids.flatMap((id) => {
    const row = found.get(id);
    return row ? [row] : [];
  });
}

export function suggestDirectory(items: DirectoryBrowseItem[], query: Pick<DirectoryQuery, "q" | "listId" | "partyId">): DirectorySuggestion[] {
  const key = searchKey(query.q);
  if (!key) return [];
  const scoped = items.filter((item) => {
    if (query.listId && item.list?.id !== query.listId) return false;
    if (query.partyId && item.party?.id !== query.partyId) return false;
    return true;
  });
  if (key.length === 1) {
    return ballotListSuggestions(scoped, key).slice(0, DIRECTORY_MAX_SUGGESTIONS);
  }
  if (key.length < 2) return [];
  const terms = searchTokens(query.q);
  const scored: { score: number; suggestion: DirectorySuggestion }[] = [];
  const seenParties = new Set<number>();
  const seenLists = new Set<number>();
  for (const item of scoped) {
    const score = rankItem(item, terms);
    if (score === null) continue;
    scored.push({
      score,
      suggestion: {
        kind: "person",
        id: item.id,
        label: item.name,
        context: personContext(item),
        contactable: item.contactable,
        role: item.type
      }
    });
    if (item.party && !seenParties.has(item.party.id) && affiliationMatches(item.party.label, null, terms)) {
      seenParties.add(item.party.id);
      scored.push({
        score: Math.min(score, 1),
        suggestion: { kind: "party", id: item.party.id, label: item.party.label, context: null }
      });
    }
    if (item.list && !seenLists.has(item.list.id) && affiliationMatches(item.list.label, item.list.ballotLetters, terms)) {
      seenLists.add(item.list.id);
      scored.push({
        score: Math.min(score, 1),
        suggestion: { kind: "list", id: item.list.id, label: item.list.label, context: item.list.ballotLetters }
      });
    }
  }
  scored.sort((a, b) => a.score - b.score || kindOrder(a.suggestion.kind) - kindOrder(b.suggestion.kind) || compareText(a.suggestion.label, b.suggestion.label) || a.suggestion.id - b.suggestion.id);
  return scored.slice(0, DIRECTORY_MAX_SUGGESTIONS).map((row) => row.suggestion);
}

export function mention(recipient: Pick<Recipient, "name" | "socialHandle">): string {
  return recipient.socialHandle?.trim() || recipient.name;
}

function ballotListSuggestions(items: DirectoryBrowseItem[], key: string): DirectorySuggestion[] {
  const seen = new Set<number>();
  const suggestions: DirectorySuggestion[] = [];
  for (const item of items) {
    if (!item.list || seen.has(item.list.id)) continue;
    if (searchKey(item.list.ballotLetters ?? "") !== key) continue;
    seen.add(item.list.id);
    suggestions.push({ kind: "list", id: item.list.id, label: item.list.label, context: item.list.ballotLetters });
  }
  return suggestions.sort((a, b) => compareText(a.label, b.label) || a.id - b.id);
}

function personContext(item: DirectoryBrowseItem): string | null {
  if (!item.list) return null;
  return [item.list.label, item.list.ballotLetters].filter(Boolean).join(" ");
}

function affiliationMatches(label: string, ballotLetters: string | null, terms: string[]): boolean {
  const hay = searchKey([label, ballotLetters ?? ""].join(" "));
  return terms.every((term) => hay.includes(term));
}

function rankItem(item: DirectoryBrowseItem, terms: string[]): number | null {
  if (!terms.length) return 0;
  const name = searchKey(item.name);
  const hay = searchKey([item.name, item.list?.label ?? "", item.list?.ballotLetters ?? "", item.party?.label ?? ""].join(" "));
  if (!terms.every((term) => hay.includes(term))) return null;
  const joined = terms.join(" ");
  if (name === joined) return 0;
  if (name.startsWith(joined) || terms.every((term) => name.split(" ").some((word) => word.startsWith(term)))) return 1;
  if (name.includes(joined)) return 2;
  return 3;
}

function searchTokens(q: string): string[] {
  return searchKey(q).split(" ").filter(Boolean);
}

function searchKey(value: string): string {
  return normalizeHebrew(value).toLocaleLowerCase("he");
}

function compareText(a: string, b: string): number {
  return searchKey(a).localeCompare(searchKey(b), "he");
}

function kindOrder(kind: DirectorySuggestion["kind"]): number {
  switch (kind) {
    case "person": return 0;
    case "party": return 1;
    case "list": return 2;
    default: {
      const _never: never = kind;
      return _never;
    }
  }
}

function parsePositiveId(value: string | undefined): number | null {
  if (!value) return null;
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}
