import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createApp } from "../src/app.js";
import { openDatabase } from "../src/db.js";
import {
  currentQuestionVersionForDemand,
  displayStanceForRecipient,
  displayStanceForSubjects,
  retractStance,
  saveQuestionVersion,
  saveStance
} from "../src/stances.js";

const PRIVATE_TEXT = "SECRET_CONFIRMED_REPLY_SHOULD_NEVER_LEAK";
const PRIVATE_EMAIL = "secret.reply@example.org";

test("stance module never reads private submitted responses", () => {
  const source = readFileSync(new URL("../src/stances.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /submitted_responses/);
});

test("stance copy keys exist in every locale file", () => {
  const keys = [
    "stancePositionOn", "stanceNone", "stanceUnknown", "stancePartyOnly", "stanceListOnly",
    "stanceHistorical", "stanceUnderReview", "stanceMultiple", "stanceSupports",
    "stanceSupportsWithReservations", "stanceOpposes", "stanceStatementAvailable",
    "stanceSource", "stanceMethodology", "methodologyStance"
  ];
  for (const locale of ["he", "ar", "yi", "ru", "uk", "en", "am"]) {
    const dict = JSON.parse(readFileSync(new URL(`../../src/locales/${locale}.json`, import.meta.url), "utf8")) as Record<string, string>;
    for (const key of keys) assert.equal(typeof dict[key], "string", `${locale}.${key}`);
  }
});

test("reviewed stances distinguish person from party, unknown, history, and retraction", () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-stance-model-"));
  const db = openDatabase(join(dir, "app.db"));
  try {
    const fixture = insertDirectoryFixture(db);

    assert.deepEqual(displayStanceForRecipient(db, fixture.personRecipientId, null, "en"), { state: "none" });
    assert.equal(displayStanceForRecipient(db, fixture.personRecipientId, fixture.currentVersionId, "en").state, "unknown");

    saveStance(db, {
      subject: { kind: "party", partyId: fixture.partyId },
      questionVersionId: fixture.currentVersionId,
      classification: "supports",
      summary: "Party would disclose the coalition.",
      sourceUrl: "https://example.org/party-stance",
      statementAt: "2026-08-01"
    }, "published");

    const partyOnly = displayStanceForRecipient(db, fixture.personRecipientId, fixture.currentVersionId, "en");
    assert.equal(partyOnly.state, "published");
    if (partyOnly.state === "published") {
      assert.equal(partyOnly.attribution, "party");
      assert.equal(partyOnly.individualUnknown, true);
      assert.equal(partyOnly.historical, false);
      assert.equal(partyOnly.classification, "supports");
      assert.equal(partyOnly.summary, "Party would disclose the coalition.");
    }
    const partySelf = displayStanceForRecipient(db, fixture.partyRecipientId, fixture.currentVersionId, "en");
    assert.equal(partySelf.state, "published");
    if (partySelf.state === "published") {
      assert.equal(partySelf.attribution, "party");
      assert.equal(partySelf.individualUnknown, false);
    }

    const personDraft = saveStance(db, {
      subject: { kind: "person", personId: fixture.personId },
      questionVersionId: fixture.currentVersionId,
      classification: "opposes",
      summary: "Ada opposes this wording.",
      sourceUrl: "https://example.org/ada-stance",
      statementAt: "2026-08-15"
    }, "draft");
    assert.equal(personDraft.ok, true);
    const stillParty = displayStanceForRecipient(db, fixture.personRecipientId, fixture.currentVersionId, "en");
    assert.equal(stillParty.state, "published");
    if (stillParty.state === "published") assert.equal(stillParty.attribution, "party");

    saveStance(db, {
      id: personDraft.ok ? personDraft.id : undefined,
      subject: { kind: "person", personId: fixture.personId },
      questionVersionId: fixture.currentVersionId,
      classification: "opposes",
      summary: "Ada opposes this wording.",
      sourceUrl: "https://example.org/ada-stance",
      statementAt: "2026-08-15"
    }, "published");
    const personal = displayStanceForRecipient(db, fixture.personRecipientId, fixture.currentVersionId, "en");
    assert.equal(personal.state, "published");
    if (personal.state === "published") {
      assert.equal(personal.attribution, "person");
      assert.equal(personal.individualUnknown, false);
      assert.equal(personal.classification, "opposes");
    }
    assert.equal(displayStanceForRecipient(db, fixture.personRecipientId, 999999, "en").state, "unknown");
    const otherDemand = db.prepare("SELECT id FROM demands WHERE document = 'standard' AND is_active = 1 AND id != ? LIMIT 1").get(fixture.demandId) as { id: number } | undefined;
    assert.ok(otherDemand);
    const otherVersion = saveQuestionVersion(db, { demandId: otherDemand.id, semanticVersion: "1.0.0", reviewed: true });
    assert.equal(otherVersion.ok, true);
    if (otherVersion.ok) {
      assert.equal(displayStanceForRecipient(db, fixture.personRecipientId, otherVersion.id, "en").state, "unknown");
    }

    const older = saveStance(db, {
      subject: { kind: "person", personId: fixture.unlinkedPersonId },
      questionVersionId: fixture.oldVersionId,
      classification: "supports_with_reservations",
      summary: "Earlier wording only.",
      sourceUrl: "https://example.org/old",
      statementAt: "2025-01-01"
    }, "published");
    assert.equal(older.ok, true);
    const historical = displayStanceForSubjects(db, { personId: fixture.unlinkedPersonId }, fixture.currentVersionId, "en");
    assert.equal(historical.state, "published");
    if (historical.state === "published") {
      assert.equal(historical.historical, true);
      assert.equal(historical.classification, "supports_with_reservations");
    }

    if (older.ok) {
      retractStance(db, older.id);
      assert.equal(displayStanceForSubjects(db, { personId: fixture.unlinkedPersonId }, fixture.currentVersionId, "en").state, "unknown");
    }

    const stanceCount = Number(db.prepare("SELECT count(*) AS count FROM public_stances").get()?.count);
    db.prepare(`INSERT INTO submitted_responses
      (recipient_id, received_at, channel, response_text, submitter_email, consent_at, status, created_at)
      VALUES (?, '2026-01-01', 'email', ?, ?, 'now', 'confirmed', 'now')`).run(fixture.personRecipientId, PRIVATE_TEXT, PRIVATE_EMAIL);
    assert.equal(db.prepare("SELECT count(*) AS count FROM public_stances").get()?.count, stanceCount);
    assert.equal(db.prepare("SELECT count(*) AS count FROM public_stances WHERE publication_state = 'published'").get()?.count, 2);
    assert.equal(displayStanceForRecipient(db, fixture.personRecipientId, fixture.currentVersionId, "en").state, "published");
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("only admins can publish stances and private replies never appear on the directory", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-stance-http-"));
  try {
    const runtime = createApp({ sqlitePath: join(dir, "app.db"), env: { NODE_ENV: "test", SESSION_SECRET: "test-secret", ADMIN_EMAILS: "admin@example.org" } });
    const fixture = insertDirectoryFixture(runtime.db);
    runtime.db.prepare(`INSERT INTO submitted_responses
      (recipient_id, received_at, channel, response_text, submitter_email, consent_at, status, created_at)
      VALUES (?, '2026-01-01', 'email', ?, ?, 'now', 'confirmed', 'now')`).run(fixture.personRecipientId, PRIVATE_TEXT, PRIVATE_EMAIL);

    assert.equal((await runtime.app.request("/admin/stances")).status, 403);
    runtime.db.prepare("INSERT INTO admins (email, role) VALUES ('moderator@example.org', 'moderator')").run();
    const moderator = { "X-Test-Admin-Email": "moderator@example.org" };
    assert.equal((await runtime.app.request("/admin/stances", { headers: moderator })).status, 403);
    assert.equal((await postForm(runtime.app, "/admin/stances", {
      csrf: "ignored", action: "publish", subjectKind: "person", subjectId: String(fixture.personId),
      questionVersionId: String(fixture.currentVersionId), classification: "supports",
      sourceUrl: "https://example.org/nope", statementAt: "2026-08-01", summary: PRIVATE_TEXT
    }, "", moderator)).status, 403);

    const admin = { "X-Test-Admin-Email": "admin@example.org" };
    const page = await getForm(runtime.app, "/admin/stances", admin);
    const denied = await postForm(runtime.app, "/admin/stances", {
      csrf: "nope", action: "publish", subjectKind: "person", subjectId: String(fixture.personId),
      questionVersionId: String(fixture.currentVersionId), classification: "supports",
      sourceUrl: "https://example.org/ada", statementAt: "2026-08-01", summary: "Ada supports disclosure."
    }, page.cookie, admin);
    assert.equal(denied.status, 403);

    const created = await postForm(runtime.app, "/admin/stances", {
      csrf: page.csrf, action: "publish", subjectKind: "person", subjectId: String(fixture.personId),
      questionVersionId: String(fixture.currentVersionId), classification: "supports",
      sourceUrl: "https://example.org/ada", statementAt: "2026-08-01", summary: "Ada supports disclosure."
    }, page.cookie, admin);
    assert.equal(created.status, 303);
    const stanceId = Number(runtime.db.prepare("SELECT id FROM public_stances WHERE publication_state = 'published'").get()?.id);
    assert.ok(stanceId);
    const audit = runtime.db.prepare("SELECT action, entity, payload FROM admin_audit_events ORDER BY id DESC LIMIT 1").get() as { action: string; entity: string; payload: string };
    assert.equal(audit.action, "publish");
    assert.equal(audit.entity, "stance");
    assert.match(audit.payload, /"id":/);
    assert.doesNotMatch(audit.payload, new RegExp(PRIVATE_TEXT));
    assert.doesNotMatch(audit.payload, /Ada supports disclosure/);

    const directoryGet = await getForm(runtime.app, `/en/request?demand=${fixture.demandId}`);
    assert.match(directoryGet.html, /Position on/);
    assert.match(directoryGet.html, /No verified position available/);
    const directory = await postForm(runtime.app, "/en/request", {
      csrf: directoryGet.csrf, q: "Ada Fixture", page: "1", questionVersionId: String(fixture.currentVersionId)
    }, directoryGet.cookie);
    assert.equal(directory.status, 200);
    const directoryHtml = await directory.text();
    assert.match(directoryHtml, /Ada supports disclosure/);
    assert.match(directoryHtml, /https:\/\/example.org\/ada/);
    assert.doesNotMatch(directoryHtml, new RegExp(PRIVATE_TEXT));
    assert.doesNotMatch(directoryHtml, new RegExp(PRIVATE_EMAIL.replace(".", "\\.")));
    assert.doesNotMatch(directoryHtml, /endorsement|leaderboard|score/i);

    const retracted = await postForm(runtime.app, "/admin/stances", {
      csrf: page.csrf, action: "retract", id: String(stanceId)
    }, page.cookie, admin);
    assert.equal(retracted.status, 303);
    const after = await postForm(runtime.app, "/en/request", {
      csrf: directoryGet.csrf, q: "Ada Fixture", page: "1", questionVersionId: String(fixture.currentVersionId)
    }, directoryGet.cookie);
    const afterHtml = await after.text();
    assert.doesNotMatch(afterHtml, /Ada supports disclosure/);
    assert.match(afterHtml, /No verified position available/);

    const build = await runtime.app.request(`/en/request/build?recipient=${fixture.personRecipientId}&demand=${fixture.demandId}`);
    assert.match(await build.text(), /No verified position available/);

    const fresh = await getForm(runtime.app, "/en/request");
    assert.match(fresh.html, /Position on/);
    assert.doesNotMatch(fresh.html, /No verified position available/);
    assert.doesNotMatch(fresh.html, /Ada supports disclosure/);

    runtime.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

function insertDirectoryFixture(db: ReturnType<typeof openDatabase>) {
  const now = "2026-09-07T00:00:00.000Z";
  const demandId = Number((db.prepare("SELECT id FROM demands WHERE document = 'standard' ORDER BY sort_order, id LIMIT 1").get() as { id: number }).id);
  const oldVersion = saveQuestionVersion(db, { demandId, semanticVersion: "1.0.0", reviewed: true });
  const currentVersion = saveQuestionVersion(db, { demandId, semanticVersion: "1.1.0", reviewed: true });
  assert.equal(oldVersion.ok && currentVersion.ok, true);
  const oldVersionId = oldVersion.ok ? oldVersion.id : 0;
  const currentVersionId = currentVersion.ok ? currentVersion.id : 0;
  assert.equal(currentQuestionVersionForDemand(db, demandId), currentVersionId);

  const personId = Number((db.prepare("INSERT INTO people (display_name, created_at) VALUES ('Ada Fixture', ?) RETURNING id").get(now) as { id: number }).id);
  const unlinkedPersonId = Number((db.prepare("INSERT INTO people (display_name, created_at) VALUES ('Bo Unlinked', ?) RETURNING id").get(now) as { id: number }).id);
  const partyId = Number((db.prepare("INSERT INTO parties (name_he) VALUES ('Fixture Party') RETURNING id").get() as { id: number }).id);
  const electionId = Number((db.prepare("INSERT INTO elections (number, publication_status) VALUES (26, 'announced') RETURNING id").get() as { id: number }).id);
  const listId = Number((db.prepare("INSERT INTO electoral_lists (election_id, title_he) VALUES (?, 'Fixture List') RETURNING id").get(electionId) as { id: number }).id);
  const candidacyId = Number((db.prepare("INSERT INTO candidacies (election_id, list_id, person_id, status) VALUES (?, ?, ?, 'active') RETURNING id")
    .get(electionId, listId, personId) as { id: number }).id);
  db.prepare("INSERT INTO candidacy_party_memberships (candidacy_id, party_id, review_state) VALUES (?, ?, 'accepted')").run(candidacyId, partyId);

  const personRecipientId = 9201;
  const partyRecipientId = 9202;
  db.prepare("INSERT INTO recipients (id, type, email, is_active) VALUES (?, 'politician', 'ada@example.org', 1)").run(personRecipientId);
  db.prepare("INSERT INTO recipient_translations (recipient_id, locale, name) VALUES (?, 'en', 'Ada Fixture')").run(personRecipientId);
  db.prepare("INSERT INTO recipients (id, type, email, is_active) VALUES (?, 'party', 'party@example.org', 1)").run(partyRecipientId);
  db.prepare("INSERT INTO recipient_translations (recipient_id, locale, name) VALUES (?, 'en', 'Fixture Party')").run(partyRecipientId);
  db.prepare("INSERT INTO recipient_entity_links (recipient_id, person_id, review_state, created_at) VALUES (?, ?, 'accepted', ?)").run(personRecipientId, personId, now);
  db.prepare("INSERT INTO recipient_entity_links (recipient_id, party_id, review_state, created_at) VALUES (?, ?, 'accepted', ?)").run(partyRecipientId, partyId, now);

  return { demandId, oldVersionId, currentVersionId, personId, unlinkedPersonId, partyId, personRecipientId, partyRecipientId };
}

async function getForm(app: ReturnType<typeof createApp>["app"], path: string, headers: Record<string, string> = {}) {
  const response = await app.request(path, { headers });
  assert.equal(response.status, 200, path);
  const html = await response.text();
  const csrf = html.match(/name="csrf" value="([^"]+)"/)?.[1];
  assert.ok(csrf, html);
  return { csrf, cookie: response.headers.get("set-cookie")?.split(";")[0] ?? "", html };
}

function postForm(app: ReturnType<typeof createApp>["app"], path: string, values: Record<string, string>, cookie: string, headers: Record<string, string> = {}) {
  return app.request(path, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie, ...headers },
    body: new URLSearchParams(values)
  });
}
