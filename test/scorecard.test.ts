import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createApp } from "../src/app.js";
import { scorecard2026 } from "../src/data/scorecard-2026.js";
import { assertScorecardDataset, PARTY_IDS, CRITERION_IDS, complianceMetrics } from "../src/types/scorecard.js";
import { filterParties, parseScorecardFilters } from "../src/components/scorecard-ui.js";
import { locales } from "../src/i18n.js";
import { sc } from "../src/scorecard-copy.js";

test("scorecard dataset is complete and only cites official hosts", () => {
  assertScorecardDataset(scorecard2026);
  assert.equal(scorecard2026.parties.length, PARTY_IDS.length);
  assert.equal(scorecard2026.criteria.length, CRITERION_IDS.length);
  for (const record of scorecard2026.evidence) {
    assert.match(
      record.officialSourceUrl,
      /^https:\/\/(main\.knesset\.gov\.il|fs\.knesset\.gov\.il|supremedecisions\.court\.gov\.il|next\.obudget\.org|www\.gov\.il)\//i
    );
    assert.equal(record.verified, true);
  }
  assert.ok(scorecard2026.evidence.some((row) => row.referenceNumber.he.includes("6198/23")));
  assert.ok(!scorecard2026.evidence.some((row) => Object.values(row.referenceNumber).some((text) => text.includes("4398/24"))));
});

test("challenger lists are not failed for a missing 25th-Knesset vote", () => {
  const challengers = scorecard2026.parties.filter((party) => party.parliamentaryStatus === "CHALLENGER");
  assert.ok(challengers.length >= 20);
  for (const party of challengers) {
    for (const status of Object.values(party.scores)) assert.notEqual(status, "FAIL");
    const metrics = complianceMetrics(party);
    assert.equal(metrics.totalCriteria, 5);
    assert.equal(metrics.passedCount, 0);
    assert.equal(metrics.compliancePercentage, 0);
  }
  assert.ok(scorecard2026.evidence.some((row) => row.type === "OFFICIAL_PLATFORM" && row.officialSourceUrl.includes("www.gov.il")));
  const { filters } = parseScorecardFilters({ q: "בלד", segment: "challenger" });
  const rows = filterParties(scorecard2026, filters);
  assert.ok(rows.some((row) => row.partyId === "joint-list") === false);
  const balad = filterParties(scorecard2026, parseScorecardFilters({ q: "בלד" }).filters);
  assert.ok(balad.some((row) => row.partyId === "joint-list"));
  const likud = filterParties(scorecard2026, parseScorecardFilters({ q: "Likud" }).filters);
  assert.deepEqual(likud.map((row) => row.partyId), ["likud"]);
  assert.equal(scorecard2026.parties.find((row) => row.partyId === "likud")?.partyName.he, "הליכוד");
});

test("scorecard filters search and compliance levels", () => {
  const { filters } = parseScorecardFilters({ q: "ליברמן", status: "PASS" });
  const rows = filterParties(scorecard2026, filters);
  assert.ok(rows.some((row) => row.partyId === "yisrael-beiteinu"));
  assert.ok(rows.every((row) => Object.values(row.scores).includes("PASS")));
});

