import assert from "node:assert/strict";
import test from "node:test";
import { PAGE_LIMIT, parseBBox, parseCursor, parseLimit } from "../lib/listing-query.ts";

test("bbox parses w,s,e,n and rejects malformed or inverted boxes", () => {
  assert.equal(parseBBox(null), null);
  assert.equal(parseBBox(""), null);
  assert.deepEqual(parseBBox("76.7,30.7,76.8,30.8"), [76.7, 30.7, 76.8, 30.8]);
  assert.deepEqual(parseBBox(" 76.7 , 30.7 ,76.8, 30.8"), [76.7, 30.7, 76.8, 30.8]);
  for (const bad of ["1,2,3", "a,b,c,d", "76.8,30.7,76.7,30.8", "76.7,30.8,76.8,30.7", "-181,0,0,1", "0,0,1,91", "1,2,3,4,5", "Infinity,0,1,1"]) {
    assert.equal(parseBBox(bad), "invalid", bad);
  }
});

test("limit defaults to and is capped at one page", () => {
  assert.equal(parseLimit(null), PAGE_LIMIT);
  assert.equal(parseLimit("50"), 50);
  assert.equal(parseLimit("999999"), PAGE_LIMIT);
  for (const bad of ["0", "-1", "1.5", "ten"]) assert.equal(parseLimit(bad), "invalid", bad);
});

test("cursor accepts listing ids only", () => {
  assert.equal(parseCursor(null), null);
  assert.equal(parseCursor("e192d31c-3ff5-46d4-930c-e5381e9f2f39"), "e192d31c-3ff5-46d4-930c-e5381e9f2f39");
  for (const bad of ["a,b", "x".repeat(65), "id)or(1=1", "a b"]) assert.equal(parseCursor(bad), "invalid", bad);
});
