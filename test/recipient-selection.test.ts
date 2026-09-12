import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createApp } from "../src/app.js";
import {
  SELECTION_MAX,
  addRecipient,
  beginHandoff,
  completeCurrent,
  contactFingerprint,
  emptyBasket,
  issueContactProof,
  readBasket,
  removeRecipient,
  sharedMailboxGroups,
  signBasket,
  verifyContactProof
} from "../src/recipient-selection.js";

const now = Date.parse("2026-09-07T12:00:00.000Z");

function runtime(dir: string) {
  return createApp({ sqlitePath: join(dir, "app.db"), env: { NODE_ENV: "test", SESSION_SECRET: "selection-secret" } });
}

test("signed baskets reject tampering, expiry, capability tokens, and a sixth add", () => {
  const config = { sessionSecret: "selection-secret" } as const;
  const eligible = new Set([1, 2, 3, 4, 5, 6]);
  let basket = emptyBasket(now);
  for (const id of [1, 2, 3, 4, 5]) {
    const added = addRecipient(basket, id, eligible, now);
    assert.equal(added.error, undefined);
    basket = added.basket;
  }
  const limited = addRecipient(basket, 6, eligible, now);
  assert.equal(limited.error, "limit");
  assert.deepEqual(limited.basket.ids, [1, 2, 3, 4, 5]);
  assert.equal(addRecipient(basket, 9, eligible, now).error, "ineligible");

  const token = signBasket(basket, config);
  assert.equal(readBasket(token, config, { now }).ok, true);
  assert.equal(readBasket(token.slice(0, -1) + "0", config, { now }).ok, false);
  assert.equal(readBasket(token, config, { now: now + 2 * 60 * 60 * 1000 + 1 }).ok, false);
  const mixed = readBasket("v1.41.1735689600.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA", config, { now });
  assert.equal(mixed.ok, false);
  if (!mixed.ok) assert.equal(mixed.reason, "tampered");
  assert.equal(limited.basket.ids.length, SELECTION_MAX);

  const versioned = signBasket({ ...basket, publicationId: 8, electionId: 3 }, config);
  const version = readBasket(versioned, config, { now, publication: { electionId: 3, publicationId: 9 } });
  assert.equal(version.ok, false);
  if (!version.ok) assert.equal(version.reason, "version");
});

test("shared mailbox groups keep distinct people on one destination", () => {
  const groups = sharedMailboxGroups([
    { id: 11, name: "Ada", email: "party@example.org", whatsapp: null, contactable: true, channel: "direct" },
    { id: 12, name: "Bo", email: "PARTY@example.org", whatsapp: "1", contactable: true, channel: "direct" },
    { id: 13, name: "Cal", email: "other@example.org", whatsapp: null, contactable: true, channel: "direct" }
  ]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0]?.count, 2);
  assert.deepEqual(groups[0]?.ids, [11, 12]);
});

test("contact proof fails after the destination fingerprint changes", () => {
  const config = { sessionSecret: "selection-secret" } as const;
  const before = contactFingerprint({ email: "a@example.org", whatsapp: null });
  const after = contactFingerprint({ email: "b@example.org", whatsapp: null });
  const proof = issueContactProof(41, before, config, now);
  assert.equal(verifyContactProof(proof, 41, before, config, now), true);
  assert.equal(verifyContactProof(proof, 41, after, config, now), false);
  assert.equal(verifyContactProof(proof, 42, before, config, now), false);
});

