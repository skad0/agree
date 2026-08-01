import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app.js";
import { enforceRetention } from "../src/response-storage.js";

const env = { NODE_ENV: "test" };
const publicId = (number: number) => `request-${number.toString().padStart(2, "0")}-${"x".repeat(43)}`;

test("generated requests use the UTC calendar cutoff and retain the exact boundary", () => {
  const { db, close } = createApp({ sqlitePath: ":memory:", env });
  try {
    db.prepare("INSERT INTO recipients (type, is_active) VALUES ('party', 1)").run();
    for (const [index, [, createdAt]] of ([
      ["before", "2024-02-27T23:59:59.999Z"],
      ["equal", "2024-02-28T00:00:00.000Z"],
      ["after", "2024-02-28T00:00:00.001Z"]
    ] as const).entries()) {
      db.prepare("INSERT INTO generated_requests (public_id, recipient_id, locale, selected_demands, created_at) VALUES (?, 1, 'en', '[1]', ?)").run(publicId(index), createdAt);
    }
    enforceRetention(db, Date.parse("2025-02-28T00:00:00.000Z"));
    assert.equal(db.prepare("SELECT count(*) AS count FROM generated_requests").get()?.count, 2);
  } finally { close(); }
});

test("generated request retention is bounded and cleans only its actions", () => {
  const { db, close } = createApp({ sqlitePath: ":memory:", env });
  try {
    db.prepare("INSERT INTO recipients (type, is_active) VALUES ('party', 1)").run();
    for (let i = 0; i < 101; i++) {
      db.prepare("INSERT INTO generated_requests (public_id, recipient_id, locale, selected_demands, created_at) VALUES (?, 1, 'en', '[1]', '2023-12-31T00:00:00.000Z')").run(publicId(i));
      db.prepare("INSERT INTO request_actions (generated_request_id, action_type, created_at) VALUES (?, 'text_copied', '2024-01-01T00:00:00.000Z')").run(i + 1);
    }
    db.prepare("INSERT INTO generated_requests (public_id, recipient_id, locale, selected_demands, created_at) VALUES (?, 1, 'en', '[1]', '2025-01-01T00:00:00.000Z')").run(publicId(101));
    db.prepare("INSERT INTO request_actions (generated_request_id, action_type, created_at) VALUES (102, 'text_copied', '2025-01-01T00:00:00.000Z')").run();
    const actionPlan = db.prepare("EXPLAIN QUERY PLAN DELETE FROM request_actions WHERE generated_request_id IN (?, ?, ?)").all(1, 2, 3);
    assert.match(JSON.stringify(actionPlan), /idx_request_actions_generated_request/);
    enforceRetention(db, Date.parse("2025-01-01T00:00:00.000Z"));
    assert.equal(db.prepare("SELECT count(*) AS count FROM generated_requests WHERE created_at < '2025-01-01T00:00:00.000Z'").get()?.count, 1);
    assert.equal(db.prepare("SELECT count(*) AS count FROM request_actions").get()?.count, 2);
    assert.equal(db.prepare("SELECT count(*) AS count FROM request_actions WHERE generated_request_id = 102").get()?.count, 1);
    assert.equal(db.prepare("SELECT count(*) AS count FROM generated_requests WHERE created_at = '2025-01-01T00:00:00.000Z'").get()?.count, 1);
  } finally { close(); }
});

test("an expired public result link is inaccessible after request retention", async () => {
  const { app, db, close } = createApp({ sqlitePath: ":memory:", env });
  try {
    db.prepare("INSERT INTO recipients (type, is_active) VALUES ('party', 1)").run();
    db.prepare("INSERT INTO generated_requests (public_id, recipient_id, locale, selected_demands, created_at) VALUES (?, 1, 'en', '[]', '2023-12-31T23:59:59.999Z')").run(publicId(200));
    enforceRetention(db, Date.parse("2025-01-01T00:00:00.000Z"));
    const response = await app.request(`/en/request/result?request=${publicId(200)}`);
    assert.equal(response.status, 422);
  } finally { close(); }
});
