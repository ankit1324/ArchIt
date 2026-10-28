import assert from "node:assert/strict";
import test from "node:test";

// lib/youpi-client.ts is the injectable half of lib/youpi.ts (which imports
// "server-only"): fetch and env are passed in, so no request leaves the process.
import {
  createYoupiClient,
  isTimeout,
  YOUPI_TIMEOUT_MS,
  YoupiError,
} from "../lib/youpi-client.ts";

const ENV = {
  YOUPI_API_URL: "https://pay.example.test//",
  YOUPI_WEBHOOK_SECRET: "whsec_merchant_key",
  YOUPI_MERCHANT_ID: "3f0c2a8e-merchant",
};

const PAYMENT = {
  paymentId: "pay_1",
  orderId: "builder_unlock_abc_123",
  amount: "2000.00",
  amountPaise: "200000",
  currency: "INR",
  status: "ACTIVE",
  checkoutUrl: "https://pay.example.test/checkout/pay_1",
};

const ORDER = {
  orderId: "builder_unlock_abc_123",
  amountPaise: 200000,
  description: "Builder unlock",
  metadata: { purpose: "builder_unlock", userId: "user_a", ref: "" },
};

/**
 * A client over a stubbed fetch. `respond` returns a Response or throws;
 * `calls` records every request as { url, init }.
 */
function harness({ env = ENV, respond = () => Response.json(PAYMENT), timeoutMs } = {}) {
  const calls = [];
  const client = createYoupiClient({
    async fetch(url, init) {
      calls.push({ url, init });
      return respond(url, init);
    },
    env: (name) => env[name],
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  });
  return { ...client, calls };
}

test("createPayment posts the order in rupees with merchant and idempotency headers", async () => {
  const { createPayment, calls } = harness();
  const res = await createPayment({ ...ORDER, returnUrl: "https://archit.test/designer" });
  assert.deepEqual(res, PAYMENT);
  assert.equal(calls.length, 1);
  const { url, init } = calls[0];
  assert.equal(url, "https://pay.example.test/api/v1/payments", "trailing slashes trimmed");
  assert.equal(init.method, "POST");
  assert.equal(init.cache, "no-store");
  assert.deepEqual(init.headers, {
    "Content-Type": "application/json",
    "X-Merchant-Key": "whsec_merchant_key",
    "X-Merchant-Id": "3f0c2a8e-merchant",
    "Idempotency-Key": ORDER.orderId,
  });
  assert.deepEqual(JSON.parse(init.body), {
    orderId: ORDER.orderId,
    amount: "2000.00",
    currency: "INR",
    description: "Builder unlock",
    metadata: ORDER.metadata,
    returnUrl: "https://archit.test/designer",
  });
  assert.ok(init.signal instanceof AbortSignal, "every call carries a timeout signal");
});

test("createPayment omits returnUrl when none is given", async () => {
  const { createPayment, calls } = harness();
  await createPayment(ORDER);
  assert.equal("returnUrl" in JSON.parse(calls[0].init.body), false);
});

test("fetchPayment reads the payment back with the merchant key, id encoded", async () => {
  const { fetchPayment, calls } = harness();
  await fetchPayment("pay/1 ?x");
  const { url, init } = calls[0];
  assert.equal(url, "https://pay.example.test/api/v1/payments/pay%2F1%20%3Fx");
  assert.equal(init.method, undefined, "a GET");
  assert.equal(init.cache, "no-store");
  assert.equal(init.headers["X-Merchant-Key"], "whsec_merchant_key");
  assert.equal(init.headers["X-Merchant-Id"], "3f0c2a8e-merchant");
});

test("X-Merchant-Id is left out when no merchant id is configured", async () => {
  const { fetchPayment, calls } = harness({ env: { ...ENV, YOUPI_MERCHANT_ID: undefined } });
  await fetchPayment("pay_1");
  assert.equal("X-Merchant-Id" in calls[0].init.headers, false);
  assert.equal(calls[0].init.headers["X-Merchant-Key"], "whsec_merchant_key");
});

