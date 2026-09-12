import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createApp } from "../src/app.js";
import { backupDatabase, restoreDatabase } from "../src/backup.js";
import { openDatabase } from "../src/db.js";
import {
  createErasureLedgerManifest,
  ERASURE_LEDGER_MANIFEST_KEY,
  serializeErasureLedgerManifest
} from "../src/erasure-ledger.js";
import {
  activateDirectoryPublication,
  insertDirectoryPublication,
  insertElection,
  rollbackDirectoryPublication
} from "../src/integrations/elections/repository.js";
import { activeDirectoryMeta, listDirectoryBrowse } from "../src/recipients.js";

test("published affiliations enrich browse; list-party alone does not assign party", () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-dir-pub-"));
  try {
    const db = openDatabase(join(dir, "app.db"));
    const now = new Date().toISOString();
    const electionId = insertElection(db, { number: 24, publicationStatus: "historical" });
    const listId = Number((db.prepare(`INSERT INTO electoral_lists (election_id, ballot_letters, title_he) VALUES (?, 'ב', 'רשימה כחולה') RETURNING id`).get(electionId) as { id: number }).id);
    const partyA = Number((db.prepare(`INSERT INTO parties (name_he) VALUES ('מפלגה א') RETURNING id`).get() as { id: number }).id);
    const partyB = Number((db.prepare(`INSERT INTO parties (name_he) VALUES ('מפלגה ב') RETURNING id`).get() as { id: number }).id);
    db.prepare(`INSERT INTO electoral_list_parties (list_id, party_id, review_state) VALUES (?, ?, 'accepted')`).run(listId, partyA);
    db.prepare(`INSERT INTO electoral_list_parties (list_id, party_id, review_state) VALUES (?, ?, 'accepted')`).run(listId, partyB);
    const personId = Number((db.prepare(`INSERT INTO people (display_name, created_at) VALUES ('Candidate', ?) RETURNING id`).get(now) as { id: number }).id);
    const candidacyId = Number((db.prepare(`INSERT INTO candidacies (election_id, list_id, person_id, status) VALUES (?, ?, ?, 'active') RETURNING id`)
      .get(electionId, listId, personId) as { id: number }).id);
    db.prepare(`INSERT INTO recipients (id, type, email, is_active) VALUES (9101, 'politician', 'c@example.org', 1)`).run();
    db.prepare(`INSERT INTO recipient_translations (recipient_id, locale, name) VALUES (9101, 'he', 'מועמדת בדיקה')`).run();
    db.prepare(`INSERT INTO recipient_entity_links (recipient_id, person_id, review_state, created_at) VALUES (9101, ?, 'accepted', ?)`)
      .run(personId, now);

    const acceptedId = insertDirectoryPublication(db, { electionId, version: 1, status: "accepted" });
    assert.equal(activateDirectoryPublication(db, acceptedId, now), true);
    assert.equal(listDirectoryBrowse(db, "he").find((row) => row.id === 9101)?.party, null);
    assert.deepEqual(listDirectoryBrowse(db, "he").find((row) => row.id === 9101)?.list, {
      id: listId, label: "רשימה כחולה", ballotLetters: "ב"
    });

    db.prepare(`INSERT INTO candidacy_party_memberships (candidacy_id, party_id, review_state) VALUES (?, ?, 'accepted')`)
      .run(candidacyId, partyA);
    assert.deepEqual(listDirectoryBrowse(db, "he").find((row) => row.id === 9101)?.party, {
      id: partyA, label: "מפלגה א"
    });

    const meta = activeDirectoryMeta(db);
    assert.equal(meta?.electionNumber, 24);
    assert.equal(meta?.publicationId, acceptedId);

    const next = insertDirectoryPublication(db, {
      electionId, version: 2, status: "accepted", previousPublicationId: acceptedId
    });
    assert.equal(activateDirectoryPublication(db, next, now), true);
    assert.equal(getStatus(db, acceptedId), "rolled_back");
    assert.equal(getStatus(db, next), "active");
    assert.equal(rollbackDirectoryPublication(db, next), true);
    assert.equal(getStatus(db, next), "rolled_back");
    assert.equal(getStatus(db, acceptedId), "active");
    assert.equal(activateDirectoryPublication(db, next), false);
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("backup restore keeps election publication rows; suggest returns publicationId", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-dir-restore-"));
  const objects = new Map<string, Uint8Array>();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input, init) => {
    const url = new URL(String(input));
    if (url.searchParams.has("list-type")) {
      const keys = [...objects.keys()].filter((key) => key.startsWith("/ledger/erasure-events/"));
      return new Response(`<ListBucketResult><IsTruncated>false</IsTruncated>${keys.map((key) => `<Contents><Key>${key.slice("/ledger/".length)}</Key></Contents>`).join("")}</ListBucketResult>`);
    }
    if (init?.method === "PUT") {
      objects.set(url.pathname, new Uint8Array(init.body as ArrayBuffer));
      return new Response(null, { status: 200 });
    }
    const data = objects.get(url.pathname);
    return new Response(data ? new Uint8Array(data) : null, { status: data ? 200 : 404 });
  }) as typeof fetch;
  try {
    const runtime = createApp({
      sqlitePath: join(dir, "app.db"),
      env: {
        NODE_ENV: "test",
        SESSION_SECRET: "pub-secret",
        BACKUP_S3_ENDPOINT: "http://backup.test",
        BACKUP_S3_ACCESS_KEY: "k",
        BACKUP_S3_SECRET_KEY: "s",
        BACKUP_S3_BUCKET: "backups",
        ERASURE_LEDGER_S3_ENDPOINT: "http://ledger.test",
        ERASURE_LEDGER_S3_ACCESS_KEY: "ledger-key",
        ERASURE_LEDGER_S3_SECRET_KEY: "ledger-secret",
        ERASURE_LEDGER_S3_BUCKET: "ledger",
        ERASURE_LEDGER_HMAC_KEYS: `v1:${Buffer.alloc(32, 7).toString("base64url")}`,
        ERASURE_LEDGER_ACTIVE_KEY_VERSION: "v1"
      }
    });
    objects.set(`/ledger/${ERASURE_LEDGER_MANIFEST_KEY}`, serializeErasureLedgerManifest(createErasureLedgerManifest(runtime.config)));
    const now = new Date().toISOString();
    const electionId = insertElection(runtime.db, { number: 24, publicationStatus: "historical" });
    const acceptedId = insertDirectoryPublication(runtime.db, { electionId, version: 1, status: "accepted" });
    assert.equal(activateDirectoryPublication(runtime.db, acceptedId, now), true);
    const [backupKey] = await backupDatabase(runtime.db, runtime.config);
    assert.ok(backupKey);

    const page = await runtime.app.request("/en/request");
    const html = await page.text();
    assert.match(html, /Election 24/);
    assert.equal(page.headers.get("cache-control"), "private, no-store");
    const csrf = html.match(/name="csrf" value="([^"]+)"/)![1]!;
    const cookie = page.headers.get("set-cookie")!.split(";")[0]!;
    const suggest = await runtime.app.request("/en/request/suggest", {
      method: "POST",
      headers: { cookie, "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ csrf, q: "Public" })
    });
    assert.equal(suggest.headers.get("cache-control"), "private, no-store");
    const payload = await suggest.json() as { publicationId: number | null };
    assert.equal(payload.publicationId, acceptedId);

    const target = join(mkdtempSync(join(tmpdir(), "agree-dir-restored-")), "app.db");
    await restoreDatabase(runtime.config, backupKey!, target, { operatorConfirmed: true, serviceStopped: true });
    const restored = openDatabase(target);
    assert.equal(restored.prepare("SELECT status FROM directory_publications WHERE id = ?").get(acceptedId)?.status, "active");
    assert.equal(restored.prepare("SELECT number FROM elections WHERE id = ?").get(electionId)?.number, 24);
    assert.equal(restored.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name IN ('search_history','visitor_baskets','appeal_drafts')`).all().length, 0);
    restored.close();
    runtime.close();
  } finally {
    globalThis.fetch = originalFetch;
    rmSync(dir, { recursive: true, force: true });
  }
});

test("admin directory activate requires admin role, CSRF, and accepted publication", async () => {
  const dir = mkdtempSync(join(tmpdir(), "agree-dir-admin-"));
  try {
    const runtime = createApp({
      sqlitePath: join(dir, "app.db"),
      env: { NODE_ENV: "test", SESSION_SECRET: "admin-dir", ADMIN_EMAILS: "ops@example.org" }
    });
    const electionId = insertElection(runtime.db, { number: 24, publicationStatus: "historical" });
    const draftId = insertDirectoryPublication(runtime.db, { electionId, version: 1, status: "draft" });
    const acceptedId = insertDirectoryPublication(runtime.db, { electionId, version: 2, status: "accepted" });

    const denied = await runtime.app.request("/admin/directory");
    assert.equal(denied.status, 403);

    const page = await runtime.app.request("/admin/directory", { headers: { "X-Test-Admin-Email": "ops@example.org" } });
    assert.equal(page.status, 200);
    const html = await page.text();
    const csrf = html.match(/name="csrf" value="([^"]+)"/)![1]!;
    const cookie = page.headers.get("set-cookie")!.split(";")[0]!;

    const badCsrf = await runtime.app.request("/admin/directory", {
      method: "POST",
      headers: { cookie, "content-type": "application/x-www-form-urlencoded", "X-Test-Admin-Email": "ops@example.org" },
      body: new URLSearchParams({ csrf: "nope", action: "activate", publicationId: String(acceptedId) })
    });
    assert.equal(badCsrf.status, 403);

    const draftRefuse = await runtime.app.request("/admin/directory", {
      method: "POST",
      headers: { cookie, "content-type": "application/x-www-form-urlencoded", "X-Test-Admin-Email": "ops@example.org" },
      body: new URLSearchParams({ csrf, action: "activate", publicationId: String(draftId) })
    });
    assert.equal(draftRefuse.status, 422);

    const page2 = await runtime.app.request("/admin/directory", { headers: { "X-Test-Admin-Email": "ops@example.org" } });
    const csrf2 = (await page2.text()).match(/name="csrf" value="([^"]+)"/)![1]!;
    const cookie2 = page2.headers.get("set-cookie")!.split(";")[0]!;
    const activated = await runtime.app.request("/admin/directory", {
      method: "POST",
      headers: { cookie: cookie2, "content-type": "application/x-www-form-urlencoded", "X-Test-Admin-Email": "ops@example.org" },
      body: new URLSearchParams({ csrf: csrf2, action: "activate", publicationId: String(acceptedId) })
    });
    assert.equal(activated.status, 303);
    assert.equal(runtime.db.prepare("SELECT status FROM directory_publications WHERE id = ?").get(acceptedId)?.status, "active");
    assert.ok(runtime.db.prepare("SELECT 1 FROM admin_audit_events WHERE action = 'activate' AND entity = 'directory_publication'").get());
    runtime.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

function getStatus(db: ReturnType<typeof openDatabase>, id: number) {
  return (db.prepare("SELECT status FROM directory_publications WHERE id = ?").get(id) as { status: string }).status;
}
