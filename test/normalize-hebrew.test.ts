import assert from "node:assert/strict";
import test from "node:test";
import { ALGORITHM_VERSION, normalizeHebrew } from "../src/integrations/elections/normalize-hebrew.js";

test("Hebrew normalization strips niqqud, keeps finals, and collapses whitespace", () => {
  assert.equal(normalizeHebrew("שָׁלוֹם"), "שלום");
  assert.equal(normalizeHebrew("ץ"), "ץ");
  assert.equal(normalizeHebrew("צ"), "צ");
  assert.notEqual(normalizeHebrew("ץ"), normalizeHebrew("צ"));
  assert.equal(normalizeHebrew("  בית־אל \u202B \n"), "בית-אל");
  assert.equal(normalizeHebrew("ג\u05F3ון"), "ג'ון");
  assert.equal(ALGORITHM_VERSION, "1");
  assert.equal(normalizeHebrew("שָׁלוֹם"), normalizeHebrew("שלום"));
});
