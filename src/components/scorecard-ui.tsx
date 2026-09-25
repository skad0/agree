import type { Child } from "hono/jsx";
import { ShareOptions } from "./share-options.js";
import { Callout } from "./public-ui.js";
import { sc, statusLabel, blockLabel, type ScorecardKey } from "../scorecard-copy.js";
import { dirOf, type Locale } from "../i18n.js";
import type {
  ComplianceStatus,
  Criterion,
  CriterionId,
  EvidenceRecord,
  EvidenceType,
  PartyBlock,
  PartyCompliance,
  ScorecardDataset
} from "../types/scorecard.js";
import { complianceMetrics, isComplianceStatus, isCriterionId, isPartyBlock, isPartyId } from "../types/scorecard.js";
import { normalizeHebrew } from "../integrations/elections/normalize-hebrew.js";
import { s } from "../share-copy.js";

export const SCORECARD_SEGMENTS = ["all", "incumbent", "challenger", "high"] as const;
export type ScorecardSegment = (typeof SCORECARD_SEGMENTS)[number];
export const SCORECARD_SORTS = ["group", "compliance", "alpha"] as const;
export type ScorecardSort = (typeof SCORECARD_SORTS)[number];

export type ScorecardFilters = {
  q: string;
  block?: PartyBlock;
  criterion?: CriterionId;
  status?: ComplianceStatus;
  segment: ScorecardSegment;
  sort: ScorecardSort;
  party?: string;
  evidenceCriterion?: CriterionId;
};

function isSegment(value: string): value is ScorecardSegment {
  return (SCORECARD_SEGMENTS as readonly string[]).includes(value);
}

function isSort(value: string): value is ScorecardSort {
  return (SCORECARD_SORTS as readonly string[]).includes(value);
}

export function parseScorecardFilters(query: {
  q?: string;
  block?: string;
  criterion?: string;
  status?: string;
  segment?: string;
  sort?: string;
  party?: string;
  evidence?: string;
}): { filters: ScorecardFilters; reset: boolean } {
  const q = (query.q ?? "").slice(0, 100).trim();
  const blockRaw = query.block ?? "";
  const criterionRaw = query.criterion ?? "";
  const statusRaw = query.status ?? "";
  const partyRaw = (query.party ?? "").slice(0, 64).trim();
  const evidenceRaw = query.evidence ?? "";
  const segmentRaw = query.segment ?? "";
  const sortRaw = query.sort ?? "";
  let reset = false;
  let segment: ScorecardSegment = "all";
  let sort: ScorecardSort = "group";
  if (segmentRaw) {
    if (isSegment(segmentRaw)) segment = segmentRaw;
    else reset = true;
  }
  if (sortRaw) {
    if (isSort(sortRaw)) sort = sortRaw;
    else reset = true;
  }
  let block: PartyBlock | undefined;
  let criterion: CriterionId | undefined;
  let status: ComplianceStatus | undefined;
  let evidenceCriterion: CriterionId | undefined;
  if (blockRaw) {
    if (isPartyBlock(blockRaw)) block = blockRaw;
    else reset = true;
  }
  if (criterionRaw) {
    if (isCriterionId(criterionRaw)) criterion = criterionRaw;
    else reset = true;
  }
  if (statusRaw) {
    if (isComplianceStatus(statusRaw)) status = statusRaw;
    else reset = true;
  }
  if (evidenceRaw) {
    if (isCriterionId(evidenceRaw)) evidenceCriterion = evidenceRaw;
    else reset = true;
  }
  if (partyRaw && !isPartyId(partyRaw) && partyRaw.length > 0) reset = true;
  return {
    filters: {
      q,
      block,
      criterion,
      status,
      segment,
      sort,
      party: partyRaw && isPartyId(partyRaw) ? partyRaw : partyRaw || undefined,
      evidenceCriterion
    },
    reset
  };
}

