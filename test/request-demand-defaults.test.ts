import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createApp } from "../src/app.js";
import { AskPanel } from "../src/components/public-ui.js";

test("build defaults check all translated demands; demand query checks only that id", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-demand-check-"));
  try {
    const runtime = createApp({ sqlitePath: join(dir, "app.db"), env: { NODE_ENV: "test", SESSION_SECRET: "test-secret" } });
    const demandIds = (runtime.db.prepare(`SELECT d.id FROM demands d
      JOIN demand_translations dt ON dt.demand_id = d.id AND dt.locale = 'en'
      WHERE d.document = 'standard' AND d.is_active = 1 ORDER BY d.sort_order`).all() as { id: number }[]).map((row) => row.id);
    assert.ok(demandIds.length >= 2);

    const general = await runtime.app.request("/en/request/build?recipient=1");
    assert.equal(general.status, 200);
    const generalHtml = await general.text();
    for (const id of demandIds) {
      assert.match(generalHtml, new RegExp(`name="demandId" value="${id}"[^>]*checked`));
    }

    const only = demandIds[1]!;
    const focused = await runtime.app.request(`/en/request/build?recipient=1&demand=${only}`);
    assert.equal(focused.status, 200);
    const focusedHtml = await focused.text();
    assert.match(focusedHtml, new RegExp(`name="demandId" value="${only}"[^>]*checked`));
    for (const id of demandIds.filter((row) => row !== only)) {
      assert.doesNotMatch(focusedHtml, new RegExp(`name="demandId" value="${id}"[^>]*checked`));
      assert.match(focusedHtml, new RegExp(`name="demandId" value="${id}"`));
    }
    runtime.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("AskPanel with demandId emits request query; standard clauses deep-link per demand", async () => {
  const withDemand = AskPanel({ locale: "en", demandId: 7 });
  assert.ok(jsxHrefs(withDemand).includes("/en/request?demand=7"));
  const general = AskPanel({ locale: "en" });
  assert.ok(jsxHrefs(general).includes("/en/request"));
  assert.ok(!jsxHrefs(general).some((href) => href.includes("demand=")));

  const dir = mkdtempSync(join(tmpdir(), "agree-ask-clause-"));
  try {
    const runtime = createApp({ sqlitePath: join(dir, "app.db"), env: { NODE_ENV: "test", SESSION_SECRET: "test-secret" } });
    const demandId = Number((runtime.db.prepare(`SELECT d.id FROM demands d
      JOIN demand_translations dt ON dt.demand_id = d.id AND dt.locale = 'en'
      WHERE d.document = 'standard' AND d.is_active = 1 ORDER BY d.sort_order LIMIT 1`).get() as { id: number }).id);
    const page = await runtime.app.request("/en/standard");
    assert.equal(page.status, 200);
    const html = await page.text();
    assert.match(html, new RegExp(`/en/request\\?demand=${demandId}`));
    assert.match(html, /class="document-ask"[\s\S]*href="\/en\/request"/);
    runtime.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

function jsxHrefs(node: unknown): string[] {
  if (node == null || typeof node !== "object") return [];
  const value = node as { props?: { href?: string; children?: unknown }; children?: unknown };
  const found: string[] = [];
  if (typeof value.props?.href === "string") found.push(value.props.href);
  const nested = [value.children, value.props?.children].flatMap((child) => Array.isArray(child) ? child : child == null ? [] : [child]);
  for (const child of nested) found.push(...jsxHrefs(child));
  return found;
}