import assert from "node:assert/strict";
import test from "node:test";

// payFee reports unlock_started / unlock_completed as "archit:track" DOM
// events that components/Analytics.tsx forwards to the analytics SDK.

function install({ outcome }) {
  const events = [];
  global.window = {
    Youpi: {
      pay(options) {
        setTimeout(() => {
          if (outcome === "success") options.onSuccess({ status: "SUCCESS" });
          else {
            options.onCancelled({ status: "CANCELLED" });
            options.onClose();
          }
        }, 5);
        return {};
      },
    },
    alert: () => {},
    dispatchEvent: (e) => events.push({ type: e.type, ...e.detail }),
  };
  global.document = {
    querySelector: () => null,
    createElement: () => ({}),
    body: { appendChild: () => {} },
  };
  global.fetch = async (url) => {
    if (url === "/api/create-order") {
      return {
        ok: true,
        json: async () => ({
          paymentId: "p1",
          orderId: "o1",
          checkoutUrl: "https://pay.example.test/checkout/p1",
          portalUrl: "https://pay.example.test",
        }),
      };
    }
    return { ok: true, status: 200, json: async () => ({ verified: true }) };
  };
  return events;
}

test("a completed unlock reports started then completed", async () => {
  const events = install({ outcome: "success" });
  const { payFee } = await import("../lib/checkout.ts");
  assert.equal(await payFee("builder_unlock", "Test unlock"), true);
  assert.deepEqual(events, [
    { type: "archit:track", event: "unlock_started", props: { product: "builder_unlock" } },
    { type: "archit:track", event: "unlock_completed", props: { product: "builder_unlock" } },
  ]);
});

test("a cancelled unlock reports only started", async () => {
  const events = install({ outcome: "cancel" });
  const { payFee } = await import("../lib/checkout.ts");
  assert.equal(await payFee("contact_owner", "Contact owner fee", "prop_1"), false);
  assert.deepEqual(events.map((e) => e.event), ["unlock_started"]);
});
