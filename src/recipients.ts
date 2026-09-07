import type { Db } from "./db.js";
import type { Locale } from "./i18n.js";
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
};

export type DirectoryPage = {
  rows: DirectoryBrowseItem[];
  total: number;
  page: number;
  pageCount: number;
  filters: { lists: DirectoryListOption[]; parties: DirectoryPartyOption[] };
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
  return db.prepare(`${namedRecipientSql} AND ${sendableChannelSql} ORDER BY rt.name`).all(locale) as ContactableRecipient[];
}

export function getContactableRecipient(db: Db, locale: Locale, id: number): ContactableRecipient | undefined {
  return db.prepare(`${namedRecipientSql} AND r.id = ? AND ${sendableChannelSql}`).get(locale, id) as ContactableRecipient | undefined;
}

export function hasSendableChannel(recipient: Pick<Recipient, "email" | "whatsapp">): boolean {
  return Boolean(recipient.email?.trim() || recipient.whatsapp?.trim());
}

export function listDirectoryBrowse(db: Db, locale: Locale): DirectoryBrowseItem[] {
  // ponytail: legacy named recipients until an accepted election publication exists; do not invent candidacies.
  return listNamedRecipients(db, locale).map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    contactable: hasSendableChannel(row),
    list: null,
    party: null
  }));
}

export function parseDirectoryQuery(fields: {
  q?: string;
  listId?: string;
  partyId?: string;
  personId?: string;
  page?: string;
  clear?: string;
}): DirectoryQuery {
  if (fields.clear) {
    return { q: "", listId: null, partyId: null, personId: null, page: 1 };
  }
  return {
    q: (fields.q ?? "").trim().slice(0, DIRECTORY_MAX_QUERY),
    listId: parsePositiveId(fields.listId),
    partyId: parsePositiveId(fields.partyId),
    personId: parsePositiveId(fields.personId),
    page: Math.max(1, parsePositiveId(fields.page) ?? 1)
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

export function searchDirectory(items: DirectoryBrowseItem[], query: DirectoryQuery): DirectoryPage {
  const filters = directoryFilters(items);
  const knownLists = new Set(filters.lists.map((row) => row.id));
  const knownParties = new Set(filters.parties.map((row) => row.id));
  if (query.listId && !knownLists.has(query.listId)) {
    return { rows: [], total: 0, page: 1, pageCount: 1, filters };
  }
  if (query.partyId && !knownParties.has(query.partyId)) {
    return { rows: [], total: 0, page: 1, pageCount: 1, filters };
  }
  const terms = searchTokens(query.q);
  const matched = items.filter((item) => {
    if (query.personId && item.id !== query.personId) return false;
    if (query.listId && item.list?.id !== query.listId) return false;
    if (query.partyId && item.party?.id !== query.partyId) return false;
    return rankItem(item, terms) !== null;
  }).sort((a, b) => {
    const rank = (rankItem(a, terms) ?? 9) - (rankItem(b, terms) ?? 9);
    return rank || compareText(a.name, b.name) || a.id - b.id;
  });
  const total = matched.length;
  const pageCount = Math.max(1, Math.ceil(total / DIRECTORY_PAGE_SIZE));
  const page = Math.min(query.page, pageCount);
  const start = (page - 1) * DIRECTORY_PAGE_SIZE;
  return { rows: matched.slice(start, start + DIRECTORY_PAGE_SIZE), total, page, pageCount, filters };
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
