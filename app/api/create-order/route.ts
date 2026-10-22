import { randomBytes } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { hasPurchase } from "@/lib/entitlements";
import { FEES, feeLabel, type FeePurpose } from "@/lib/fees";
import { isFeePurpose } from "@/lib/payment-validation";
import {
  refIsProperty,
  validatePurchaseRef,
  type PurchaseRefProperty,
} from "@/lib/purchase-rules";
import { checkRateLimit, ipKey, rateLimitedResponse } from "@/lib/rate-limit";
import { parseJsonBody } from "@/lib/request";
import { isPaidTemplate, TEMPLATE_KEYS } from "@/lib/template-catalog";
import { createPayment, youpiPortalUrl, YoupiError } from "@/lib/youpi";

const DESCRIPTIONS: Record<FeePurpose, string> = {
  contact_owner: "Owner contact unlock",
  featured_property: "Featured listing boost",
  builder_unlock: "3D Builder — full access",
  template_unlock: "Floor-plan template",
};

const MAX_REF = 64;

interface OrderBody {
  purpose: FeePurpose;
  /** "" when absent */
  ref: string;
}

function validateOrderBody(v: unknown): OrderBody | string {
  const { purpose, ref } = v as { purpose?: unknown; ref?: unknown };
  // isFeePurpose, not `purpose in FEES`: `in` walks the prototype chain, so
  // "toString" would reach FEES[purpose] and DESCRIPTIONS[purpose].
  if (typeof purpose !== "string" || !isFeePurpose(purpose)) return "unknown purpose";
  if (ref !== undefined && ref !== null && (typeof ref !== "string" || ref.length > MAX_REF)) {
    return "invalid ref";
  }
  return { purpose, ref: typeof ref === "string" ? ref : "" };
}

/**
 * Open a YouPI checkout session for a fixed platform fee. The browser sends
 * only a purpose (and an optional ref); the amount is resolved server-side and
 * purpose/userId/ref are stashed in gateway metadata so verify-payment and the
 * webhook can record the purchase without trusting the client.
 *
 * Before any session is opened the ref is checked against what the purpose
 * means (lib/purchase-rules.ts) and the ledger is consulted: a payment for
 * something the user already owns would succeed at the gateway and then be
 * refused by the ledger — money we'd owe back.
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!(await checkRateLimit(ipKey(request, "create-order", userId), 5, 60_000))) {
    return rateLimitedResponse();
  }

  const body = await parseJsonBody(request, validateOrderBody);
  if (body instanceof Response) return body;
  const { purpose, ref } = body;

  let property: PurchaseRefProperty | null = null;
  if (refIsProperty(purpose) && ref) {
    const { data, error } = await db
      .from("properties")
      .select("id, user_id, owner")
      .eq("id", ref)
      .maybeSingle<{ id: string; user_id: string | null; owner: string | null }>();
    if (error) {
      console.error(`create-order ref lookup failed for ${purpose}:${ref}:`, error.message);
      return Response.json({ error: "internal error" }, { status: 500 });
    }
    if (data) {
      property = { userId: data.user_id, hasOwner: Boolean(data.owner?.trim()) };
    }
  }

  const rule = validatePurchaseRef(purpose, ref, {
    userId,
    isPaidTemplateKey: (key) => TEMPLATE_KEYS.has(key) && isPaidTemplate(key),
    property,
  });
  if (!rule.ok) return Response.json({ error: rule.error }, { status: 400 });

  // Never open a gateway session for something already owned.
  const owned = await hasPurchase(userId, purpose, ref || undefined);
  if (!owned.ok) return Response.json({ error: owned.error }, { status: 500 });
  if (owned.granted) {
    return Response.json({ error: "already purchased" }, { status: 409 });
  }

  const amount = FEES[purpose]; // paise, fixed server-side

  // Our own order id: also the gateway's Idempotency-Key, so a double-click
  // can't open two sessions for one intent.
  const orderId = `${purpose}_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
  try {
    const payment = await createPayment({
      orderId,
      amountPaise: amount,
      description: `${DESCRIPTIONS[purpose]} (${feeLabel(purpose)})`,
      metadata: { purpose, userId, ref },
    });
    if (!payment.checkoutUrl || !payment.paymentId) {
      console.error("YouPI create-payment returned no checkoutUrl:", payment);
      return Response.json({ error: "order creation failed" }, { status: 502 });
    }
    return Response.json({
      paymentId: payment.paymentId,
      orderId: payment.orderId,
      amount,
      currency: "INR",
      checkoutUrl: payment.checkoutUrl,
      portalUrl: youpiPortalUrl(),
    });
  } catch (e) {
    if (e instanceof YoupiError) {
      console.error(`YouPI create-payment failed (${e.status}):`, e.message);
      // 401 = our merchant key is wrong; 504 = it hung; everything else is the gateway's problem
      const status = e.status === 401 ? 500 : e.status === 504 ? 504 : 502;
      return Response.json({ error: "order creation failed" }, { status });
    }
    console.error("YouPI create-payment failed:", e);
    return Response.json({ error: "order creation failed" }, { status: 502 });
  }
}
