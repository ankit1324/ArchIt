"use client";

import type { FeePurpose } from "./fees";

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  handler: (r: {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }) => void;
  modal?: { ondismiss?: () => void };
  theme?: { color?: string };
}

interface RazorpayInstance {
  open: () => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

function loadScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

/**
 * Charge a fixed platform fee. Resolves true only after the payment
 * signature has been verified server-side; false on cancel or failure.
 * `ref` ties the purchase to a thing (e.g. property id for contact unlocks)
 * so it persists in the ledger.
 */
export async function payFee(
  purpose: FeePurpose,
  description: string,
  ref?: string,
): Promise<boolean> {
  if (!(await loadScript())) return false;

  const res = await fetch("/api/create-order", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ purpose, ref }),
  });
  if (!res.ok) return false;
  const order = (await res.json()) as {
    orderId: string;
    amount: number;
    currency: string;
    keyId: string;
  };

  return new Promise<boolean>((resolve) => {
    let verificationStarted = false;
    const rzp = new window.Razorpay!({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      order_id: order.orderId,
      name: "ArchIt Find",
      description,
      theme: { color: "#4a2b4f" },
      modal: {
        ondismiss: () => {
          if (!verificationStarted) resolve(false);
        },
      },
      handler: async (r) => {
        verificationStarted = true;
        try {
          const v = await fetch("/api/verify-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(r),
          });
          // 202 = the payment is real and still settling (auto-capture in
          // flight). The webhook finishes it, so this is not an error and the
          // user must not be pushed toward paying again.
          if (v.status === 202) {
            window.alert(
              "Payment received — it’s still being confirmed. Your unlock will appear here shortly; refresh in a moment. Do not pay again.",
            );
            resolve(false);
            return;
          }
          if (!v.ok) {
            window.alert(
              "Payment could not be confirmed. If money was deducted, do not pay again—refresh the page or contact support.",
            );
          }
          resolve(v.ok);
        } catch {
          window.alert(
            "Payment could not be confirmed. If money was deducted, do not pay again—refresh the page or contact support.",
          );
          resolve(false);
        }
      },
    });
    rzp.open();
  });
}
