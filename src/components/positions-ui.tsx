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

export function recordsFor(dataset: PositionsDataset, slug: IssueSlug): PositionRecord[] {
  return dataset.records.filter((record) => record.question === slug);
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

/** The section under each question page: background facts, then each list's statement. */
export function IssuePositions({ locale, slug, dataset }: { locale: Locale; slug: IssueSlug; dataset: PositionsDataset }) {
  const records = recordsFor(dataset, slug).slice().sort((a, b) =>
    STANCE_ORDER.indexOf(a.stance) - STANCE_ORDER.indexOf(b.stance) || hebrewOrder.compare(party(a.partyId).partyNameHe, party(b.partyId).partyNameHe));
  const context = dataset.context.filter((item) => item.question === slug);
  const quiet = trackedParties(dataset).filter((row) => !records.some((record) => record.partyId === row.partyId));
  return <section class="positions" id="positions" aria-labelledby="positions-title">
    <header class="positions-header">
      <h2 id="positions-title">{pc(locale, "sectionTitle")}</h2>
      <p class="positions-asof">{pc(locale, "asOf")} <Dated iso={dataset.asOf} /></p>
    </header>
    {context.map((item) => <div class="positions-context">
      <h3>{pc(locale, "context")}</h3>
      <Summary locale={locale} text={item.summary[locale]} />
      <Sources locale={locale} sources={item.sources} />
    </div>)}
    {records.length ? <ol class="position-list">
      {records.map((record) => {
        const row = party(record.partyId);
        return <li class="position-item" id={`pos-${record.partyId}`}>
          <div class="position-head">
            <PoliticalName locale={locale} officialHe={row.partyNameHe} reading={row.partyName} emphasis />
            <StanceBadge locale={locale} stance={record.stance} />
          </div>
          <SpeakerLine locale={locale} speaker={record.speaker} row={row} />
          <Summary locale={locale} text={record.summary[locale]} />
          <Sources locale={locale} sources={record.sources} />
        </li>;
      })}
    </ol> : null}
    {quiet.length ? <div class="positions-quiet">
      <h3>{pc(locale, "noneFound")}</h3>
      <ul>{quiet.map((row) => <li id={`pos-${row.partyId}`}><PoliticalName locale={locale} officialHe={row.partyNameHe} reading={row.partyName} /></li>)}</ul>
    </div> : null}
    <p class="positions-note">{pc(locale, "notReviewed")} {pc(locale, "notScored")}</p>
    <p><a href={`/${locale}/positions`}>{pc(locale, "allPositions")}</a></p>
  </section>;
}

export function StanceLegend({ locale }: { locale: Locale }) {
  const all: Array<PositionStance | "none"> = [...STANCE_ORDER, "none"];
  return <div class="positions-legend">
    <h2>{pc(locale, "legendTitle")}</h2>
    <ul>{all.map((stance) => <li><StanceBadge locale={locale} stance={stance} /></li>)}</ul>
  </div>;
}

export function QuestionKey({ locale }: { locale: Locale }) {
  return <div class="positions-key">
    <h2>{pc(locale, "questionsKey")}</h2>
    <ol>{issueSlugs.map((slug) => <li><a href={`/${locale}/issues/${slug}#positions`}>{issueHeading(locale, slug)}</a></li>)}</ol>
  </div>;
}

/** Lists down the side, the ten questions across; each mark opens that statement on its question page. */
export function PositionsMatrix({ locale, dataset }: { locale: Locale; dataset: PositionsDataset }) {
  const rows = trackedParties(dataset);
  return <>
    <p class="positions-scroll-hint">{pc(locale, "scrollHint")}</p>
    <div class="positions-table-wrap" role="region" aria-labelledby="positions-matrix-caption" tabindex={0}>
      <table class="positions-table">
        <caption id="positions-matrix-caption">{pc(locale, "matrixCaption")}</caption>
        <thead><tr>
          <th scope="col">{pc(locale, "list")}</th>
          {issueSlugs.map((slug, index) => <th scope="col">
            <a href={`/${locale}/issues/${slug}#positions`}>
              <bdi dir="ltr" aria-hidden="true">{String(index + 1).padStart(2, "0")}</bdi>
              <span class="sr-only">{issueHeading(locale, slug)}</span>
            </a>
          </th>)}
        </tr></thead>
        <tbody>{rows.map((row) => <tr>
          <th scope="row"><PoliticalName locale={locale} officialHe={row.partyNameHe} reading={row.partyName} emphasis /></th>
          {issueSlugs.map((slug) => {
            const record = dataset.records.find((item) => item.partyId === row.partyId && item.question === slug);
            const stance = record?.stance ?? "none";
            const label = `${issueHeading(locale, slug)}: ${stanceLabel(locale, stance)}`;
            return <td>
              {record
                ? <a class={`${stanceClass(stance)} stance-cell`} href={`/${locale}/issues/${slug}#pos-${row.partyId}`} aria-label={label}>
                    <span aria-hidden="true">{stanceMark(stance)}</span>
                  </a>
                : <span class={`${stanceClass(stance)} stance-cell`} role="img" aria-label={label}><span aria-hidden="true">{stanceMark(stance)}</span></span>}
            </td>;
          })}
        </tr>)}</tbody>
      </table>
    </div>
  </>;
}

/** Commitments outside the ten questions, grouped by list. */
export function OtherCommitments({ locale, dataset }: { locale: Locale; dataset: PositionsDataset }) {
  const rows = trackedParties(dataset).filter((row) => dataset.other.some((item) => item.partyId === row.partyId));
  return <section class="positions-other" aria-labelledby="positions-other-title">
    <h2 id="positions-other-title">{pc(locale, "otherTitle")}</h2>
    <p class="lede">{pc(locale, "otherLede")}</p>
    <div class="positions-other-grid">
      {rows.map((row) => <article class="positions-other-card" id={`other-${row.partyId}`}>
        <h3><PoliticalName locale={locale} officialHe={row.partyNameHe} reading={row.partyName} emphasis /></h3>
        <ul>{dataset.other.filter((item) => item.partyId === row.partyId).map((item) => <li>
          <Summary locale={locale} text={item.summary[locale]} />
          <SpeakerLine locale={locale} speaker={item.speaker} row={row} />
          <Sources locale={locale} sources={item.sources} />
        </li>)}</ul>
      </article>)}
    </div>
  </section>;
}

/** Count of tracked lists with a statement on a question, for the index cards. A refusal is not one. */
export function onRecordCount(dataset: PositionsDataset, slug: IssueSlug): number {
  return new Set(recordsFor(dataset, slug).filter((record) => record.stance !== "declined").map((record) => record.partyId)).size;
}
