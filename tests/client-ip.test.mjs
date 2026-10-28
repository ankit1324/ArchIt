import assert from "node:assert/strict";
import test from "node:test";

import { clientIp } from "../lib/client-ip.ts";

const h = (init) => new Headers(init);

test("clientIp prefers x-vercel-forwarded-for, then x-real-ip, then the last X-Forwarded-For hop", () => {
  assert.equal(
    clientIp(h({
      "x-vercel-forwarded-for": "203.0.113.7",
      "x-real-ip": "198.51.100.2",
      "x-forwarded-for": "1.1.1.1, 192.0.2.9",
    })),
    "203.0.113.7",
  );
  assert.equal(
    clientIp(h({ "x-real-ip": "198.51.100.2", "x-forwarded-for": "1.1.1.1, 192.0.2.9" })),
    "198.51.100.2",
  );
  // the first entry is whatever the client sent; the last is what our proxy saw
  assert.equal(clientIp(h({ "x-forwarded-for": "1.1.1.1, 10.0.0.1, 192.0.2.9" })), "192.0.2.9");
  assert.equal(clientIp(h({ "x-forwarded-for": "192.0.2.9" })), "192.0.2.9");
  assert.equal(clientIp(h({ "x-forwarded-for": "2001:db8::1" })), "2001:db8::1");
  // x-vercel-forwarded-for may itself be a list: take its first (client) entry
  assert.equal(clientIp(h({ "x-vercel-forwarded-for": "203.0.113.7, 10.0.0.1" })), "203.0.113.7");
});

test("clientIp ignores blank and garbage values", () => {
  assert.equal(
    clientIp(h({ "x-vercel-forwarded-for": "  ", "x-real-ip": "198.51.100.2" })),
    "198.51.100.2",
  );
  assert.equal(
    clientIp(h({ "x-real-ip": "not an ip", "x-forwarded-for": "192.0.2.9" })),
    "192.0.2.9",
  );
  assert.equal(
    clientIp(h({ "x-real-ip": "<script>", "x-forwarded-for": "1.1.1.1, , " })),
    "1.1.1.1",
  );
  assert.equal(clientIp(h({ "x-forwarded-for": "x".repeat(200) })), "anonymous");
  assert.equal(clientIp(h({ "x-real-ip": "1.2.3.4:5678:evil/path" })), "anonymous");
});

test('clientIp falls back to "anonymous"', () => {
  assert.equal(clientIp(h({})), "anonymous");
  assert.equal(clientIp(h({ "x-forwarded-for": "" })), "anonymous");
  assert.equal(clientIp(h({ "x-forwarded-for": " , ,", "x-real-ip": "" })), "anonymous");
});