test("missing API URL or merchant key throws before any request", async () => {
  for (const missing of ["YOUPI_API_URL", "YOUPI_WEBHOOK_SECRET"]) {
    const { fetchPayment, createPayment, calls } = harness({ env: { ...ENV, [missing]: "" } });
    await assert.rejects(fetchPayment("pay_1"), new RegExp(`${missing} unset`));
    await assert.rejects(createPayment(ORDER), new RegExp(`${missing} unset`));
    assert.equal(calls.length, 0);
  }
});

test("a gateway error becomes a YoupiError carrying its status and body message", async () => {
  const body = { error: "merchant key rejected" };
  const { fetchPayment } = harness({ respond: () => Response.json(body, { status: 401 }) });
  await assert.rejects(fetchPayment("pay_1"), (e) => {
    assert.ok(e instanceof YoupiError);
    assert.equal(e.name, "YoupiError");
    assert.equal(e.status, 401);
    assert.equal(e.message, "merchant key rejected");
    assert.deepEqual(e.body, body);
    return true;
  });
});

test("a gateway error without an error field gets a generic message", async () => {
  const { createPayment } = harness({
    respond: () => Response.json({ detail: "nope" }, { status: 422 }),
  });
  await assert.rejects(createPayment(ORDER), (e) => {
    assert.ok(e instanceof YoupiError);
    assert.equal(e.status, 422);
    assert.equal(e.message, "create payment failed (422)");
    return true;
  });
});

test("a non-JSON error body is kept as text", async () => {
  const { fetchPayment } = harness({
    respond: () => new Response("<html>502 Bad Gateway</html>", { status: 502 }),
  });
  await assert.rejects(fetchPayment("pay_1"), (e) => {
    assert.ok(e instanceof YoupiError);
    assert.equal(e.status, 502);
    assert.equal(e.message, "fetch payment failed (502)");
    assert.equal(e.body, "<html>502 Bad Gateway</html>");
    return true;
  });
});

test("a non-JSON or empty 2xx body does not throw a SyntaxError", async () => {
  const text = harness({ respond: () => new Response("ok", { status: 200 }) });
  assert.equal(await text.fetchPayment("pay_1"), "ok");
  const empty = harness({ respond: () => new Response("", { status: 200 }) });
  assert.equal(await empty.fetchPayment("pay_1"), null);
});

test("a timeout surfaces as YoupiError 504", async () => {
  for (const name of ["TimeoutError", "AbortError"]) {
    const { fetchPayment } = harness({
      respond: () => {
        throw new DOMException("The operation timed out.", name);
      },
    });
    await assert.rejects(fetchPayment("pay_1"), (e) => {
      assert.ok(e instanceof YoupiError);
      assert.equal(e.status, 504);
      assert.equal(e.message, "gateway timeout");
      return true;
    });
  }
});

test("a hung gateway is cut off by the timeout signal", async () => {
  const { fetchPayment } = harness({
    timeoutMs: 20,
    respond: (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () => reject(init.signal.reason));
      }),
  });
  // AbortSignal.timeout's timer is unref'd; hold the event loop open until it fires
  const keepAlive = setTimeout(() => {}, 5_000);
  try {
    await assert.rejects(fetchPayment("pay_1"), (e) => e instanceof YoupiError && e.status === 504);
  } finally {
    clearTimeout(keepAlive);
  }
});

test("other network failures are rethrown untouched", async () => {
  const boom = new TypeError("fetch failed");
  const { fetchPayment } = harness({
    respond: () => {
      throw boom;
    },
  });
  await assert.rejects(fetchPayment("pay_1"), (e) => e === boom);
});

test("isTimeout recognises only timeout and abort errors", () => {
  assert.equal(isTimeout(new DOMException("t", "TimeoutError")), true);
  assert.equal(isTimeout(new DOMException("a", "AbortError")), true);
  assert.equal(isTimeout(Object.assign(new Error("x"), { name: "TimeoutError" })), true);
  assert.equal(isTimeout(new TypeError("fetch failed")), false);
  assert.equal(isTimeout({ name: "TimeoutError" }), false, "not an Error");
  assert.equal(isTimeout(undefined), false);
});

test("the default per-call ceiling is 8 seconds", () => {
  assert.equal(YOUPI_TIMEOUT_MS, 8_000);
});
