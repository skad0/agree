import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { openDatabase } from "../src/db.js";
import { fetchBounded } from "../src/integrations/elections/http.js";
import { insertElection, insertSourceSnapshot } from "../src/integrations/elections/repository.js";
import { loadSourceManifest, parseSourceManifest } from "../src/integrations/elections/source-manifest.js";

const fixture = join(process.cwd(), "test/fixtures/elections/source-manifest.v1.json");

test("openDatabase applies election directory schema with clean foreign keys", () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-election-schema-"));
  try {
    const db = openDatabase(join(dir, "app.db"));
    const applied = db.prepare("SELECT 1 FROM schema_migrations WHERE name = '016_election_directory.sql'").get();
    assert.ok(applied);
    assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'finance_reports'").get(), undefined);
    const fk = db.prepare("PRAGMA foreign_key_check").all();
    assert.deepEqual(fk, []);
    const snapshotId = insertSourceSnapshot(db, {
      source: "cec",
      resourceId: "597e0059-099e-4200-9131-b3ba645bc685",
      url: "https://data.gov.il/api/3/action/datastore_search?resource_id=597e0059-099e-4200-9131-b3ba645bc685",
      fetchedAt: "2026-09-07T00:00:00.000Z",
      contentHash: "abc",
      parserVersion: "1",
      extractionState: "complete"
    });
    const electionId = insertElection(db, { number: 21, publicationStatus: "historical", snapshotId });
    db.prepare("INSERT INTO electoral_lists (election_id, official_list_key, ballot_letters, title_he, snapshot_id) VALUES (?, 'list-a', 'אמת', 'רשימה', ?)").run(electionId, snapshotId);
    db.prepare("INSERT INTO people (knesset_person_id, given_name, family_name, created_at) VALUES ('p1', 'שם', 'משפחה', '2026-09-07T00:00:00.000Z')").run();
    db.prepare("INSERT INTO candidacies (election_id, list_id, person_id, status) VALUES (?, 1, 1, 'active')").run(electionId);
    db.prepare("INSERT INTO source_records (snapshot_id, record_key, payload_json) VALUES (?, '1', '{}')").run(snapshotId);
    db.prepare("INSERT INTO candidacy_versions (candidacy_id, snapshot_id, list_id, source_record_id, rank, given_name_raw, family_name_raw, status) VALUES (1, ?, 1, 1, 1, 'שם', 'משפחה', 'listed')").run(snapshotId);
    assert.throws(() => db.prepare("INSERT INTO candidacy_versions (candidacy_id, snapshot_id, list_id, rank, given_name_raw, family_name_raw, status) VALUES (1, ?, 1, 0, 'שם', 'משפחה', 'listed')").run(snapshotId));
    assert.equal(db.prepare("SELECT count(*) n FROM candidacies").get()?.n, 1);
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("owner CHECKs reject missing or dual owners", () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-election-check-"));
  try {
    const db = openDatabase(join(dir, "app.db"));
    db.prepare("INSERT INTO people (created_at) VALUES ('2026-09-07T00:00:00.000Z')").run();
    db.prepare("INSERT INTO parties (name_he) VALUES ('מפלגה')").run();
    assert.throws(() => db.prepare("INSERT INTO contact_points (channel, value_normalized) VALUES ('email', 'a@example.org')").run());
    assert.throws(() => db.prepare("INSERT INTO contact_points (person_id, party_id, channel, value_normalized) VALUES (1, 1, 'email', 'a@example.org')").run());
    db.prepare("INSERT INTO contact_points (person_id, channel, value_normalized) VALUES (1, 'email', 'a@example.org')").run();
    assert.throws(() => db.prepare("INSERT INTO entity_translations (locale, label, review_state) VALUES ('uk', 'שם', 'accepted')").run());
    db.prepare("INSERT INTO entity_translations (person_id, locale, label, review_state) VALUES (1, 'uk', 'שם', 'accepted')").run();
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("source manifest loads verified CEC 19-24 ids and fails closed on invalid config", () => {
  const manifest = loadSourceManifest(fixture);
  assert.equal(manifest.version, 1);
  const cec = manifest.sources[0];
  assert.equal(cec?.packageId, "candidates-lists");
  const verified = cec?.resources.filter((resource) => resource.status === "verified") ?? [];
  assert.deepEqual(verified.map((resource) => resource.electionNumber), [19, 20, 21, 22, 23, 24]);
  assert.equal(verified.find((resource) => resource.electionNumber === 21)?.resourceId, "597e0059-099e-4200-9131-b3ba645bc685");
  assert.equal(cec?.resources.find((resource) => resource.electionNumber === 25)?.status, "blocked");
  assert.throws(() => parseSourceManifest({}), /version/);
  assert.throws(() => parseSourceManifest({
    version: 1, parserVersion: "1", limits: { timeoutMs: 1, maxBytes: 1, maxRecords: 1 },
    allowedHosts: ["evil.example"], sources: [{ id: "x", kind: "ckan_package", status: "verified", hosts: ["data.gov.il"], resources: [] }]
  }), /allowedHosts/);
});

test("bounded fetch rejects hosts outside the allowlist", async () => {
  await assert.rejects(
    () => fetchBounded({ url: "https://evil.example/data", allowedHosts: ["data.gov.il"], timeoutMs: 1000, maxBytes: 100 }),
    /allowlisted/
  );
});
