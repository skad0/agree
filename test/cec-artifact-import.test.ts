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
    assert.equal(result.unchanged, false);
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

test("re-import replaces draft, is content-hash idempotent, and leaves active untouched", () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-cec-reimport-"));
  try {
    const db = openDatabase(join(dir, "app.db"));
    const artifact = loadCecClosedListArtifact(fixturePath);
    const first = importCecClosedListArtifact(db, artifact, {
      targetElectionNumber: 26,
      artifactRef: fixturePath
    });
    assert.equal(first.unchanged, false);
    assert.equal(first.publicationStatus, "draft");

    // Separate accepted→active publication; draft refresh must not touch it.
    const accepted = insertDirectoryPublication(db, {
      electionId: first.electionId,
      version: 100,
      status: "accepted",
      snapshotId: first.snapshotId,
      previousPublicationId: first.publicationId
    });
    assert.equal(activateDirectoryPublication(db, accepted), true);
    const activeBefore = electionCoverage(db).activePublications;
    assert.equal(activeBefore, 1);

    // Identical file while matching draft exists → no-op.
    const noop = importCecClosedListArtifact(db, artifact, {
      targetElectionNumber: 26,
      artifactRef: fixturePath
    });
    assert.equal(noop.unchanged, true);
    assert.equal(noop.publicationId, first.publicationId);
    assert.equal(getDirectoryPublication(db, accepted)?.status, "active");
    assert.equal(electionCoverage(db).activePublications, activeBefore);

    // Changed artifact replaces the draft and reuses list/rank identities.
    const updated = {
      ...artifact,
      source: { ...artifact.source, notes: "operator refresh" },
      rows: [
        ...artifact.rows,
        {
          listTitleHe: "רשימת בדיקה ב",
          ballotLetters: "ב",
          rank: 2,
          familyNameHe: "פרץ",
          givenNameHe: "אורי",
          officialListKey: "fixture-list-b",
          status: "listed" as const
        }
      ]
    };
    const second = importCecClosedListArtifact(db, updated, {
      targetElectionNumber: 26,
      artifactRef: "refresh.json"
    });
    assert.equal(second.unchanged, false);
    assert.equal(second.publicationStatus, "draft");
    assert.ok(second.replacedDraftPublicationIds.includes(first.publicationId));
    assert.equal(second.activePublicationId, accepted);
    assert.equal(getDirectoryPublication(db, accepted)?.status, "active");
    assert.equal(getDirectoryPublication(db, first.publicationId)?.status, "rolled_back");
    assert.equal(electionCoverage(db).activePublications, activeBefore);
    assert.equal(second.listCount, 2);
    assert.equal(second.candidacyCount, 4);
    assert.equal(second.listsUpdated, 2);
    assert.equal(second.candidaciesReused, 3);

    const third = importCecClosedListArtifact(db, updated, {
      targetElectionNumber: 26,
      artifactRef: "refresh.json"
    });
    assert.equal(third.unchanged, true);
    assert.equal(third.publicationId, second.publicationId);
    assert.equal(electionCoverage(db).activePublications, activeBefore);

    const lists = db.prepare(
      `SELECT official_list_key AS k, ballot_letters AS b FROM electoral_lists WHERE election_id = ? ORDER BY k`
    ).all(first.electionId) as { k: string; b: string | null }[];
    assert.deepEqual(lists.map((row) => row.k), ["fixture-list-a", "fixture-list-b"]);
    assert.deepEqual(lists.map((row) => row.b), ["א", "ב"]);
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