test("scorecard route renders Hebrew matrix, evidence drawer, pledge and Open Graph title", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-scorecard-"));
  const { app, close } = createApp({ sqlitePath: join(dir, "app.db") });
  try {
    const home = await app.request("/he/scorecard");
    assert.equal(home.status, 200);
    const html = await home.text();
    assert.match(html, /dir="rtl"/);
    assert.match(html, /מדד רף משותף לבחירות לכנסת ה-26/);
    assert.match(html, /class="scorecard-table"/);
    assert.match(html, /class="scorecard-cards"/);
    assert.match(html, /כל הרשימות/);
    assert.match(html, /המילואימניקים/);
    assert.match(html, /desk@rafmeshutaf\.org\.il/);
    assert.match(
      html,
      /property="og:title" content="מדד רף משותף לבחירות לכנסת ה-26 \| מי מהמפלגות עומדת בקווי היסוד האזרחיים\?"/
    );
    assert.match(html, /href="\/he\/scorecard"/);
    assert.doesNotMatch(html, /4398\/24/);

    const evidence = await app.request("/he/scorecard?party=likud&evidence=equal-service");
    assert.equal(evidence.status, 200);
    const evidenceHtml = await evidence.text();
    assert.match(evidenceHtml, /id="evidence"/);
    assert.match(evidenceHtml, /מקור רשמי מאומת/);
    assert.match(evidenceHtml, /בסיס עובדתי לסטטוס/);
    assert.match(evidenceHtml, /main\.knesset\.gov\.il/);
    assert.match(evidenceHtml, /6198\/23/);
    assert.match(evidenceHtml, /10\.06\.2024/);
    assert.match(evidenceHtml, /שתף תעודת זהות אזרחית/);
    assert.match(evidenceHtml, /wa\.me/);
    assert.match(evidenceHtml, /x\.com\/intent\/post/);
    assert.equal(evidence.headers.get("cache-control"), "private, no-store");
  } finally {
    close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("scorecard route is available in English chrome with Hebrew evidence language tags", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-scorecard-en-"));
  const { app, close } = createApp({ sqlitePath: join(dir, "app.db") });
  try {
    const response = await app.request("/en/scorecard");
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /Shared Threshold Scorecard/);
    assert.match(html, /lang="he" dir="rtl"/);
    assert.match(html, /הליכוד/);
    assert.match(html, /Likud/);
    assert.match(html, /Benjamin Netanyahu/);
    assert.match(html, /Equal burden of service/);
  } finally {
    close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("scorecard route returns 200 with localized chrome in every site locale", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-scorecard-all-"));
  const { app, close } = createApp({ sqlitePath: join(dir, "app.db") });
  try {
    for (const locale of locales) {
      const response = await app.request(`/${locale}/scorecard`);
      assert.equal(response.status, 200, locale);
      const html = await response.text();
      assert.match(html, new RegExp(escapeRegExp(sc(locale, "title"))));
      assert.match(html, new RegExp(escapeRegExp(scorecard2026.electionLabel[locale])));
      assert.match(html, new RegExp(escapeRegExp(scorecard2026.criteria[0]!.title[locale])));
      assert.match(html, /הליכוד/);
      if (locale === "he") assert.doesNotMatch(html, /Likud/);
      if (locale === "ar") assert.match(html, /الليكود/);
      if (locale === "ru") assert.match(html, /Ликуд/);
    }
  } finally {
    close();
    rmSync(dir, { recursive: true, force: true });
  }
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

type TranscriptList = { officialListKey: string; listTitleHe: string; ballotLetters: string; sourceUrl: string; running: boolean; withdrawnEvidenceUrl: string | null; pageUpdated: string };
type Transcript = { source: { approvalState: string }; lists: TranscriptList[]; rows: { officialListKey: string; rank: number; fullNameHe: string }[] };

/** Display names that are shorter than the official rank-1 name, with the token they add. */
const LEADER_NICKNAMES: Record<string, string[]> = { yashar: ["גדי"] };

test("scorecard parties match the approved 26th Knesset transcript", () => {
  const transcript = JSON.parse(readFileSync(join(process.cwd(), "data/elections/knesset-26-lists.json"), "utf8")) as Transcript;
  assert.equal(transcript.source.approvalState, "approved");
  const used = new Map<string, string>();
  // Geresh and quote marks vary between the roster and common spelling; other punctuation splits words.
  const tokens = (text: string) => text.replace(/['\u05f3\u05f4"]/g, "").replace(/[,.!()\u2013-]/g, " ").split(/\s+/).filter(Boolean);
  for (const party of scorecard2026.parties) {
    const list = transcript.lists.find((row) => row.officialListKey === party.officialListKey);
    assert.ok(list, `${party.partyId} points at a list in the transcript`);
    assert.equal(used.get(list.officialListKey), undefined, `${list.officialListKey} is claimed twice`);
    used.set(list.officialListKey, party.partyId);
    assert.equal(party.ballotLetters, list.ballotLetters, `${party.partyId} letters`);
    assert.equal(party.rosterUrl, list.sourceUrl, `${party.partyId} roster URL`);
    assert.equal(Boolean(party.withdrawn), !list.running, `${party.partyId} running state`);
    if (party.withdrawn) {
      assert.equal(party.withdrawn.evidenceUrl, list.withdrawnEvidenceUrl);
      assert.equal(party.withdrawn.pageUpdated, list.pageUpdated);
    }
    const first = transcript.rows.find((row) => row.officialListKey === list.officialListKey && row.rank === 1);
    const official = new Set([...tokens(list.listTitleHe), ...(first ? tokens(first.fullNameHe) : []), ...(LEADER_NICKNAMES[party.partyId] ?? [])]);
    for (const token of tokens(party.leaderHe)) assert.ok(official.has(token), `${party.partyId}: leader token ${token} is not in the official title or rank-1 name`);
  }
  assert.equal(used.size, transcript.lists.length, "every list in the transcript has a scorecard row");
});

test("a withdrawn list stays findable but is not scored, segmented or shared as on the ballot", async () => {
  const blueWhite = scorecard2026.parties.find((party) => party.partyId === "blue-white")!;
  assert.ok(blueWhite.withdrawn);
  const all = filterParties(scorecard2026, parseScorecardFilters({}).filters);
  assert.equal(all.at(-1)?.partyId, "blue-white", "sorted after every running list");
  for (const segment of ["incumbent", "challenger", "high"]) {
    assert.ok(!filterParties(scorecard2026, parseScorecardFilters({ segment }).filters).some((party) => party.withdrawn), segment);
  }
  assert.deepEqual(filterParties(scorecard2026, parseScorecardFilters({ q: "גנץ" }).filters).map((party) => party.partyId), ["blue-white"]);
  assert.deepEqual(filterParties(scorecard2026, parseScorecardFilters({ q: "מחל" }).filters).map((party) => party.partyId), ["likud"], "ballot letters are searchable");

  const dir = mkdtempSync(join(tmpdir(), "agree-scorecard-withdrawn-"));
  const { app, close } = createApp({ sqlitePath: join(dir, "app.db") });
  try {
    const page = await (await app.request("/en/scorecard")).text();
    assert.match(page, /Lists as approved by the Central Elections Committee on 27\.9\.2026\./);
    assert.doesNotMatch(page, /not yet (approved|published)/);
    assert.match(page, /class="scorecard-withdrawn"[^>]*>Withdrew — not on the ballot</);
    const drawer = await (await app.request("/en/scorecard?party=blue-white&evidence=equal-service")).text();
    assert.match(drawer, /class="scorecard-withdrawn-note"/);
    assert.doesNotMatch(drawer, /class="scorecard-share"/);
    const running = await (await app.request("/en/scorecard?party=likud&evidence=equal-service")).text();
    assert.match(running, /class="scorecard-share"/);
    const challenger = await (await app.request("/en/scorecard?party=pirates&evidence=equal-service")).text();
    assert.match(challenger, /as approved by the committee plenum on 27\.9\.2026/);
    assert.match(challenger, /The list was approved by the Central Elections Committee \(committee plenum, 27\.9\.2026\)/);
  } finally {
    close();
    rmSync(dir, { recursive: true, force: true });
  }
});
