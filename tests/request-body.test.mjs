import assert from "node:assert/strict";
import test from "node:test";

import { readBodyCapped } from "../lib/request.ts";

function streamed(chunks) {
  let pulled = 0;
  const body = new ReadableStream({
    pull(controller) {
      if (pulled < chunks.length) controller.enqueue(new Uint8Array(chunks[pulled++]));
      else controller.close();
    },
  });
  const request = new Request("http://x.test/upload", { method: "POST", body, duplex: "half" });
  return { request, pulled: () => pulled };
}

test("returns the whole body when under the cap", async () => {
  const { request } = streamed([3, 4]);
  const out = await readBodyCapped(request, 10);
  assert.equal(out?.byteLength, 7);
});

test("accepts a body exactly at the cap", async () => {
  const { request } = streamed([5, 5]);
  assert.equal((await readBodyCapped(request, 10))?.byteLength, 10);
});

test("stops reading once the cap is passed, without Content-Length", async () => {
  const { request, pulled } = streamed([6, 6, 6, 6, 6]);
  assert.equal(await readBodyCapped(request, 10), null);
  assert.ok(pulled() < 5, "the rest of the stream is never pulled");
});

test("empty body is an empty buffer", async () => {
  const request = new Request("http://x.test/upload", { method: "POST" });
  assert.equal((await readBodyCapped(request, 10))?.byteLength, 0);
});
