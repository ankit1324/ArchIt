import assert from "node:assert/strict";
import test from "node:test";

let connectedFocusTarget;
let wrappedFocusIndex;
try {
  ({ connectedFocusTarget, wrappedFocusIndex } = await import("../lib/focus.ts"));
} catch {
  // The first TDD run reaches the assertion below while the module is absent.
}

test("dialog focus advances and wraps from the last control", () => {
  assert.equal(typeof wrappedFocusIndex, "function", "wrappedFocusIndex must be implemented");
  assert.equal(wrappedFocusIndex(3, 1, false), 2);
  assert.equal(wrappedFocusIndex(3, 2, false), 0);
});

test("dialog focus moves backward and wraps from the first control", () => {
  assert.equal(typeof wrappedFocusIndex, "function", "wrappedFocusIndex must be implemented");
  assert.equal(wrappedFocusIndex(3, 1, true), 0);
  assert.equal(wrappedFocusIndex(3, 0, true), 2);
});

test("dialog focus enters at the appropriate edge when focus starts outside", () => {
  assert.equal(typeof wrappedFocusIndex, "function", "wrappedFocusIndex must be implemented");
  assert.equal(wrappedFocusIndex(3, -1, false), 0);
  assert.equal(wrappedFocusIndex(3, -1, true), 2);
});

test("dialog focus reports no target for an empty control list", () => {
  assert.equal(typeof wrappedFocusIndex, "function", "wrappedFocusIndex must be implemented");
  assert.equal(wrappedFocusIndex(0, -1, false), -1);
});

test("dialog focus returns to its connected opener when it survives", () => {
  assert.equal(typeof connectedFocusTarget, "function", "connectedFocusTarget must be implemented");
  const opener = { id: "opener", isConnected: true };
  const fallback = { id: "design-row", isConnected: true };
  assert.equal(connectedFocusTarget(opener, fallback), opener);
});

test("dialog focus falls back when publishing replaces its opener", () => {
  assert.equal(typeof connectedFocusTarget, "function", "connectedFocusTarget must be implemented");
  const removedOpener = { id: "publish", isConnected: false };
  const designRow = { id: "design-row", isConnected: true };
  assert.equal(connectedFocusTarget(removedOpener, designRow), designRow);
});

test("dialog focus returns no target when neither candidate remains", () => {
  assert.equal(typeof connectedFocusTarget, "function", "connectedFocusTarget must be implemented");
  const removed = { isConnected: false };
  assert.equal(connectedFocusTarget(removed, removed), null);
});