import { dirOf, type Locale } from "../i18n.js";
import { issueHeadings } from "../issue-headings.js";
import { issueSlugs } from "../issues.js";
import { pc, stanceLabel, stanceMark } from "../positions-copy.js";
import { scorecard2026 } from "../data/scorecard-2026.js";
import type { PartyCompliance, PartyId } from "../types/scorecard.js";
import type { IssueSlug, PositionRecord, PositionSource, PositionSpeaker, PositionStance, PositionsDataset } from "../types/positions.js";
import { PoliticalName, formatIsraeliDate } from "./scorecard-ui.js";

const STANCE_ORDER: PositionStance[] = ["supports", "supports_with_reservations", "opposes", "statement_available", "declined"];
const hebrewOrder = new Intl.Collator("he");

export type PositionsView = "question" | "list";

function party(id: PartyId): PartyCompliance {
  const row = scorecard2026.parties.find((candidate) => candidate.partyId === id);
  if (!row) throw new Error(`Unknown party ${id}`);
  return row;
}

/** Hebrew alphabetical order: the neutral order for lists, independent of bloc or polling. */
export function trackedParties(dataset: PositionsDataset): PartyCompliance[] {
  return dataset.tracked.map(party).sort((a, b) => hebrewOrder.compare(a.partyNameHe, b.partyNameHe));
}

export function issueHeading(locale: Locale, slug: IssueSlug): string {
  return issueHeadings[locale][issueSlugs.indexOf(slug)]!;
}

function questionNumber(slug: IssueSlug): string {
  return String(issueSlugs.indexOf(slug) + 1).padStart(2, "0");
}

export function recordsFor(dataset: PositionsDataset, slug: IssueSlug): PositionRecord[] {
  return dataset.records.filter((record) => record.question === slug);
}

function sortedRecords(records: PositionRecord[]): PositionRecord[] {
  return records.slice().sort((a, b) =>
    STANCE_ORDER.indexOf(a.stance) - STANCE_ORDER.indexOf(b.stance) || hebrewOrder.compare(party(a.partyId).partyNameHe, party(b.partyId).partyNameHe));
}

/** Count of tracked lists with a statement on a question, for the index cards. A refusal is not one. */
export function onRecordCount(dataset: PositionsDataset, slug: IssueSlug): number {
  return new Set(recordsFor(dataset, slug).filter((record) => record.stance !== "declined").map((record) => record.partyId)).size;
}

/** Deep link that opens one list's section on the positions page, server-side, without scripting. */
export function listHref(locale: Locale, partyId: PartyId): string {
  return `/${locale}/positions?view=list&list=${partyId}#list-${partyId}`;
}

function stanceClass(stance: PositionStance | "none") {
  return `stance stance-${stance.replace(/_/g, "-")}`;
}

export function StanceBadge({ locale, stance }: { locale: Locale; stance: PositionStance | "none" }) {
  return <span class={stanceClass(stance)}>
    <span class="stance-mark" aria-hidden="true">{stanceMark(stance)}</span>
    <span class="stance-label">{stanceLabel(locale, stance)}</span>
  </span>;
}

function Dated({ iso }: { iso: string }) {
  return <bdi dir="ltr">{formatIsraeliDate(iso)}</bdi>;
}

function SpeakerLine({ locale, speaker, row }: { locale: Locale; speaker: PositionSpeaker; row: PartyCompliance }) {
  if (speaker === "list") return <span class="position-speaker">{pc(locale, "partyStatement")}</span>;
  if (speaker === "leader") return <span class="position-speaker"><PoliticalName locale={locale} officialHe={row.leaderHe} reading={row.leaderName} /></span>;
  return <span class="position-speaker">
    <PoliticalName locale={locale} officialHe={speaker.he} reading={speaker.reading} />
    <span class="position-role">{speaker.role[locale]}</span>
  </span>;
}

function Sources({ locale, sources }: { locale: Locale; sources: PositionSource[] }) {
  return <p class="position-sources">
    <span class="position-sources-label">{pc(locale, "source")}:</span>{" "}
    {sources.map((source, index) => <>
      {index > 0 ? " · " : null}
      <a href={source.url} rel="noopener noreferrer external" target="_blank"><bdi dir="ltr">{source.outlet}</bdi></a>
      {" "}<span class="position-date">({pc(locale, source.dateKind === "published" ? "published" : "accessed")} <Dated iso={source.date} />)</span>
    </>)}
  </p>;
}

function Summary({ locale, text }: { locale: Locale; text: string }) {
  return <p class="position-summary" lang={locale} dir={dirOf(locale)}>{text}</p>;
}

