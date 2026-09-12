import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { openDatabase } from "../src/db.js";
import {
  electionCoverage,
  importCecClosedListArtifact,
  loadCecClosedListArtifact,
  parseCecClosedListArtifact,
  resolveContact
} from "../src/integrations/elections/index.js";
import {
  activateDirectoryPublication,
  getDirectoryPublication,
  insertDirectoryPublication
} from "../src/integrations/elections/repository.js";
import { getContactableRecipient, listContactableRecipients } from "../src/recipients.js";

const fixturePath = join(process.cwd(), "test/fixtures/elections/cec-knesset-26-closed-lists.fixture.json");

test("CEC closed-list artifact parses fixture rows", () => {
  const artifact = loadCecClosedListArtifact(fixturePath);
  assert.equal(artifact.electionNumber, 26);
  assert.equal(artifact.source.artifactKind, "fixture");
  assert.equal(artifact.rows.length, 3);
  assert.throws(() => parseCecClosedListArtifact({ ...artifact, schemaVersion: 2 }), /schemaVersion/);
});

test("importCecClosedListArtifact stages draft publication and never activates", () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-cec-artifact-"));
  try {
    const db = openDatabase(join(dir, "app.db"));
    const artifact = loadCecClosedListArtifact(fixturePath);
    const before = electionCoverage(db).activePublications;
    const result = importCecClosedListArtifact(db, artifact, {
      targetElectionNumber: 26,
      artifactRef: fixturePath
    });
    assert.equal(result.ok, true);
    assert.equal(result.publicationStatus, "draft");
    assert.equal(result.listCount, 2);
    assert.equal(result.candidacyCount, 3);
    assert.equal(getDirectoryPublication(db, result.publicationId)?.status, "draft");
    assert.equal(electionCoverage(db).activePublications, before);
    assert.throws(
      () => importCecClosedListArtifact(db, artifact, { targetElectionNumber: 25, artifactRef: "x" }),
      /does not match/
    );
    assert.equal(activateDirectoryPublication(db, result.publicationId), false);
    assert.equal(electionCoverage(db).activePublications, before);
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("party-fallback destination can make a recipient contactable without inventing email", () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-party-fallback-"));
  try {
    const db = openDatabase(join(dir, "app.db"));
    const now = "2026-09-12T00:00:00.000Z";
    const electionId = Number((db.prepare("INSERT INTO elections (number, publication_status) VALUES (26, 'lists_published') RETURNING id").get() as { id: number }).id);
    const listId = Number((db.prepare("INSERT INTO electoral_lists (election_id, title_he) VALUES (?, 'רשימה') RETURNING id").get(electionId) as { id: number }).id);
    const partyId = Number((db.prepare("INSERT INTO parties (name_he) VALUES ('מפלגה') RETURNING id").get() as { id: number }).id);
    const personId = Number((db.prepare("INSERT INTO people (display_name, created_at) VALUES ('Candidate', ?) RETURNING id").get(now) as { id: number }).id);
    const candidacyId = Number((db.prepare("INSERT INTO candidacies (election_id, list_id, person_id, status) VALUES (?, ?, ?, 'active') RETURNING id")
      .get(electionId, listId, personId) as { id: number }).id);
    db.prepare("INSERT INTO recipients (id, type, email, whatsapp, is_active) VALUES (9201, 'politician', NULL, NULL, 1)").run();
    db.prepare("INSERT INTO recipient_translations (recipient_id, locale, name) VALUES (9201, 'he', 'מועמדת ללא מייל')").run();
    db.prepare("INSERT INTO recipient_entity_links (recipient_id, person_id, review_state, created_at) VALUES (9201, ?, 'accepted', ?)")
      .run(personId, now);

    assert.equal(getContactableRecipient(db, "he", 9201), undefined);

    const resolution = resolveContact(db, {
      candidacyId,
      partyId,
      partyEmail: "mailto:Party.Desk@Example.ORG"
    });
    assert.equal(resolution.level, "party_fallback");

    const accepted = insertDirectoryPublication(db, { electionId, version: 1, status: "accepted" });
    assert.equal(activateDirectoryPublication(db, accepted, now), true);

    const contactable = getContactableRecipient(db, "he", 9201);
    assert.equal(contactable?.email, "party.desk@example.org");
    assert.equal(contactable?.whatsapp, null);
    assert.ok(listContactableRecipients(db, "he").some((row) => row.id === 9201 && row.email === "party.desk@example.org"));
    assert.equal(db.prepare("SELECT count(*) AS n FROM contact_points WHERE value_normalized = 'invented@example.org'").get()?.n, 0);
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
