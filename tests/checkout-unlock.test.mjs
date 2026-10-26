import assert from "node:assert/strict";
import test from "node:test";

/**
 * A fake youpi.js. The real one is served by the checkout portal and talks to
 * us only through the option callbacks, which is the contract exercised here.
 */
function installYoupi(script) {
  const calls = { pay: [] };
  global.window = {
    Youpi: {
      pay(options) {
        calls.pay.push(options);
        script(options);
        return {};
      },
    },
    alert: () => {},
  };
  global.document = {
    querySelector: () => null,
    createElement: () => ({}),
    body: { appendChild: () => {} },
  };
  return calls;
}

function installFetch({ verifyStatus = 200, verifyDelay = 20, verifyLog = [] } = {}) {
  global.fetch = async (url, init) => {
    if (url === "/api/create-order") {
      return {
        ok: true,
        json: async () => ({
          paymentId: "c7942127-14e3-469a-9e4a-9359a16f903a",
          orderId: "builder_unlock_m1abc_9f3a2c1d",
          amount: 200000,
          currency: "INR",
          checkoutUrl: "https://pay.example.test/checkout/c7942127-14e3-469a-9e4a-9359a16f903a",
          portalUrl: "https://pay.example.test",
        }),
      };
    }
    if (url === "/api/verify-payment") {
      verifyLog.push(JSON.parse(init.body));
      await new Promise((resolve) => setTimeout(resolve, verifyDelay));
      return {
        ok: verifyStatus === 200,
        status: verifyStatus,
        json: async () => ({ verified: verifyStatus === 200 }),
      };
    }
    return { ok: false, status: 404 };
  };
}

test("payFee ignores the modal closing after onSuccess fires", async () => {
  // youpi.js fires onSuccess and then closes the modal ~1.5s later, which
  // calls onClose. That close must not be mistaken for a cancellation while
  // the server-side verification is still in flight.
  let closed = false;
  installYoupi((options) => {
    setTimeout(() => options.onSuccess({ status: "SUCCESS" }), 10);
    setTimeout(() => {
      options.onClose();
      closed = true;
    }, 15);
  });
  const verifyLog = [];
  installFetch({ verifyLog });

  const { payFee } = await import("../lib/checkout.ts");
  const result = await payFee("builder_unlock", "Test unlock");

  assert.equal(result, true);
  assert.equal(closed, true);
  // the only thing the browser sends is the paymentId; the server re-reads it
  assert.deepEqual(verifyLog, [{ paymentId: "c7942127-14e3-469a-9e4a-9359a16f903a" }]);
});

test("payFee resolves false when the user closes the modal without paying", async () => {
  installYoupi((options) => {
    setTimeout(() => {
      options.onCancelled({ status: "CANCELLED" });
      options.onClose();
    }, 10);
  });
  const verifyLog = [];
  installFetch({ verifyLog });

  const { payFee } = await import("../lib/checkout.ts");
  assert.equal(await payFee("contact_owner", "Contact owner fee", "prop_1"), false);
  assert.deepEqual(verifyLog, [], "a cancelled checkout must never hit verify-payment");
});

test("payFee resolves false on expiry and failure", async () => {
  for (const cb of ["onExpired", "onFailed"]) {
    installYoupi((options) => {
      setTimeout(() => {
        options[cb]({ status: cb === "onExpired" ? "EXPIRED" : "FAILED" });
        options.onClose();
      }, 10);
    });
    installFetch();
    const { payFee } = await import("../lib/checkout.ts");
    assert.equal(await payFee("template_unlock", "Template", "office_1"), false, cb);
  }
});

test("payFee treats a 202 (still settling) as not-yet-unlocked, without a failure alert", async () => {
  const alerts = [];
  installYoupi((options) => {
    setTimeout(() => options.onSuccess({ status: "SUCCESS" }), 10);
  });
  global.window.alert = (msg) => alerts.push(msg);
  installFetch({ verifyStatus: 202 });

  const { payFee } = await import("../lib/checkout.ts");
  assert.equal(await payFee("builder_unlock", "Test unlock"), false);
  assert.equal(alerts.length, 1);
  assert.match(alerts[0], /Do not pay again/);
  assert.doesNotMatch(alerts[0], /could not be confirmed/);
});

test("payFee passes the server-issued checkoutUrl and portalUrl to youpi.js", async () => {
  const calls = installYoupi((options) => {
    setTimeout(() => options.onCancelled({ status: "CANCELLED" }), 5);
  });
  installFetch();

  const { payFee } = await import("../lib/checkout.ts");
  await payFee("builder_unlock", "Test unlock");

  assert.equal(calls.pay.length, 1);
  const opts = calls.pay[0];
  assert.equal(
    opts.checkoutUrl,
    "https://pay.example.test/checkout/c7942127-14e3-469a-9e4a-9359a16f903a",
  );
  assert.equal(opts.portalUrl, "https://pay.example.test");
  // no successUrl/failedUrl: those make youpi.js navigate away, which would
  // lose the designer/builder state the modal was opened from
  assert.equal(opts.successUrl, undefined);
  assert.equal(opts.failedUrl, undefined);
});

test("payFee resolves true without a checkout when the server says there is nothing to pay", async () => {
  // 409 = already in the ledger, 410 = paywall off (everything is free)
  for (const status of [409, 410]) {
    const calls = installYoupi(() => {});
    const alerts = [];
    const events = [];
    global.window.alert = (msg) => alerts.push(msg);
    global.window.dispatchEvent = (e) => events.push(e.detail.event);
    global.fetch = async () => ({ ok: false, status, json: async () => ({}) });

    const { payFee } = await import("../lib/checkout.ts");
    assert.equal(await payFee("builder_unlock", "Test unlock"), true, String(status));
    assert.equal(calls.pay.length, 0, "no gateway modal");
    assert.deepEqual(alerts, []);
    assert.deepEqual(events, ["unlock_started"], "only a real payment completes the funnel");
  }
});

test("payFee alerts and resolves false when the order can't be opened", async () => {
  for (const failing of [
    async () => ({ ok: false, status: 502, json: async () => ({}) }),
    async () => {
      throw new TypeError("Failed to fetch");
    },
  ]) {
    const calls = installYoupi(() => {});
    const alerts = [];
    global.window.alert = (msg) => alerts.push(msg);
    global.fetch = failing;

    const { payFee } = await import("../lib/checkout.ts");
    assert.equal(await payFee("contact_owner", "Contact owner fee", "prop_1"), false);
    assert.equal(calls.pay.length, 0);
    assert.equal(alerts.length, 1);
    assert.match(alerts[0], /Nothing was charged/);
  }
});
