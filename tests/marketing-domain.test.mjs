import test from "node:test";
import assert from "node:assert/strict";
import { createAttributionKey, splitList } from "../src/lib/marketing.js";

test("marketing list fields normalize and deduplicate values", () => {
  assert.deepEqual(splitList("web, social, web,  email "), ["web", "social", "email"]);
  assert.deepEqual(splitList(""), []);
});

test("campaign attribution keys are readable and stable for a supplied id", () => {
  assert.equal(createAttributionKey("Dealer Growth / Q4", "12345678-abcd"), "dealer-growth-q4-12345678");
  assert.equal(createAttributionKey("***", "12345678-abcd"), "campaign-12345678");
});
