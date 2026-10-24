import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { createApp } from "../src/app.js";
import { positions2026 } from "../src/data/positions-2026.js";
import { scorecard2026 } from "../src/data/scorecard-2026.js";
import { issueSlugs } from "../src/issues.js";
import { locales } from "../src/i18n.js";
import { assertPositionsDataset, type PositionsDataset } from "../src/types/positions.js";
import { onRecordCount } from "../src/components/positions-ui.js";

test("positions dataset is complete, dated and cites only listed hosts", () => {
  assertPositionsDataset(positions2026);
  assert.equal(positions2026.tracked.length, 15);
  for (const id of positions2026.tracked) {
    const party = scorecard2026.parties.find((row) => row.partyId === id);
    assert.ok(party, `tracked party ${id} exists in the scorecard`);
    assert.equal(party.withdrawn, undefined, `${id} is still on the ballot`);
  }
  for (const record of positions2026.records) assert.ok(issueSlugs.includes(record.question));
  // Every question that has no statement still says so through a background note or the empty state.
  assert.ok(positions2026.context.some((item) => item.question === "elections-on-time"));
});

test("positions dataset rejects unlisted hosts, future dates and duplicate cells", () => {
  const base = structuredClone(positions2026) as PositionsDataset;
  const unlisted = structuredClone(base);
  unlisted.records[0]!.sources = [{ ...unlisted.records[0]!.sources[0]!, url: "https://example.com/post" }];
  assert.throws(() => assertPositionsDataset(unlisted), /unlisted source host/);

  const future = structuredClone(base);
  future.records[0]!.sources = [{ ...future.records[0]!.sources[0]!, date: "2026-12-01" }];
  assert.throws(() => assertPositionsDataset(future), /bad source date/);

  const duplicate = structuredClone(base);
  duplicate.records.push({ ...duplicate.records[0]!, id: "pos-duplicate" });
  assert.throws(() => assertPositionsDataset(duplicate), /two records/);
});

test("a refusal to answer does not count as a list on record", () => {
  const inquiry = positions2026.records.filter((record) => record.question === "october-7-inquiry");
  const declined = inquiry.filter((record) => record.stance === "declined").length;
  assert.ok(declined > 0);
  assert.equal(onRecordCount(positions2026, "october-7-inquiry"), inquiry.length - declined);
});

test("positions page, issue sections and index counts render in every locale", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-positions-"));
  const { app, close } = createApp({ sqlitePath: join(dir, "app.db") });
  try {
    for (const locale of locales) {
      const response = await app.request(`/${locale}/positions`);
      assert.equal(response.status, 200, `${locale} positions`);
      const page = await response.text();
      assert.doesNotMatch(page, /translation unavailable/);
      assert.doesNotMatch(page, /\sstyle="/, "CSP forbids inline styles");
      assert.equal((page.match(/class="stance [^"]*stance-cell"/g) ?? []).length, positions2026.tracked.length * issueSlugs.length);
      assert.equal((page.match(/class="positions-fold"/g) ?? []).length, issueSlugs.length);
      assert.match(page, new RegExp(`href="/${locale}/positions" aria-current="page"`), "header marks the positions page");

      const byList = await (await app.request(`/${locale}/positions?view=list`)).text();
      assert.equal((byList.match(/class="positions-fold"/g) ?? []).length, positions2026.tracked.length);
      assert.match(byList, /positions-other-card/);

      const issue = await (await app.request(`/${locale}/issues/october-7-inquiry`)).text();
      assert.match(issue, /id="positions"/);
      assert.match(issue, /id="pos-yashar-inquiry"/);
      assert.match(issue, /https:\/\/www\.ynet\.co\.il\/news\/elections2026\/article\/yokra14915209/);

      const home = await (await app.request(`/${locale}`)).text();
      assert.match(home, new RegExp(`class="positions-cta-button" href="/${locale}/positions"`));
      assert.equal((home.match(/class="issue-onrecord"/g) ?? []).length, issueSlugs.length);
    }
    // Lists without a statement are named, not hidden.
    const quiet = await (await app.request("/en/issues/coalition-choices")).text();
    assert.match(quiet, /positions-quiet[\s\S]*id="pos-israel-first"/);

    // The scorecard index offers the way in twice: the card, and a link on every tracked row.
    const scorecard = await (await app.request("/en/scorecard")).text();
    assert.match(scorecard, /class="positions-cta-button" href="\/en\/positions"/);
    assert.match(scorecard, /class="scorecard-positions-link" href="\/en\/positions\?view=list&amp;list=yashar#list-yashar"/);
    assert.doesNotMatch(scorecard, /list=pirates/, "untracked lists get no link");

    // Deep links open their section on the server, so a phone lands on content without scripting.
    const opened = await (await app.request("/en/positions?view=list&list=yashar")).text();
    assert.match(opened, /id="list-yashar"><details class="positions-fold" open/);
    const question = await (await app.request("/en/positions?q=october-7-inquiry")).text();
    assert.match(question, /id="q-october-7-inquiry"><details class="positions-fold" open/);
    const bogus = await app.request("/en/positions?view=nope&list=nobody&q=nothing&entry=nope");
    assert.equal(bogus.status, 200);
    assert.doesNotMatch(await bogus.text(), /positions-fold" open/);

    // Every statement has its own link, and no id repeats in either view.
    for (const view of ["", "?view=list"]) {
      const page = await (await app.request(`/en/positions${view}`)).text();
      const ids = [...page.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
      const repeated = ids.filter((id, index) => ids.indexOf(id) !== index);
      assert.deepEqual(repeated, [], `repeated ids on /en/positions${view}`);
    }
    const sample = positions2026.records.find((record) => record.id === "pos-yb-coalition")!;
    const byQuestion = await (await app.request("/en/positions")).text();
    assert.match(byQuestion, /href="\/en\/positions\?entry=pos-yb-coalition#pos-yb-coalition"/);
    assert.match(byQuestion, /id="share-url-pos-yb-coalition"[^>]*value="[^"]*\/en\/positions\?entry=pos-yb-coalition#pos-yb-coalition"/);
    assert.match(byQuestion, /id="share-url-positions"/, "the page itself can be shared");

    // Each question previews with its own card, and that card is actually served.
    for (const locale of locales) {
      const issuePage = await (await app.request(`/${locale}/issues/october-7-inquiry`)).text();
      const image = issuePage.match(/<meta property="og:image" content="[^"]*(\/assets\/share-q-october-7-inquiry-[a-z]{2}-[0-9a-f]{12}\.png)"/);
      assert.ok(image, `${locale} question card in og:image`);
      const served = await app.request(image[1]!);
      assert.equal(served.status, 200);
      assert.equal(served.headers.get("content-type"), "image/png");
    }
    assert.match(await (await app.request("/en/positions?entry=pos-yb-coalition")).text(), /og:image" content="[^"]*share-q-coalition-choices-en-/);

    // A statement permalink opens its question on the server and previews as that statement.
    const permalink = await (await app.request("/en/positions?entry=pos-yb-coalition")).text();
    assert.match(permalink, new RegExp(`id="q-${sample.question}"><details class="positions-fold" open`));
    assert.match(permalink, /<meta property="og:title" content="ישראל ביתנו \(Yisrael Beiteinu\) — Who could form a coalition together\?"/);
    assert.match(permalink, new RegExp(`<meta property="og:description" content="${escapeRegExp(sample.summary.en).replace(/'/g, "(?:'|&#39;)")}"`));
  } finally {
    close();
    rmSync(dir, { recursive: true, force: true });
  }
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