export function filterParties(dataset: ScorecardDataset, filters: ScorecardFilters): PartyCompliance[] {
  const terms = normalizeHebrew(filters.q).split(/\s+/).filter(Boolean);
  return dataset.parties.filter((party) => {
    if (filters.block && party.block !== filters.block) return false;
    if (filters.segment === "incumbent" && party.parliamentaryStatus !== "INCUMBENT") return false;
    if (filters.segment === "challenger" && party.parliamentaryStatus !== "CHALLENGER") return false;
    if (filters.segment === "high" && complianceMetrics(party).passedCount < 3) return false;
    if (filters.criterion && filters.status && party.scores[filters.criterion] !== filters.status) return false;
    if (filters.criterion && !filters.status) {
      /* criterion alone still shows all parties; matrix highlights that column */
    }
    if (filters.status && !filters.criterion) {
      const hit = Object.values(party.scores).some((value) => value === filters.status);
      if (!hit) return false;
    }
    if (!terms.length) return true;
    const haystack = normalizeHebrew(`${party.partyNameHe} ${party.leaderHe} ${party.searchAliasesHe ?? ""} ${party.ballotNoteHe ?? ""} ${party.partyId}`);
    return terms.every((term) => haystack.includes(term));
  }).sort((a, b) => compareParties(a, b, filters.sort));
}

function compareParties(a: PartyCompliance, b: PartyCompliance, sort: ScorecardSort): number {
  const byName = () => a.partyNameHe.localeCompare(b.partyNameHe, "he");
  const byScore = () => {
    const delta = complianceMetrics(b).passedCount - complianceMetrics(a).passedCount;
    return delta !== 0 ? delta : byName();
  };
  switch (sort) {
    case "alpha":
      return byName();
    case "compliance":
      return byScore();
    case "group": {
      if (a.parliamentaryStatus !== b.parliamentaryStatus) {
        return a.parliamentaryStatus === "INCUMBENT" ? -1 : 1;
      }
      return byScore();
    }
    default: {
      const _exhaustive: never = sort;
      return _exhaustive;
    }
  }
}

export function scorecardQuery(filters: ScorecardFilters, extras: Record<string, string | undefined> = {}): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.block) params.set("block", filters.block);
  if (filters.criterion) params.set("criterion", filters.criterion);
  if (filters.status) params.set("status", filters.status);
  if (filters.segment !== "all") params.set("segment", filters.segment);
  if (filters.sort !== "group") params.set("sort", filters.sort);
  const party = extras.party ?? filters.party;
  const evidence = extras.evidence ?? filters.evidenceCriterion;
  if (party) params.set("party", party);
  if (evidence) params.set("evidence", evidence);
  for (const [key, value] of Object.entries(extras)) {
    if (key === "party" || key === "evidence") continue;
    if (value) params.set(key, value);
  }
  return params.toString();
}

function categoryKey(category: Criterion["category"]): ScorecardKey {
  switch (category) {
    case "fiscal":
      return "categoryFiscal";
    case "constitutional":
      return "categoryConstitutional";
    case "civic":
      return "categoryCivic";
    default: {
      const _exhaustive: never = category;
      return _exhaustive;
    }
  }
}

export function StatusBadge({
  locale,
  status,
  href,
  criterionTitle,
  preview
}: {
  locale: Locale;
  status: ComplianceStatus;
  href: string;
  criterionTitle: string;
  preview: string;
}) {
  const label = statusLabel(locale, status);
  const tip = `${preview} — ${sc(locale, "previewMore")}`;
  return (
    <a
      class={`score-badge score-${status.toLowerCase()}`}
      href={href}
      title={tip}
      aria-label={`${criterionTitle}: ${label}. ${tip}`}
    >
      <span class="score-badge-mark" aria-hidden="true">{statusMark(status)}</span>
      <span class="score-badge-label">{label}</span>
      <span class="score-tip">{tip}</span>
    </a>
  );
}

function ComplianceGauge({ locale, party }: { locale: Locale; party: PartyCompliance }) {
  const metrics = complianceMetrics(party);
  const width = Math.round((metrics.passedCount / metrics.totalCriteria) * 72);
  const label = `${metrics.passedCount}/${metrics.totalCriteria}`;
  return (
    <span class="score-gauge" title={`${label} · ${metrics.compliancePercentage}%`}>
      <svg width="72" height="8" viewBox="0 0 72 8" aria-hidden="true">
        <rect class="score-gauge-track" x="0" y="0" width="72" height="8" rx="2" />
        <rect class="score-gauge-fill" x="0" y="0" width={String(width)} height="8" rx="2" />
      </svg>
      <span class="score-gauge-fraction">
        <bdi dir="ltr">{label}</bdi>
      </span>
      <span class="sr-only">{sc(locale, "sortCompliance")}: {metrics.compliancePercentage}%</span>
    </span>
  );
}

