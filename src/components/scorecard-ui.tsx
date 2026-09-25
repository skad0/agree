import type { Child } from "hono/jsx";
import { ShareOptions } from "./share-options.js";
import { Callout } from "./public-ui.js";
import { sc, statusLabel, blockLabel, type ScorecardKey } from "../scorecard-copy.js";
import type { Locale } from "../i18n.js";
import type {
  ComplianceStatus,
  Criterion,
  CriterionId,
  EvidenceRecord,
  PartyBlock,
  PartyCompliance,
  ScorecardDataset
} from "../types/scorecard.js";
import { isComplianceStatus, isCriterionId, isPartyBlock, isPartyId } from "../types/scorecard.js";
import { normalizeHebrew } from "../integrations/elections/normalize-hebrew.js";
import { s } from "../share-copy.js";

export type ScorecardFilters = {
  q: string;
  block?: PartyBlock;
  criterion?: CriterionId;
  status?: ComplianceStatus;
  party?: string;
  evidenceCriterion?: CriterionId;
};

export function parseScorecardFilters(query: {
  q?: string;
  block?: string;
  criterion?: string;
  status?: string;
  party?: string;
  evidence?: string;
}): { filters: ScorecardFilters; reset: boolean } {
  const q = (query.q ?? "").slice(0, 100).trim();
  const blockRaw = query.block ?? "";
  const criterionRaw = query.criterion ?? "";
  const statusRaw = query.status ?? "";
  const partyRaw = (query.party ?? "").slice(0, 64).trim();
  const evidenceRaw = query.evidence ?? "";
  let reset = false;
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
    if (filters.party && party.partyId !== filters.party) return false;
    if (filters.criterion && filters.status && party.scores[filters.criterion] !== filters.status) return false;
    if (filters.criterion && !filters.status) {
      /* criterion alone still shows all parties; matrix highlights that column */
    }
    if (filters.status && !filters.criterion) {
      const hit = Object.values(party.scores).some((value) => value === filters.status);
      if (!hit) return false;
    }
    if (!terms.length) return true;
    const haystack = normalizeHebrew(`${party.partyNameHe} ${party.leaderHe} ${party.partyId}`);
    return terms.every((term) => haystack.includes(term));
  });
}

