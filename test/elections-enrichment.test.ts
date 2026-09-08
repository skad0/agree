import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { openDatabase } from "../src/db.js";
import {
  acceptIdentityMatch,
  acquireJobLease,
  checkpointJob,
  ensureEtlJob,
  gateFinanceSource,
  gateSourceResource,
  loadFinanceCoverage,
  loadSourceManifest,
  normalizeEmail,
  proposeIdentityMatch,
  rejectIdentityMatch,
  releaseJobLease,
  resolveContact,
  runEnrichmentPipeline,
  summarizeFinanceEntries,
  verifyLeaseToken
} from "../src/integrations/elections/index.js";
import type { FinanceFixtureEntry } from "../src/integrations/elections/types.js";

const manifestPath = join(process.cwd(), "test/fixtures/elections/source-manifest.v1.json");
const financeFixturePath = join(process.cwd(), "test/fixtures/elections/finance-entries.v1.json");

test("identity matching proposes pending rows and accept/reject never invent knesset ids", () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-match-"));
  try {
    const db = openDatabase(join(dir, "app.db"));
    const personId = Number((db.prepare("INSERT INTO people (display_name, created_at) VALUES ('David', ?) RETURNING id")
      .get("2026-09-08T00:00:00.000Z") as { id: number }).id);
    const pending = proposeIdentityMatch(db, {
      personId,
      givenName: "דָּוִד",
      familyName: "כהן",
      score: 0.81,
      features: { tokens: 2 }
    });
    assert.equal(pending.state, "pending");
    assert.equal(pending.algorithmVersion, "1");
    assert.equal(pending.normalizedKey, "דוד כהן");
    assert.equal(pending.proposedKnessetPersonId, null);
    assert.equal(db.prepare("SELECT knesset_person_id FROM people WHERE id = ?").get(personId)?.knesset_person_id, null);

    const accepted = acceptIdentityMatch(db, pending.id, "reviewer@example.org", "unique name");
    assert.equal(accepted?.state, "accepted");
    assert.equal(db.prepare("SELECT knesset_person_id FROM people WHERE id = ?").get(personId)?.knesset_person_id, null);
    assert.equal(db.prepare("SELECT count(*) n FROM recipient_entity_links").get()?.n, 0);

    const second = proposeIdentityMatch(db, { personId, givenName: "דוד", familyName: "לוי", score: 0.4 });
    const rejected = rejectIdentityMatch(db, second.id, "reviewer@example.org");
    assert.equal(rejected?.state, "rejected");
    assert.equal(acceptIdentityMatch(db, second.id, "reviewer@example.org"), undefined);
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("contact normalize and resolve prefer individual then party fallback", () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-contact-"));
  try {
    const db = openDatabase(join(dir, "app.db"));
    const now = "2026-09-08T00:00:00.000Z";
    assert.equal(normalizeEmail("mailto:Ada@Example.ORG"), "ada@example.org");
    assert.equal(normalizeEmail("not-an-email"), null);
    assert.equal(normalizeEmail("mailto:"), null);

    const electionId = Number((db.prepare("INSERT INTO elections (number, publication_status) VALUES (24, 'historical') RETURNING id").get() as { id: number }).id);
    const listId = Number((db.prepare("INSERT INTO electoral_lists (election_id, title_he) VALUES (?, 'List') RETURNING id").get(electionId) as { id: number }).id);
    const personId = Number((db.prepare("INSERT INTO people (created_at) VALUES (?) RETURNING id").get(now) as { id: number }).id);
    const partyId = Number((db.prepare("INSERT INTO parties (name_he, email) VALUES ('Party', 'party@example.org') RETURNING id").get() as { id: number }).id);
    const candidacyId = Number((db.prepare("INSERT INTO candidacies (election_id, list_id, person_id, status) VALUES (?, ?, ?, 'active') RETURNING id")
      .get(electionId, listId, personId) as { id: number }).id);

    const individual = resolveContact(db, { candidacyId, personEmail: "mailto:Ada@Example.ORG", partyId, partyEmail: "party@example.org" });
    assert.equal(individual.level, "individual");
    assert.equal(individual.ownerKind, "person");

    const fallbackCandidacy = Number((db.prepare("INSERT INTO candidacies (election_id, list_id, person_id, status) VALUES (?, ?, NULL, 'active') RETURNING id")
      .get(electionId, listId) as { id: number }).id);
    const fallback = resolveContact(db, { candidacyId: fallbackCandidacy, partyId, partyEmail: "mailto:Party@Example.ORG" });
    assert.equal(fallback.level, "party_fallback");
    assert.equal(fallback.ownerKind, "party");

    const unresolved = resolveContact(db, { candidacyId: fallbackCandidacy, partyEmail: "bad" });
    assert.equal(unresolved.level, "unresolved");
    assert.equal(db.prepare("SELECT count(*) n FROM contact_points WHERE value_normalized = 'invented@example.org'").get()?.n, 0);
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("finance summarize keeps coverage tags and refuses blocked source", () => {
  const manifest = loadSourceManifest(manifestPath);
  const financeGate = gateFinanceSource(manifest.sources);
  assert.equal(financeGate.ok, false);
  if (financeGate.ok) throw new Error("expected blocked finance");
  assert.equal(financeGate.code, "blocked");
  assert.equal(loadFinanceCoverage(financeGate, []).kind, "not_yet_published");

  const entries = (JSON.parse(readFileSync(financeFixturePath, "utf8")) as { entries: FinanceFixtureEntry[] }).entries;
  const totals = summarizeFinanceEntries(entries);
  assert.equal(totals.grossDonationsMinor, 12000);
  assert.equal(totals.refundsMinor, 500);
  assert.equal(totals.netDonationsMinor, 11500);
  assert.equal(totals.loansMinor, 3000);
  assert.equal(totals.guaranteesMinor, 9000);
  assert.equal(totals.foreignShare, 2000 / 12000);

  const unknownForeign = summarizeFinanceEntries([
    { kind: "donation", amountMinor: 100, currency: "ILS", sourceEntryKey: "a", isForeign: null, subjectScope: "person" }
  ]);
  assert.equal(unknownForeign.foreignShare, null);
  assert.equal(loadFinanceCoverage({ ok: true, resource: { id: "x", status: "verified", resourceId: "00000000-0000-0000-0000-000000000001" } }, null).kind, "missing");
});

test("job lease fencing rejects stale checkpoint tokens", () => {
  const db = openDatabase(":memory:");
  try {
    const jobId = ensureEtlJob(db, { dedupeKey: "lease-1", source: "cec", stage: "acquire" });
    const lease = acquireJobLease(db, jobId, new Date("2026-09-08T00:00:00.000Z"), 60_000);
    assert.ok(lease);
    assert.equal(verifyLeaseToken(db, lease!, new Date("2026-09-08T00:00:30.000Z")), true);
    assert.equal(checkpointJob(db, lease!, "stage", { cursor: 1 }, new Date("2026-09-08T00:00:30.000Z")), true);

    const stale = { ...lease!, token: "00000000-0000-0000-0000-000000000000" };
    assert.equal(checkpointJob(db, stale, "validate", undefined, new Date("2026-09-08T00:00:30.000Z")), false);
    assert.equal(releaseJobLease(db, stale, "succeeded", undefined, new Date("2026-09-08T00:00:30.000Z")), false);
    assert.equal(releaseJobLease(db, lease!, "succeeded", undefined, new Date("2026-09-08T00:00:30.000Z")), true);
    assert.equal(db.prepare("SELECT state FROM etl_jobs WHERE id = ?").get(jobId)?.state, "succeeded");
  } finally {
    db.close();
  }
});

test("pipeline refuses blocked sources and never activates publications", () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-pipeline-"));
  try {
    const db = openDatabase(join(dir, "app.db"));
    const manifest = loadSourceManifest(manifestPath);
    const blocked = manifest.sources.flatMap((source) => source.resources).find((resource) => resource.id === "cec-newer");
    assert.ok(blocked);
    const gate = gateSourceResource(blocked!);
    assert.equal(gate.ok, false);
    const refused = runEnrichmentPipeline(db, {
      manifest,
      resource: blocked!,
      dedupeKey: "blocked-cec-newer"
    });
    assert.equal(refused.ok, false);
    assert.equal(refused.publicationActivated, false);
    assert.equal(db.prepare("SELECT count(*) n FROM directory_publications WHERE status = 'active'").get()?.n, 0);
    assert.equal(db.prepare("SELECT count(*) n FROM etl_jobs").get()?.n, 0);

    const verified = manifest.sources.flatMap((source) => source.resources).find((resource) => resource.status === "verified");
    assert.ok(verified);
    const ok = runEnrichmentPipeline(db, {
      manifest,
      resource: verified!,
      dedupeKey: "dry-verified",
      fixturePath: financeFixturePath
    });
    assert.equal(ok.ok, true);
    assert.equal(ok.publicationActivated, false);
    assert.equal(db.prepare("SELECT count(*) n FROM directory_publications WHERE status = 'active'").get()?.n, 0);
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
