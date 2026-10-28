import assert from "node:assert/strict";
import test from "node:test";
import { chunk } from "../lib/chunk.ts";

test("chunk splits into fixed-size groups", () => {
  assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.deepEqual(chunk([1, 2, 3, 4], 2), [[1, 2], [3, 4]]);
  assert.deepEqual(chunk([1, 2], 100), [[1, 2]]);
  const ids = Array.from({ length: 1000 }, (_, i) => i);
  const groups = chunk(ids, 100);
  assert.equal(groups.length, 10);
  assert.ok(groups.every((g) => g.length === 100));
  assert.deepEqual(groups.flat(), ids);
});

test("chunk of an empty list is empty", () => {
  assert.deepEqual(chunk([], 100), []);
});

test("chunk refuses a size below 1", () => {
  assert.throws(() => chunk([1], 0), RangeError);
  assert.throws(() => chunk([1], 1.5), RangeError);
});