function statusMark(status: ComplianceStatus): string {
  switch (status) {
    case "PASS":
      return "✓";
    case "FAIL":
      return "✕";
    case "PARTIAL":
      return "◐";
    case "UNCOMMITTED":
      return "–";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function PledgeBanner({ locale, shareUrl }: { locale: Locale; shareUrl: string }) {
  const pledge = sc(locale, "pledge");
  const email = "desk@rafmeshutaf.org.il";
  const parts = pledge.split(email);
  return (
    <aside class="scorecard-pledge callout callout-caution" role="note">
      <p>
        {parts[0]}
        <bdi class="scorecard-desk" dir="ltr">{email}</bdi>
        {parts[1] ?? ""}
      </p>
      <p class="scorecard-methodology">{sc(locale, "methodologyNote")}</p>
      <ShareOptions
        locale={locale}
        id="scorecard"
        title={sc(locale, "title")}
        text={sc(locale, "shareText")}
        url={shareUrl}
      />
      <p class="sr-only">{sc(locale, "shareScorecard")}</p>
    </aside>
  );
}

function evidenceTypeLabel(locale: Locale, type: EvidenceType): string {
  switch (type) {
    case "KNESSET_PLENUM_VOTE":
      return sc(locale, "evidenceKind");
    case "COALITION_AGREEMENT":
      return sc(locale, "evidenceKind");
    case "BAGATZ_RULING":
      return sc(locale, "evidenceKind");
    case "OFFICIAL_BILL":
      return sc(locale, "evidenceKind");
    case "OFFICIAL_PLATFORM":
      return sc(locale, "evidenceKind");
    case "SIGNED_PLEDGE":
      return sc(locale, "evidenceKind");
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

function fillShare(template: string, party: string, passed: number, total: number): string {
  return template.replaceAll("{party}", party).replaceAll("{passed}", String(passed)).replaceAll("{total}", String(total));
}

export function EvidenceDrawer({
  locale,
  party,
  criterion,
  records,
  closeHref,
  pageUrl
}: {
  locale: Locale;
  party: PartyCompliance;
  criterion: Criterion;
  records: EvidenceRecord[];
  closeHref: string;
  pageUrl: string;
}) {
  const status = party.scores[criterion.id];
  const metrics = complianceMetrics(party);
  const template = party.parliamentaryStatus === "CHALLENGER" ? sc(locale, "sharePartyPlatform") : sc(locale, "sharePartyVote");
  const sentence = `${fillShare(template, party.partyNameHe, metrics.passedCount, metrics.totalCriteria)} ${pageUrl}`;
  const whatsapp = `https://wa.me/?${new URLSearchParams({ text: sentence })}`;
  const xShare = `https://x.com/intent/post?${new URLSearchParams({ text: sentence })}`;
  return (
    <section class="scorecard-evidence" id={`evidence-${party.partyId}-${criterion.id}`} tabIndex={-1}>
      <div class="scorecard-evidence-header">
        <h2>{sc(locale, "evidenceHeading")}</h2>
        <a class="scorecard-evidence-close" href={closeHref}>{sc(locale, "closeEvidence")}</a>
      </div>
      <p class="scorecard-evidence-party">
        <strong lang="he" dir="rtl">{party.partyNameHe}</strong>
        {" · "}
        <span lang="he" dir="rtl">{party.leaderHe}</span>
        {" · "}
        <span lang={locale} dir={dirOf(locale)}>{criterion.title[locale]}</span>
        {" · "}
        {statusLabel(locale, status)}
      </p>
      <div class="scorecard-basis" lang={locale} dir={dirOf(locale)}>
        <h3>{sc(locale, "statusBasis")}</h3>
        <p>{party.basis[criterion.id][locale]}</p>
      </div>
      {party.rosterUrl ? (
        <p><a href={party.rosterUrl} rel="noreferrer">{sc(locale, "evidenceLink")}</a></p>
      ) : null}
      <div class="scorecard-share">
        <h3>{sc(locale, "shareCivicId")}</h3>
        <p lang={locale} dir={dirOf(locale)}>{sentence}</p>
        <p class="scorecard-share-actions">
          <a class="primary-action" href={whatsapp} rel="noreferrer">WhatsApp</a>
          <a href={xShare} rel="noreferrer">X</a>
        </p>
      </div>
      {!records.length ? <p role="status">{sc(locale, "noEvidence")}</p> : null}
      <ol class="scorecard-evidence-list">
        {records.map((record) => (
          <li key={record.id} class="scorecard-evidence-item">
            <p class="scorecard-trust"><span class="badge on">{sc(locale, "trustBadge")}</span> <span class="scorecard-evidence-kind">{evidenceTypeLabel(locale, record.type)}</span></p>
            <dl class="scorecard-evidence-fields">
              <dt>{sc(locale, "evidenceDate")}</dt>
              <dd><time dateTime={record.date}><bdi dir="ltr">{formatIsraeliDate(record.date)}</bdi></time></dd>
              <dt>{sc(locale, "evidenceReference")}</dt>
              <dd lang={locale} dir={dirOf(locale)}>{record.referenceNumber[locale]}</dd>
              <dt>{sc(locale, "evidenceSummary")}</dt>
              <dd lang={locale} dir={dirOf(locale)}>{record.summary[locale]}</dd>
            </dl>
            <p>
              <a class="primary-action scorecard-source-link" href={record.officialSourceUrl} rel="noreferrer">
                {sc(locale, "evidenceLink")}
              </a>
            </p>
          </li>
        ))}
      </ol>
      {party.officialResponse ? (
        <Callout tone="blue">
          <p><strong>{sc(locale, "officialReply")}</strong></p>
          <p lang={locale} dir={dirOf(locale)}>{party.officialResponse.text[locale]}</p>
          <p><time dateTime={party.officialResponse.receivedAt}>{party.officialResponse.receivedAt.slice(0, 10)}</time></p>
        </Callout>
      ) : null}
    </section>
  );
}

export function ScorecardFiltersForm({
  locale,
  path,
  dataset,
  filters
}: {
  locale: Locale;
  path: string;
  dataset: ScorecardDataset;
  filters: ScorecardFilters;
}) {
  const segmentHref = (segment: ScorecardSegment) => {
    const query = scorecardQuery({ ...filters, segment, party: undefined, evidenceCriterion: undefined });
    return query ? `${path}?${query}` : path;
  };
  const sortHref = (sort: ScorecardSort) => {
    const query = scorecardQuery({ ...filters, sort, party: undefined, evidenceCriterion: undefined });
    return query ? `${path}?${query}` : path;
  };
  return (
    <>
    <nav class="scorecard-segments" aria-label={sc(locale, "filters")}>
      {SCORECARD_SEGMENTS.map((segment) => (
        <a href={segmentHref(segment)} aria-current={filters.segment === segment ? "true" : undefined}>{segmentLabel(locale, segment)}</a>
      ))}
    </nav>
    <nav class="scorecard-sort" aria-label={sc(locale, "sortBy")}>
      <span>{sc(locale, "sortBy")}</span>
      {SCORECARD_SORTS.map((sort) => (
        <a href={sortHref(sort)} aria-current={filters.sort === sort ? "true" : undefined}>{sortLabel(locale, sort)}</a>
      ))}
    </nav>
    <form method="get" action={path} class="scorecard-filters" role="search" aria-label={sc(locale, "filters")}>
      {filters.segment !== "all" ? <input type="hidden" name="segment" value={filters.segment} /> : null}
      {filters.sort !== "group" ? <input type="hidden" name="sort" value={filters.sort} /> : null}
      <label>
        {sc(locale, "search")}
        <input type="search" name="q" value={filters.q} maxLength={100} autocomplete="off" data-scorecard-q />
      </label>
      <label>
        {sc(locale, "block")}
        <select name="block">
          <option value="">{sc(locale, "allBlocks")}</option>
          {(["coalition-37", "opposition", "arab", "other"] as const).map((block) => (
            <option value={block} selected={filters.block === block}>{blockLabel(locale, block)}</option>
          ))}
        </select>
      </label>
      <label>
        {sc(locale, "criterion")}
        <select name="criterion">
          <option value="">{sc(locale, "allCriteria")}</option>
          {dataset.criteria.map((criterion) => (
            <option value={criterion.id} selected={filters.criterion === criterion.id} lang={locale} dir={dirOf(locale)}>
              {criterion.title[locale]}
            </option>
          ))}
        </select>
      </label>
      <label>
        {sc(locale, "status")}
        <select name="status">
          <option value="">{sc(locale, "allStatuses")}</option>
          {(["PASS", "FAIL", "PARTIAL", "UNCOMMITTED"] as const).map((status) => (
            <option value={status} selected={filters.status === status}>{statusLabel(locale, status)}</option>
          ))}
        </select>
      </label>
      <button type="submit">{sc(locale, "search")}</button>
      <a href={path}>{sc(locale, "clear")}</a>
    </form>
    </>
  );
}

function segmentLabel(locale: Locale, segment: ScorecardSegment): string {
  switch (segment) {
    case "all":
      return sc(locale, "segmentAll");
    case "incumbent":
      return sc(locale, "segmentIncumbent");
    case "challenger":
      return sc(locale, "segmentChallenger");
    case "high":
      return sc(locale, "segmentHigh");
    default: {
      const _exhaustive: never = segment;
      return _exhaustive;
    }
  }
}

function sortLabel(locale: Locale, sort: ScorecardSort): string {
  switch (sort) {
    case "group":
      return sc(locale, "sortGroup");
    case "compliance":
      return sc(locale, "sortCompliance");
    case "alpha":
      return sc(locale, "sortAlpha");
    default: {
      const _exhaustive: never = sort;
      return _exhaustive;
    }
  }
}

function parliamentaryLabel(locale: Locale, party: PartyCompliance): string {
  switch (party.parliamentaryStatus) {
    case "INCUMBENT":
      return sc(locale, "incumbentBadge");
    case "CHALLENGER":
      return sc(locale, "challengerBadge");
    default: {
      const _exhaustive: never = party.parliamentaryStatus;
      return _exhaustive;
    }
  }
}

function partySearchKey(party: PartyCompliance): string {
  return normalizeHebrew(`${party.partyNameHe} ${party.leaderHe} ${party.searchAliasesHe ?? ""} ${party.ballotNoteHe ?? ""}`);
}

function statusPreview(locale: Locale, party: PartyCompliance, criterionId: CriterionId): string {
  const text = party.basis[criterionId][locale].replace(/\s+/g, " ").trim();
  return text.length > 140 ? `${text.slice(0, 137)}…` : text;
}

export function ScorecardTable({
  locale,
  path,
  dataset,
  parties,
  filters
}: {
  locale: Locale;
  path: string;
  dataset: ScorecardDataset;
  parties: PartyCompliance[];
  filters: ScorecardFilters;
}) {
  const criteria = filters.criterion
    ? dataset.criteria.filter((row) => row.id === filters.criterion)
    : dataset.criteria;

  return (
    <>
      <p class="scorecard-mobile-hint">{sc(locale, "mobileHint")}</p>
      <div class="scorecard-table-wrap" role="region" aria-label={sc(locale, "matrixCaption")}>
        <table class="scorecard-table">
          <caption class="sr-only">{sc(locale, "matrixCaption")}</caption>
          <thead>
            <tr>
              <th scope="col">{sc(locale, "party")}</th>
              {criteria.map((criterion) => (
                <th scope="col" lang={locale} dir={dirOf(locale)}>
                  <span class="scorecard-criterion-title">{criterion.title[locale]}</span>
                  <span class="scorecard-criterion-cat">{sc(locale, categoryKey(criterion.category))}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {parties.map((party) => (
              <tr data-scorecard-party={party.partyId} data-search={partySearchKey(party)}>
                <th scope="row" lang="he" dir="rtl">
                  <span class="scorecard-party-name">{party.partyNameHe}</span>
                  <span class="scorecard-party-leader">{party.leaderHe}</span>
                  {party.ballotNoteHe ? <span class="scorecard-party-note">{party.ballotNoteHe}</span> : null}
                  <span class="scorecard-party-block" lang={locale} dir={dirOf(locale)}>{parliamentaryLabel(locale, party)} · {blockLabel(locale, party.block)}</span>
                  <ComplianceGauge locale={locale} party={party} />
                </th>
                {criteria.map((criterion) => {
                  const href = `${path}?${scorecardQuery(filters, { party: party.partyId, evidence: criterion.id })}#evidence`;
                  return (
                    <td>
                      <StatusBadge
                        locale={locale}
                        status={party.scores[criterion.id]}
                        href={href}
                        criterionTitle={criterion.title[locale]}
                        preview={statusPreview(locale, party, criterion.id)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul class="scorecard-cards">
        {parties.map((party) => (
          <li key={party.partyId} data-scorecard-party={party.partyId} data-search={partySearchKey(party)}>
            <details class="scorecard-card" open={filters.party === party.partyId}>
              <summary>
                <span lang="he" dir="rtl" class="scorecard-party-name">{party.partyNameHe}</span>
                <span lang="he" dir="rtl" class="scorecard-party-leader">{party.leaderHe}</span>
                <ComplianceGauge locale={locale} party={party} />
              </summary>
              <p class="scorecard-party-block">{parliamentaryLabel(locale, party)} · {blockLabel(locale, party.block)}</p>
              {party.ballotNoteHe ? <p class="scorecard-party-note" lang="he" dir="rtl">{party.ballotNoteHe}</p> : null}
              <ul class="scorecard-card-scores">
                {criteria.map((criterion) => {
                  const href = `${path}?${scorecardQuery(filters, { party: party.partyId, evidence: criterion.id })}#evidence`;
                  return (
                    <li>
                      <span lang={locale} dir={dirOf(locale)}>{criterion.title[locale]}</span>
                      <StatusBadge
                        locale={locale}
                        status={party.scores[criterion.id]}
                        href={href}
                        criterionTitle={criterion.title[locale]}
                        preview={statusPreview(locale, party, criterion.id)}
                      />
                    </li>
                  );
                })}
              </ul>
            </details>
          </li>
        ))}
      </ul>

      <CriteriaLegend locale={locale} criteria={dataset.criteria} />
    </>
  );
}

function CriteriaLegend({ locale, criteria }: { locale: Locale; criteria: Criterion[] }) {
  return (
    <section class="scorecard-legend">
      <h2>{sc(locale, "criteriaLegend")}</h2>
      <ol>
        {criteria.map((criterion) => (
          <li key={criterion.id} lang={locale} dir={dirOf(locale)}>
            <h3>{criterion.title[locale]}</h3>
            <p class="scorecard-criterion-cat">{sc(locale, categoryKey(criterion.category))}</p>
            <p>{criterion.description[locale]}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function ScorecardIntro({ locale, children }: { locale: Locale; children?: Child }) {
  return (
    <section class="scorecard-intro">
      <p class="eyebrow">{sc(locale, "nav")}</p>
      <h1>{sc(locale, "title")}</h1>
      <p class="lede">{sc(locale, "lede")}</p>
      <p class="scorecard-pending">{sc(locale, "listsPending")}</p>
      <ol class="scorecard-steps">
        <li>{sc(locale, "stepSegment")}</li>
        <li>{sc(locale, "stepSearch")}</li>
        <li>{sc(locale, "stepOpen")}</li>
      </ol>
      <p class="neutrality">{s(locale, "neutrality")}</p>
      {children}
    </section>
  );
}

/** Israeli numeric date (DD.MM.YYYY) inside LTR isolation to avoid bidi digit flips. */
export function formatIsraeliDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return iso;
  return `${day}.${month}.${year}`;
}

/** Hebrew month name form kept for legends; numeric form is preferred in evidence. */
export function formatHebrewDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  try {
    return new Intl.DateTimeFormat("he-IL", { year: "numeric", month: "long", day: "numeric" }).format(
      new Date(Date.UTC(year, month - 1, day))
    );
  } catch {
    return formatIsraeliDate(iso);
  }
}

export function resolveEvidence(
  dataset: ScorecardDataset,
  partyId: string | undefined,
  criterionId: CriterionId | undefined
): { party: PartyCompliance; criterion: Criterion; records: EvidenceRecord[] } | undefined {
  if (!partyId || !criterionId || !isPartyId(partyId)) return undefined;
  const party = dataset.parties.find((row) => row.partyId === partyId);
  const criterion = dataset.criteria.find((row) => row.id === criterionId);
  if (!party || !criterion) return undefined;
  const records = (party.evidenceMap[criterionId] ?? [])
    .map((id) => dataset.evidence.find((row) => row.id === id))
    .filter((row): row is EvidenceRecord => Boolean(row));
  return { party, criterion, records };
}
