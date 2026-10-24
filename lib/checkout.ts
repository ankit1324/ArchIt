"use client";

import type { FunnelEvent } from "./analytics";
import type { FeePurpose } from "./fees";

/**
 * Browser half of the YouPI-PG checkout. The server opens a session
 * (/api/create-order) and hands back a `checkoutUrl`; youpi.js — served by the
 * checkout portal itself — renders it in an iframe modal and reports the
 * outcome via postMessage callbacks. On success we confirm server-side
 * (/api/verify-payment) before resolving, so the UI never trusts the iframe.
 */

interface YoupiResult {
  status: string;
  order_id?: string;
  payment_id?: string;
  utr?: string;
}

interface YoupiOptions {
  checkoutUrl: string;
  portalUrl?: string;
  paymentId?: string;
  orderId?: string;
  name?: string;
  description?: string;
  theme?: { color?: string };
  onSuccess?: (r: YoupiResult) => void;
  onFailed?: (r: YoupiResult) => void;
  onExpired?: (r: YoupiResult) => void;
  onCancelled?: (r: YoupiResult) => void;
  onClose?: () => void;
}

interface YoupiStatic {
  pay: (options: YoupiOptions) => Promise<unknown> | unknown;
}

declare global {
  interface Window {
    Youpi?: YoupiStatic;
  }
}

const CONFIRM_FAILED =
  "Payment could not be confirmed. If money was deducted, do not pay again—refresh the page or contact support.";
const CONFIRM_PENDING =
  "Payment received — it’s still being confirmed. Your unlock will appear here shortly; refresh in a moment. Do not pay again.";
const START_FAILED = "Could not start the payment. Nothing was charged — please try again in a moment.";

/**
 * paid     — a payment was just verified server-side
 * unlocked — nothing to pay: already owned (409) or payments are switched off
 *            (410, lib/paywall.ts — everything is free)
 * failed   — cancelled, expired, failed or unconfirmed
 */
type CheckoutOutcome = "paid" | "unlocked" | "failed";

function loadScript(portalUrl: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Youpi) return resolve(true);
    const src = `${portalUrl.replace(/\/+$/, "")}/youpi.js`;
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(Boolean(window.Youpi)));
      existing.addEventListener("error", () => resolve(false));
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve(Boolean(window.Youpi));
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

/**
 * Report a funnel step to lib/analytics.ts via a DOM event that
 * components/Analytics.tsx forwards (a no-op when analytics is off). An event
 * rather than an import keeps this module free of the analytics SDK, so the
 * checkout tests can load it under plain Node.
 */
function funnel(event: FunnelEvent, product: FeePurpose) {
  window.dispatchEvent?.(
    new CustomEvent("archit:track", { detail: { event, props: { product } } }),
  );
}

/** The YouPI checkout round trip behind payFee(). */
async function openCheckout(
  purpose: FeePurpose,
  description: string,
  ref?: string,
): Promise<CheckoutOutcome> {
  let res: Response;
  try {
    res = await fetch("/api/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ purpose, ref }),
    });
  } catch {
    // offline / blocked: say so instead of rejecting into callers that only
    // `finally` (the unlock button would just silently re-enable)
    window.alert(START_FAILED);
    return "failed";
  }
  // The server holds the truth: 409 = already in the ledger, 410 = paywall
  // off (everything free). Either way the caller should show it unlocked and
  // re-read, not tell the user their payment failed.
  if (res.status === 409 || res.status === 410) return "unlocked";
  if (!res.ok) {
    window.alert(START_FAILED);
    return "failed";
  }
  const order = (await res.json()) as {
    paymentId: string;
    orderId: string;
    checkoutUrl: string;
    portalUrl: string;
  };

  if (!(await loadScript(order.portalUrl))) {
    window.alert(START_FAILED);
    return "failed";
  }

  return new Promise<CheckoutOutcome>((resolve) => {
    let settled = false;
    let verificationStarted = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok ? "paid" : "failed");
    };

    const verify = async () => {
      verificationStarted = true;
      try {
        const v = await fetch("/api/verify-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentId: order.paymentId }),
        });
        // 202 = the payment is real and the gateway is still settling it.
        // The webhook finishes it, so this is not an error and the user must
        // not be pushed toward paying again.
        if (v.status === 202) {
          window.alert(CONFIRM_PENDING);
          finish(false);
          return;
        }
        if (!v.ok) window.alert(CONFIRM_FAILED);
        finish(v.ok);
      } catch {
        window.alert(CONFIRM_FAILED);
        finish(false);
      }
    };

    try {
      window.Youpi!.pay({
        checkoutUrl: order.checkoutUrl,
        portalUrl: order.portalUrl,
        paymentId: order.paymentId,
        orderId: order.orderId,
        name: "ArchIt Find",
        description,
        theme: { color: "#4a2b4f" },
        onSuccess: () => void verify(),
        onFailed: () => finish(false),
        onExpired: () => finish(false),
        onCancelled: () => finish(false),
        // youpi.js closes the modal after success too, so a close that follows
        // the success callback must not clobber the in-flight verification.
        onClose: () => {
          if (!verificationStarted) finish(false);
        },
      });
    } catch {
      finish(false);
    }
  });
}

/**
 * Charge a fixed platform fee. Resolves true only after the payment has been
 * verified server-side — or when there is nothing to pay (already owned, or
 * payments switched off) — and false on cancel, expiry or failure. `ref` ties the
 * purchase to a thing (e.g. property id for contact unlocks) so it persists in
 * the ledger. Also records the unlock_started / unlock_completed funnel steps
 * (lib/analytics.ts) for every paid product in one place.
 */
export async function payFee(
  purpose: FeePurpose,
  description: string,
  ref?: string,
): Promise<boolean> {
  funnel("unlock_started", purpose);
  const outcome = await openCheckout(purpose, description, ref);
  // only a real, verified payment completes the funnel
  if (outcome === "paid") funnel("unlock_completed", purpose);
  return outcome !== "failed";
}
