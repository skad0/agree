/**
 * Public positions on the ten standard questions, collected from the press and party channels.
 * This is a record of statements, not a score: it never feeds the scorecard matrix, whose
 * statuses rest only on official Knesset, court and government records.
 */

import { issueSlugs } from "../issues.js";
import { assertLocalized, isPartyId, type Localized, type PartyId } from "./scorecard.js";

export type IssueSlug = (typeof issueSlugs)[number];

/** How a statement relates to the standard's commitment as written. */
export const POSITION_STANCES = ["supports", "supports_with_reservations", "opposes", "statement_available", "declined"] as const;
export type PositionStance = (typeof POSITION_STANCES)[number];

export type PositionSource = {
  outlet: string;
  url: string;
  /** Publication date when the page states one; otherwise the date we read it. */
  date: string;
  dateKind: "published" | "accessed";
};

/** "list" is an official party statement; "leader" is the list's head; otherwise a named person. */
export type PositionSpeaker = "list" | "leader" | { he: string; reading: Localized; role: Localized };

export type PositionRecord = {
  id: string;
  partyId: PartyId;
  question: IssueSlug;
  stance: PositionStance;
  speaker: PositionSpeaker;
  summary: Localized;
  sources: PositionSource[];
};

/** A commitment outside the ten questions, or a binding condition a list has set. */
export type OtherCommitment = {
  id: string;
  partyId: PartyId;
  speaker: PositionSpeaker;
  summary: Localized;
  sources: PositionSource[];
};

/** A dated fact that frames a question for every list, such as a government decision. */
export type QuestionContext = {
  id: string;
  question: IssueSlug;
  summary: Localized;
  sources: PositionSource[];
};

export type PositionsDataset = {
  asOf: string;
  /** Lists whose statements were collected, in display order. Others are named as not yet reviewed. */
  tracked: PartyId[];
  records: PositionRecord[];
  other: OtherCommitment[];
  context: QuestionContext[];
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
/** National outlets, research institutes and the parties' own sites; nothing user-generated. */
export const POSITION_SOURCE_HOSTS = [
  "www.ynet.co.il",
  "www.mako.co.il",
  "www.kikar.co.il",
  "www.emess.co.il",
  "www.ice.co.il",
  "www.jpost.com",
  "www.timesofisrael.com",
  "www.kore.co.il",
  "www.france24.com",
  "www.zman.co.il",
  "www.themarker.com",
  "www.idi.org.il",
  "beytenu.org.il",
  "be-yahad.org.il",
  "yes.democrats.org.il",
  "israelfirst.co.il"
] as const;

export function isPositionStance(value: string): value is PositionStance {
  return (POSITION_STANCES as readonly string[]).includes(value);
}

export function isIssueSlug(value: string): value is IssueSlug {
  return (issueSlugs as readonly string[]).includes(value);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Positions dataset invalid: ${message}`);
}

function assertSources(sources: PositionSource[], asOf: string, label: string) {
  assert(sources.length > 0, `no source for ${label}`);
  for (const source of sources) {
    assert(source.outlet.trim().length > 0, `empty outlet for ${label}`);
    const url = new URL(source.url);
    assert(url.protocol === "https:", `non-https source for ${label}`);
    assert((POSITION_SOURCE_HOSTS as readonly string[]).includes(url.hostname), `unlisted source host ${url.hostname} for ${label}`);
    assert(ISO_DATE.test(source.date) && source.date <= asOf, `bad source date for ${label}`);
  }
}

function assertSpeaker(speaker: PositionSpeaker, label: string) {
  if (speaker === "list" || speaker === "leader") return;
  assert(speaker.he.trim().length > 0, `empty speaker for ${label}`);
  assert(speaker.reading.he === speaker.he, `Hebrew speaker gloss drifted for ${label}`);
  assertLocalized(speaker.reading, `speaker reading ${label}`);
  assertLocalized(speaker.role, `speaker role ${label}`);
}

export function assertPositionsDataset(dataset: PositionsDataset): void {
  assert(ISO_DATE.test(dataset.asOf), "bad asOf date");
  const tracked = new Set<string>();
  for (const id of dataset.tracked) {
    assert(isPartyId(id), `unknown tracked party ${id}`);
    assert(!tracked.has(id), `duplicate tracked party ${id}`);
    tracked.add(id);
  }
  const ids = new Set<string>();
  const cells = new Set<string>();
  for (const record of dataset.records) {
    assert(!ids.has(record.id), `duplicate id ${record.id}`);
    ids.add(record.id);
    assert(tracked.has(record.partyId), `record for untracked party ${record.partyId}`);
    assert(isIssueSlug(record.question), `unknown question ${record.question}`);
    assert(isPositionStance(record.stance), `bad stance on ${record.id}`);
    // One cell per list and question keeps the matrix unambiguous.
    const cell = `${record.partyId}/${record.question}`;
    assert(!cells.has(cell), `two records for ${cell}`);
    cells.add(cell);
    assertSpeaker(record.speaker, record.id);
    assertLocalized(record.summary, `summary ${record.id}`);
    assertSources(record.sources, dataset.asOf, record.id);
  }
  for (const item of dataset.other) {
    assert(!ids.has(item.id), `duplicate id ${item.id}`);
    ids.add(item.id);
    assert(tracked.has(item.partyId), `commitment for untracked party ${item.partyId}`);
    assertSpeaker(item.speaker, item.id);
    assertLocalized(item.summary, `summary ${item.id}`);
    assertSources(item.sources, dataset.asOf, item.id);
  }
  for (const item of dataset.context) {
    assert(!ids.has(item.id), `duplicate id ${item.id}`);
    ids.add(item.id);
    assert(isIssueSlug(item.question), `unknown context question ${item.question}`);
    assertLocalized(item.summary, `summary ${item.id}`);
    assertSources(item.sources, dataset.asOf, item.id);
  }
}
