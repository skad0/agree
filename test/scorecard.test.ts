import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createApp } from "../src/app.js";
import { scorecard2026 } from "../src/data/scorecard-2026.js";
import { assertScorecardDataset, PARTY_IDS, CRITERION_IDS } from "../src/types/scorecard.js";
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
      /^https:\/\/(main\.knesset\.gov\.il|fs\.knesset\.gov\.il|supremedecisions\.court\.gov\.il|next\.obudget\.org)\//i
    );
    assert.equal(record.verified, true);
  }
  assert.ok(scorecard2026.evidence.some((row) => row.referenceNumber.he.includes("6198/23")));
  assert.ok(!scorecard2026.evidence.some((row) => Object.values(row.referenceNumber).some((text) => text.includes("4398/24"))));
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
    }
  } finally {
    close();
    rmSync(dir, { recursive: true, force: true });
  }
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