function ContextNotes({ locale, dataset, slug }: { locale: Locale; dataset: PositionsDataset; slug: IssueSlug }) {
  return <>{dataset.context.filter((item) => item.question === slug).map((item) => <div class="positions-context">
    <h3>{pc(locale, "context")}</h3>
    <Summary locale={locale} text={item.summary[locale]} />
    <Sources locale={locale} sources={item.sources} />
  </div>)}</>;
}

/** One list's statement on one question. `heading` picks what the card is titled by: the list or the question. */
function PositionEntry({ locale, record, heading, id }: { locale: Locale; record: PositionRecord; heading: "party" | "question"; id?: string }) {
  const row = party(record.partyId);
  return <li class="position-item" id={id}>
    <div class="position-head">
      {heading === "party"
        ? <PoliticalName locale={locale} officialHe={row.partyNameHe} reading={row.partyName} emphasis />
        : <h4 class="position-question"><a href={`/${locale}/issues/${record.question}#pos-${record.partyId}`}><bdi dir="ltr">{questionNumber(record.question)}</bdi> {issueHeading(locale, record.question)}</a></h4>}
      <StanceBadge locale={locale} stance={record.stance} />
    </div>
    <SpeakerLine locale={locale} speaker={record.speaker} row={row} />
    <Summary locale={locale} text={record.summary[locale]} />
    <Sources locale={locale} sources={record.sources} />
  </li>;
}

function QuietLists({ locale, rows }: { locale: Locale; rows: PartyCompliance[]; }) {
  if (!rows.length) return null;
  return <div class="positions-quiet">
    <h3>{pc(locale, "noneFound")}</h3>
    <ul>{rows.map((row) => <li id={`pos-${row.partyId}`}><a href={listHref(locale, row.partyId)}><PoliticalName locale={locale} officialHe={row.partyNameHe} reading={row.partyName} /></a></li>)}</ul>
  </div>;
}

/** The section under each question page: background facts, then each list's statement. */
export function IssuePositions({ locale, slug, dataset }: { locale: Locale; slug: IssueSlug; dataset: PositionsDataset }) {
  const records = sortedRecords(recordsFor(dataset, slug));
  const quiet = trackedParties(dataset).filter((row) => !records.some((record) => record.partyId === row.partyId));
  return <section class="positions" id="positions" aria-labelledby="positions-title">
    <header class="positions-header">
      <h2 id="positions-title">{pc(locale, "sectionTitle")}</h2>
      <p class="positions-asof">{pc(locale, "asOf")} <Dated iso={dataset.asOf} /></p>
    </header>
    <ContextNotes locale={locale} dataset={dataset} slug={slug} />
    {records.length ? <ol class="position-list">
      {records.map((record) => <PositionEntry locale={locale} record={record} heading="party" id={`pos-${record.partyId}`} />)}
    </ol> : null}
    <QuietLists locale={locale} rows={quiet} />
    <p class="positions-note">{pc(locale, "notReviewed")} {pc(locale, "notScored")}</p>
    <p><a href={`/${locale}/positions`}>{pc(locale, "allPositions")}</a></p>
  </section>;
}

/**
 * The prominent way in. Full on the main page, where it is the next thing to do after the intro;
 * compact on the scorecard, where it must not push the scorecard's own matrix out of view.
 */
export function PositionsCta({ locale, dataset, compact = false }: { locale: Locale; dataset: PositionsDataset; compact?: boolean }) {
  const body = pc(locale, "ctaBody").replace("{statements}", String(dataset.records.filter((record) => record.stance !== "declined").length)).replace("{lists}", String(dataset.tracked.length));
  return <aside class={compact ? "positions-cta positions-cta-compact" : "positions-cta"} aria-labelledby="positions-cta-title">
    <div class="positions-cta-text">
      <p class="positions-cta-eyebrow">{pc(locale, "ctaEyebrow")} · {pc(locale, "asOf")} <Dated iso={dataset.asOf} /></p>
      <h2 id="positions-cta-title">{pc(locale, "ctaTitle")}</h2>
      {compact ? null : <p class="positions-cta-body">{body}</p>}
      {compact ? null : <MarkStrip locale={locale} records={dataset.records} />}
    </div>
    <a class="positions-cta-button" href={`/${locale}/positions`}>{pc(locale, "ctaButton")}</a>
  </aside>;
}

