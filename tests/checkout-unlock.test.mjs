import assert from "node:assert/strict";
import test from "node:test";

test("payFee ignores modal dismissal after payment handler fires", async () => {
  let modalDismissed = false;
  let verificationDone = false;

  const mockRazorpay = function (options) {
    this.open = () => {
      setTimeout(async () => {
        await options.handler({
          razorpay_payment_id: "pay_123",
          razorpay_order_id: "order_123",
          razorpay_signature: "sig_123",
        });
        verificationDone = true;
      }, 10);

      setTimeout(() => {
        if (options.modal && options.modal.ondismiss) {
          options.modal.ondismiss();
          modalDismissed = true;
        }
      }, 15);
    };
  };

  global.window = { Razorpay: mockRazorpay };
  global.document = {
    querySelector: () => true,
    createElement: () => ({}),
    body: { appendChild: () => {} },
  };
  global.fetch = async (url) => {
    if (url === "/api/create-order") {
      return {
        ok: true,
        json: async () => ({
          orderId: "order_123",
          amount: 200000,
          currency: "INR",
          keyId: "rzp_test_123",
        }),
      };
    }
    if (url === "/api/verify-payment") {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { ok: true, json: async () => ({ verified: true }) };
    }
    return { ok: false };
  };

  const { payFee } = await import("../lib/checkout.ts");
  const result = await payFee("builder_unlock", "Test unlock");

  assert.equal(result, true);
  assert.equal(verificationDone, true);
  assert.equal(modalDismissed, true);
});
