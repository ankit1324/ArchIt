import { randomBytes } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { createOrderHandler, paymentsDisabled, validateOrderBody } from "@/lib/create-order";
import { db } from "@/lib/db";
import { hasPurchase } from "@/lib/entitlements";
import { PAYWALL_ENABLED } from "@/lib/paywall";
import { checkRateLimit, ipKey, rateLimitedResponse } from "@/lib/rate-limit";
import { parseJsonBody } from "@/lib/request";
import { isPaidTemplate, TEMPLATE_KEYS } from "@/lib/template-catalog";
import { createPayment, youpiPortalUrl, YoupiError } from "@/lib/youpi";

/**
 * The live wiring of lib/create-order.ts: Supabase for the ref lookup and the
 * order log, the ledger for "already owned", YouPI for the session. The
 * decision logic itself (and its tests) lives in lib/create-order.ts.
 */
const createOrder = createOrderHandler({
  paywallEnabled: PAYWALL_ENABLED,
  lookupProperty: (id) =>
    db
      .from("properties")
      .select("user_id, owner, status")
      .eq("id", id)
      .maybeSingle<{ user_id: string | null; owner: string | null; status: string | null }>(),
  isPaidTemplateKey: (key) => TEMPLATE_KEYS.has(key) && isPaidTemplate(key),
  hasPurchase,
  createPayment,
  logOrder: (row) => db.from("payment_orders").insert(row),
  newOrderId: (purpose) =>
    `${purpose}_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`,
  portalUrl: youpiPortalUrl,
  gatewayErrorStatus: (e) => (e instanceof YoupiError ? e.status : undefined),
});

/** Open a YouPI checkout session for a fixed platform fee (see lib/create-order.ts). */
export async function POST(request: Request) {
  // paywall off: nothing is for sale — answer before auth or rate limiting
  const disabled = paymentsDisabled(PAYWALL_ENABLED);
  if (disabled) return Response.json(disabled.body, { status: disabled.status });

  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!(await checkRateLimit(ipKey(request, "create-order", userId), 5, 60_000))) {
    return rateLimitedResponse();
  }

  const body = await parseJsonBody(request, validateOrderBody);
  if (body instanceof Response) return body;

  const result = await createOrder(userId, body);
  return Response.json(result.body, { status: result.status });
}