/** On an index card: how many lists are on record for this question, drawn as their marks, as one link. */
export function IssueCardPositions({ locale, dataset, slug }: { locale: Locale; dataset: PositionsDataset; slug: IssueSlug }) {
  const records = sortedRecords(recordsFor(dataset, slug));
  return <p class="issue-onrecord"><a href={`/${locale}/positions?q=${slug}#q-${slug}`}>
    <span class="issue-onrecord-count"><bdi dir="ltr">{onRecordCount(dataset, slug)}/{dataset.tracked.length}</bdi> {pc(locale, "onRecord")}</span>
    {records.length ? <MiniMarks marks={records.map((record) => ({ key: record.id, stance: record.stance }))} /> : null}
  </a></p>;
}

/** Near the top of a question page: tells the reader the list positions exist further down, and takes them there. */
export function IssueJump({ locale, dataset, slug }: { locale: Locale; dataset: PositionsDataset; slug: IssueSlug }) {
  const records = sortedRecords(recordsFor(dataset, slug));
  return <a class="positions-jump" href="#positions">
    <span class="positions-jump-label">{pc(locale, "jumpToPositions")}</span>
    <span class="positions-jump-arrow" aria-hidden="true">↓</span>
    <span class="positions-jump-meta">
      <span class="positions-jump-count"><bdi dir="ltr">{onRecordCount(dataset, slug)}/{dataset.tracked.length}</bdi> {pc(locale, "onRecord")}</span>
      {records.length ? <MiniMarks marks={records.map((record) => ({ key: record.id, stance: record.stance }))} /> : null}
    </span>
  </a>;
}

/** A decorative tally of every mark on the page, by stance. The text beside the button carries the meaning. */
function MarkStrip({ records }: { locale: Locale; records: PositionRecord[] }) {
  const sorted = STANCE_ORDER.flatMap((stance) => records.filter((record) => record.stance === stance));
  return <p class="positions-cta-strip" aria-hidden="true">{sorted.map((record) => <span class={stanceClass(record.stance)}><span class="stance-mark">{stanceMark(record.stance)}</span></span>)}</p>;
}

/** Two server-rendered views. Switching reloads at the top of the page instead of jumping to an anchor. */
export function ViewSwitch({ locale, view }: { locale: Locale; view: PositionsView }) {
  return <nav class="positions-switch" aria-label={pc(locale, "viewLabel")}>
    <a href={`/${locale}/positions`} aria-current={view === "question" ? "page" : undefined}>{pc(locale, "byQuestion")}</a>
    <a href={`/${locale}/positions?view=list`} aria-current={view === "list" ? "page" : undefined}>{pc(locale, "byList")}</a>
  </nav>;
}

/** The marks as a compact row of chips, so the key costs two lines on a phone rather than a screen. */
export function StanceLegend({ locale }: { locale: Locale }) {
  const all: Array<PositionStance | "none"> = [...STANCE_ORDER, "none"];
  return <div class="positions-legend">
    <h2 class="sr-only">{pc(locale, "legendTitle")}</h2>
    <ul>{all.map((stance) => <li><StanceBadge locale={locale} stance={stance} /></li>)}</ul>
  </div>;
}

/** Lists down the side, the ten questions across. Desktop only: a phone reads the same data in the views below. */
export function PositionsMatrix({ locale, dataset }: { locale: Locale; dataset: PositionsDataset }) {
  const rows = trackedParties(dataset);
  return <div class="positions-table-wrap" role="region" aria-labelledby="positions-matrix-caption" tabindex={0}>
    <table class="positions-table">
      <caption id="positions-matrix-caption">{pc(locale, "matrixCaption")}</caption>
      <thead><tr>
        <th scope="col">{pc(locale, "list")}</th>
        {issueSlugs.map((slug) => <th scope="col">
          <a href={`/${locale}/positions?q=${slug}#q-${slug}`} title={issueHeading(locale, slug)}>
            <bdi dir="ltr" aria-hidden="true">{questionNumber(slug)}</bdi>
            <span class="sr-only">{issueHeading(locale, slug)}</span>
          </a>
        </th>)}
      </tr></thead>
      <tbody>{rows.map((row) => <tr>
        <th scope="row"><a class="positions-row-link" href={listHref(locale, row.partyId)}><PoliticalName locale={locale} officialHe={row.partyNameHe} reading={row.partyName} emphasis /></a></th>
        {issueSlugs.map((slug) => {
          const record = dataset.records.find((item) => item.partyId === row.partyId && item.question === slug);
          const stance = record?.stance ?? "none";
          const label = `${issueHeading(locale, slug)}: ${stanceLabel(locale, stance)}`;
          return <td>
            {record
              ? <a class={`${stanceClass(stance)} stance-cell`} href={`/${locale}/positions?q=${slug}#q-${slug}`} aria-label={label} title={label}>
                  <span aria-hidden="true">{stanceMark(stance)}</span>
                </a>
              : <span class={`${stanceClass(stance)} stance-cell`} role="img" aria-label={label}><span aria-hidden="true">{stanceMark(stance)}</span></span>}
          </td>;
        })}
      </tr>)}</tbody>
    </table>
  </div>;
}