test("directory selection survives filters, rejects a sixth add, and review names a shared mailbox", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-selection-flow-"));
  const app = runtime(dir);
  try {
    app.db.prepare("INSERT INTO recipients (id, type, email, is_active) VALUES (9001, 'politician', 'shared@example.org', 1), (9002, 'politician', 'shared@example.org', 1), (9003, 'politician', 'third@example.org', 1), (9004, 'politician', 'fourth@example.org', 1), (9005, 'politician', 'fifth@example.org', 1), (9006, 'politician', 'sixth@example.org', 1)").run();
    app.db.prepare("INSERT INTO recipient_translations (recipient_id, locale, name) VALUES (9001, 'en', 'Shared One'), (9002, 'en', 'Shared Two'), (9003, 'en', 'Third Person'), (9004, 'en', 'Fourth Person'), (9005, 'en', 'Fifth Person'), (9006, 'en', 'Sixth Person')").run();

    const page = await getForm(app.app, "/en/request");
    assert.match(page.html, /\/en\/request\/build\?recipient=1/);
    assert.doesNotMatch(page.html, /name="recipientId"/);

    const first = await postForm(app.app, "/en/request/selection", { csrf: page.csrf, add: "9001" }, page.cookie);
    assert.equal(first.status, 200);
    const firstHtml = await first.text();
    const selection = field(firstHtml, "selection");
    assert.ok(selection);
    assert.match(firstHtml, /1 people selected/);
    assert.match(firstHtml, /Shared One/);
    const firstCookie = first.headers.get("set-cookie")?.split(";")[0] ?? page.cookie;
    const firstCsrf = field(firstHtml, "csrf") ?? page.csrf;

    const filtered = await postForm(app.app, "/en/request", { csrf: firstCsrf, selection, q: "Sixth Person", page: "1" }, firstCookie);
    const filteredHtml = await filtered.text();
    assert.match(filteredHtml, /Sixth Person/);
    assert.doesNotMatch(filteredHtml, />Shared One</);
    assert.match(filteredHtml, /1 people selected/);
    assert.match(filteredHtml, /1 selected people are hidden by the current filters/);
    assert.equal(field(filteredHtml, "selection"), selection);
    let cookie = filtered.headers.get("set-cookie")?.split(";")[0] ?? firstCookie;
    const filteredCsrf = field(filteredHtml, "csrf") ?? firstCsrf;

    const suggest = await postForm(app.app, "/en/request/suggest", { csrf: filteredCsrf, q: "Sixth", selection }, cookie);
    const payload = await suggest.json() as { suggestions: { id: number }[] };
    assert.ok(payload.suggestions.some((row) => row.id === 9006));
    assert.equal(field(filteredHtml, "selection"), selection);

    const ids = ["9002", "9003", "9004", "9005"];
    let html = filteredHtml;
    let token = field(html, "selection") ?? selection;
    for (const id of ids) {
      const response = await postForm(app.app, "/en/request/selection", { csrf: field(html, "csrf") ?? filteredCsrf, selection: token, add: id }, cookie);
      html = await response.text();
      cookie = response.headers.get("set-cookie")?.split(";")[0] ?? cookie;
      token = field(html, "selection") ?? token;
    }
    assert.match(html, /5 people selected/);
    const sixth = await postForm(app.app, "/en/request/selection", { csrf: field(html, "csrf") ?? firstCsrf, selection: token, add: "9006" }, cookie);
    const sixthHtml = await sixth.text();
    assert.match(sixthHtml, /You can select up to 5 people/);
    assert.match(sixthHtml, /5 people selected/);
    assert.doesNotMatch(sixthHtml, /name="remove" value="9006"/);
    assert.match(sixthHtml, /name="add" value="9006"/);
    token = field(sixthHtml, "selection") ?? token;
    cookie = sixth.headers.get("set-cookie")?.split(";")[0] ?? cookie;
    const sixthCsrf = field(sixthHtml, "csrf") ?? firstCsrf;

    const parsed = readBasket(token, app.config);
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.deepEqual(parsed.basket.ids, [9001, 9002, 9003, 9004, 9005]);

    const review = await postForm(app.app, "/en/request/review", { csrf: sixthCsrf, selection: token }, cookie);
    assert.equal(review.status, 200);
    const reviewHtml = await review.text();
    assert.match(reviewHtml, /Shared One/);
    assert.match(reviewHtml, /Shared Two/);
    assert.match(reviewHtml, /shared@example\.org/);
    assert.match(reviewHtml, /2 people, 1 shared party address/);
    assert.match(reviewHtml, /Prepare questions/);
    assert.doesNotMatch(reviewHtml, /To:|CC:|BCC:/i);

    const tampered = await postForm(app.app, "/en/request", { csrf: sixthCsrf, selection: `${token}x`, q: "", page: "1" }, cookie);
    const tamperedHtml = await tampered.text();
    assert.match(tamperedHtml, /This selection could not be verified/);
    assert.doesNotMatch(tamperedHtml, /name="selection"/);

    const build = await app.app.request("/en/request/build?recipient=1");
    assert.equal(build.status, 200);
    assert.match(await build.text(), /name="recipientId" value="1"/);
  } finally {
    app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("multi handoff re-previews after a contact change and does not record a stale opened action", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-selection-handoff-"));
  const app = runtime(dir);
  try {
    app.db.prepare("INSERT INTO recipients (id, type, email, is_active) VALUES (9101, 'politician', 'alpha@example.org', 1), (9102, 'politician', 'beta@example.org', 1)").run();
    app.db.prepare("INSERT INTO recipient_translations (recipient_id, locale, name) VALUES (9101, 'en', 'Alpha Person'), (9102, 'en', 'Beta Person')").run();
    const page = await getForm(app.app, "/en/request");
    const added = await postForm(app.app, "/en/request/selection", { csrf: page.csrf, add: "9101" }, page.cookie);
    let html = await added.text();
    let cookie = added.headers.get("set-cookie")?.split(";")[0] ?? page.cookie;
    let token = field(html, "selection") ?? "";
    const second = await postForm(app.app, "/en/request/selection", { csrf: field(html, "csrf") ?? page.csrf, selection: token, add: "9102" }, cookie);
    html = await second.text();
    cookie = second.headers.get("set-cookie")?.split(";")[0] ?? cookie;
    token = field(html, "selection") ?? token;
    const csrf = field(html, "csrf") ?? page.csrf;

    const review = await postForm(app.app, "/en/request/review", { csrf, selection: token }, cookie);
    const reviewHtml = await review.text();
    cookie = review.headers.get("set-cookie")?.split(";")[0] ?? cookie;
    const compose = await postForm(app.app, "/en/request/build", { csrf: field(reviewHtml, "csrf") ?? csrf, selection: field(reviewHtml, "selection") ?? token }, cookie);
    const composeHtml = await compose.text();
    assert.match(composeHtml, /name="recipientId" value="9101"/);
    assert.match(composeHtml, /name="selection"/);
    cookie = compose.headers.get("set-cookie")?.split(";")[0] ?? cookie;

    const preview = await postForm(app.app, "/en/request/preview", {
      csrf: field(composeHtml, "csrf") ?? csrf,
      selection: field(composeHtml, "selection") ?? token,
      recipientId: "9101",
      demandId: "1",
      messageLocale: "en"
    }, cookie);
    const previewHtml = await preview.text();
    cookie = preview.headers.get("set-cookie")?.split(";")[0] ?? cookie;
    assert.match(previewHtml, /name="contactProof"/);
    const requestId = field(previewHtml, "requestId");
    const capability = field(previewHtml, "capability");
    const proof = field(previewHtml, "contactProof");
    const previewSelection = field(previewHtml, "selection");
    assert.ok(requestId && capability && proof);

    app.db.prepare("UPDATE recipients SET email = 'changed@example.org' WHERE id = 9101").run();
    const stale = await postForm(app.app, "/en/request/action", {
      csrf: field(previewHtml, "csrf") ?? csrf,
      requestId,
      capability,
      contactProof: proof,
      selection: previewSelection ?? "",
      action: "email_opened",
      subject: "S",
      message: "M"
    }, cookie);
    assert.equal(stale.status, 422);
    assert.match(await stale.text(), /Contact details changed/);
    assert.equal(app.db.prepare("SELECT count(*) AS count FROM request_actions WHERE generated_request_id = ?").get(Number(requestId))?.count, 0);

    const freshPreview = await postForm(app.app, "/en/request/preview", {
      csrf: field(composeHtml, "csrf") ?? csrf,
      selection: field(composeHtml, "selection") ?? token,
      recipientId: "9101",
      demandId: "1",
      messageLocale: "en"
    }, cookie);
    const freshHtml = await freshPreview.text();
    const opened = await postForm(app.app, "/en/request/action", {
      csrf: field(freshHtml, "csrf") ?? csrf,
      requestId: field(freshHtml, "requestId") ?? "",
      capability: field(freshHtml, "capability") ?? "",
      contactProof: field(freshHtml, "contactProof") ?? "",
      selection: field(freshHtml, "selection") ?? "",
      action: "email_opened",
      subject: "S",
      message: "M"
    }, cookie);
    assert.equal(opened.status, 200);
    const openedHtml = await opened.text();
    assert.match(openedHtml, /mailto:changed@example\.org/);
    assert.match(openedHtml, /Next person/);
    assert.doesNotMatch(openedHtml, /mailto:alpha@example\.org/);
  } finally {
    app.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("handoff remaining ids advance without storing the basket", () => {
  const started = beginHandoff({ ...emptyBasket(now), ids: [1, 2] }, [4]);
  assert.ok(started);
  const next = completeCurrent(started);
  assert.deepEqual(next.handoff?.remainingIds, [2]);
  assert.deepEqual(completeCurrent(next).handoff?.remainingIds, []);
});

test("remove drops an id without changing the others", () => {
  const eligible = new Set([1, 2]);
  const one = addRecipient(emptyBasket(now), 1, eligible, now).basket;
  const two = addRecipient(one, 2, eligible, now).basket;
  assert.deepEqual(removeRecipient(two, 1, now).ids, [2]);
});

async function getForm(app: ReturnType<typeof createApp>["app"], path: string) {
  const response = await app.request(path);
  assert.equal(response.status, 200, path);
  const html = await response.text();
  const csrf = field(html, "csrf");
  assert.ok(csrf, html);
  return { csrf, cookie: response.headers.get("set-cookie")?.split(";")[0] ?? "", html };
}

function postForm(app: ReturnType<typeof createApp>["app"], path: string, values: Record<string, string>, cookie: string) {
  return app.request(path, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie },
    body: new URLSearchParams(values)
  });
}

function field(html: string, name: string) {
  return html.match(new RegExp(`name="${name}" value="([^"]+)"`))?.[1];
}
