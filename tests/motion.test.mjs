import assert from "node:assert/strict";
import test from "node:test";

let motionDuration;
try {
  ({ motionDuration } = await import("../lib/motion.ts"));
} catch {
  // The first TDD run reaches the assertion below while the module is absent.
}

test("map motion keeps its requested duration for users who allow animation", () => {
  assert.equal(typeof motionDuration, "function", "motionDuration must be implemented");
  assert.equal(motionDuration(1600, false), 1600);
});

test("map motion becomes immediate when reduced motion is requested", () => {
  assert.equal(typeof motionDuration, "function", "motionDuration must be implemented");
  assert.equal(motionDuration(1600, true), 0);
});

test("map motion defaults to the requested duration outside a browser", () => {
  assert.equal(typeof motionDuration, "function", "motionDuration must be implemented");
  assert.equal(motionDuration(700), 700);
});