export function scorecardQuery(filters: ScorecardFilters, extras: Record<string, string | undefined> = {}): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.block) params.set("block", filters.block);
  if (filters.criterion) params.set("criterion", filters.criterion);
  if (filters.status) params.set("status", filters.status);
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
  criterionTitle
}: {
  locale: Locale;
  status: ComplianceStatus;
  href: string;
  criterionTitle: string;
}) {
  const label = statusLabel(locale, status);
  return (
    <a
      class={`score-badge score-${status.toLowerCase()}`}
      href={href}
      title={`${criterionTitle}: ${label}`}
      aria-label={`${criterionTitle}: ${label}. ${sc(locale, "openEvidence")}`}
    >
      <span class="score-badge-mark" aria-hidden="true">{statusMark(status)}</span>
      <span class="score-badge-label">{label}</span>
    </a>
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

export function EvidenceDrawer({
  locale,
  party,
  criterion,
  records,
  closeHref
}: {
  locale: Locale;
  party: PartyCompliance;
  criterion: Criterion;
  records: EvidenceRecord[];
  closeHref: string;
}) {
  const status = party.scores[criterion.id];
  return (
    <section class="scorecard-evidence" id={`evidence-${party.partyId}-${criterion.id}`} tabIndex={-1}>
      <div class="scorecard-evidence-header">
        <h2>{sc(locale, "evidenceHeading")}</h2>
        <a class="scorecard-evidence-close" href={closeHref}>{sc(locale, "closeEvidence")}</a>
      </div>
      <p class="scorecard-evidence-party" lang="he" dir="rtl">
        <strong>{party.partyNameHe}</strong>
        {" · "}
        {party.leaderHe}
        {" · "}
        {criterion.titleHe}
        {" · "}
        {statusLabel(locale, status)}
      </p>
      <div class="scorecard-basis" lang="he" dir="rtl">
        <h3>{sc(locale, "statusBasis")}</h3>
        <p>{party.basisHe[criterion.id]}</p>
      </div>
      {!records.length ? <p role="status">{sc(locale, "noEvidence")}</p> : null}
      <ol class="scorecard-evidence-list">
        {records.map((record) => (
          <li key={record.id} class="scorecard-evidence-item">
            <p class="scorecard-trust"><span class="badge on">{sc(locale, "trustBadge")}</span></p>
            <dl class="scorecard-evidence-fields">
              <dt>{sc(locale, "evidenceDate")}</dt>
              <dd><time dateTime={record.date}><bdi dir="ltr">{formatIsraeliDate(record.date)}</bdi></time></dd>
              <dt>{sc(locale, "evidenceReference")}</dt>
              <dd lang="he" dir="rtl">{record.referenceNumber}</dd>
              <dt>{sc(locale, "evidenceSummary")}</dt>
              <dd lang="he" dir="rtl">{record.summaryHe}</dd>
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
          <p lang="he" dir="rtl">{party.officialResponse.textHe}</p>
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
  return (
    <form method="get" action={path} class="scorecard-filters" role="search" aria-label={sc(locale, "filters")}>
      <label>
        {sc(locale, "search")}
        <input type="search" name="q" value={filters.q} maxLength={100} autocomplete="off" />
      </label>
      <label>
        {sc(locale, "block")}
        <select name="block">
          <option value="">{sc(locale, "allBlocks")}</option>
          {(["coalition-37", "opposition", "arab"] as const).map((block) => (
            <option value={block} selected={filters.block === block}>{blockLabel(locale, block)}</option>
          ))}
        </select>
      </label>
      <label>
        {sc(locale, "criterion")}
        <select name="criterion">
          <option value="">{sc(locale, "allCriteria")}</option>
          {dataset.criteria.map((criterion) => (
            <option value={criterion.id} selected={filters.criterion === criterion.id} lang="he" dir="rtl">
              {criterion.titleHe}
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
  );
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
                <th scope="col" lang="he" dir="rtl">
                  <span class="scorecard-criterion-title">{criterion.titleHe}</span>
                  <span class="scorecard-criterion-cat">{sc(locale, categoryKey(criterion.category))}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {parties.map((party) => (
              <tr>
                <th scope="row" lang="he" dir="rtl">
                  <span class="scorecard-party-name">{party.partyNameHe}</span>
                  <span class="scorecard-party-leader">{party.leaderHe}</span>
                  <span class="scorecard-party-block">{blockLabel(locale, party.block)}</span>
                </th>
                {criteria.map((criterion) => {
                  const href = `${path}?${scorecardQuery(filters, { party: party.partyId, evidence: criterion.id })}#evidence`;
                  return (
                    <td>
                      <StatusBadge
                        locale={locale}
                        status={party.scores[criterion.id]}
                        href={href}
                        criterionTitle={criterion.titleHe}
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
          <li key={party.partyId}>
            <details class="scorecard-card" open={filters.party === party.partyId}>
              <summary>
                <span lang="he" dir="rtl" class="scorecard-party-name">{party.partyNameHe}</span>
                <span lang="he" dir="rtl" class="scorecard-party-leader">{party.leaderHe}</span>
              </summary>
              <p class="scorecard-party-block">{blockLabel(locale, party.block)}</p>
              <ul class="scorecard-card-scores">
                {criteria.map((criterion) => {
                  const href = `${path}?${scorecardQuery(filters, { party: party.partyId, evidence: criterion.id })}#evidence`;
                  return (
                    <li>
                      <span lang="he" dir="rtl">{criterion.titleHe}</span>
                      <StatusBadge
                        locale={locale}
                        status={party.scores[criterion.id]}
                        href={href}
                        criterionTitle={criterion.titleHe}
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
      <h2 lang="he" dir="rtl">קריטריוני רף משותף</h2>
      <ol>
        {criteria.map((criterion) => (
          <li key={criterion.id} lang="he" dir="rtl">
            <h3>{criterion.titleHe}</h3>
            <p class="scorecard-criterion-cat">{sc(locale, categoryKey(criterion.category))}</p>
            <p>{criterion.descriptionHe}</p>
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