function MiniMarks({ marks }: { marks: Array<{ key: string; stance: PositionStance | "none"; label?: string }> }) {
  return <span class="positions-mini" aria-hidden="true">{marks.map((mark) => <span class={stanceClass(mark.stance)}>
    <span class="stance-mark">{stanceMark(mark.stance)}</span>
    {mark.label ? <bdi class="positions-mini-label" dir="ltr">{mark.label}</bdi> : null}
  </span>)}</span>;
}

/** Each question folds open in place with every list's statement; nothing navigates away. */
export function PositionsByQuestion({ locale, dataset, open }: { locale: Locale; dataset: PositionsDataset; open?: IssueSlug }) {
  const tracked = trackedParties(dataset);
  return <ol class="positions-fold-list">
    {issueSlugs.map((slug) => {
      const records = sortedRecords(recordsFor(dataset, slug));
      const quiet = tracked.filter((row) => !records.some((record) => record.partyId === row.partyId));
      return <li id={`q-${slug}`}>
        <details class="positions-fold" open={open === slug}>
          <summary>
            <span class="positions-fold-number"><bdi dir="ltr">{questionNumber(slug)}</bdi></span>
            <span class="positions-fold-title">{issueHeading(locale, slug)}</span>
            <span class="positions-fold-meta">
              <bdi dir="ltr">{onRecordCount(dataset, slug)}/{dataset.tracked.length}</bdi> {pc(locale, "onRecord")}
              <MiniMarks marks={records.map((record) => ({ key: record.id, stance: record.stance }))} />
            </span>
          </summary>
          <div class="positions-fold-body">
            <ContextNotes locale={locale} dataset={dataset} slug={slug} />
            {records.length ? <ol class="position-list">
              {records.map((record) => <PositionEntry locale={locale} record={record} heading="party" />)}
            </ol> : null}
            <QuietLists locale={locale} rows={quiet} />
            <p class="positions-fold-more"><a href={`/${locale}/issues/${slug}`}>{pc(locale, "openQuestion")}</a></p>
          </div>
        </details>
      </li>;
    })}
  </ol>;
}

/** Each list folds open in place with its statements across the ten questions and its other commitments. */
export function PositionsByList({ locale, dataset, open }: { locale: Locale; dataset: PositionsDataset; open?: PartyId }) {
  return <ol class="positions-fold-list">
    {trackedParties(dataset).map((row) => {
      const records = issueSlugs.flatMap((slug) => dataset.records.filter((record) => record.partyId === row.partyId && record.question === slug));
      const other = dataset.other.filter((item) => item.partyId === row.partyId);
      const silent = issueSlugs.filter((slug) => !records.some((record) => record.question === slug));
      return <li id={`list-${row.partyId}`}>
        <details class="positions-fold" open={open === row.partyId}>
          <summary>
            <span class="positions-fold-title"><PoliticalName locale={locale} officialHe={row.partyNameHe} reading={row.partyName} emphasis /></span>
            <span class="positions-fold-meta">
              <PoliticalName locale={locale} officialHe={row.leaderHe} reading={row.leaderName} />
              <MiniMarks marks={issueSlugs.map((slug) => ({ key: slug, stance: records.find((record) => record.question === slug)?.stance ?? "none", label: String(issueSlugs.indexOf(slug) + 1) }))} />
            </span>
          </summary>
          <div class="positions-fold-body">
            {records.length ? <ol class="position-list">
              {records.map((record) => <PositionEntry locale={locale} record={record} heading="question" />)}
            </ol> : null}
            {silent.length ? <p class="positions-silent">{pc(locale, "noStatementOn")}: {silent.map((slug, index) => <>
              {index > 0 ? ", " : null}<a href={`/${locale}/issues/${slug}`} title={issueHeading(locale, slug)}><bdi dir="ltr">{questionNumber(slug)}</bdi></a>
            </>)}</p> : null}
            {other.length ? <div class="positions-other-card">
              <h3>{pc(locale, "otherTitle")}</h3>
              <ul>{other.map((item) => <li>
                <Summary locale={locale} text={item.summary[locale]} />
                <SpeakerLine locale={locale} speaker={item.speaker} row={row} />
                <Sources locale={locale} sources={item.sources} />
              </li>)}</ul>
            </div> : null}
          </div>
        </details>
      </li>;
    })}
  </ol>;
}
