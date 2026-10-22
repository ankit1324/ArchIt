import { auth } from "@clerk/nextjs/server";
import { recordPurchase } from "@/lib/purchases";
import { checkRateLimit, ipKey, rateLimitedResponse } from "@/lib/rate-limit";
import { parseJsonBody } from "@/lib/request";
import { YoupiError } from "@/lib/youpi";

function validateVerifyBody(v: unknown): { paymentId: string } | string {
  const { paymentId } = v as { paymentId?: unknown };
  if (typeof paymentId !== "string" || !paymentId || paymentId.length > 128) {
    return "missing fields";
  }
  return { paymentId };
}

/**
 * Called by the browser the moment the checkout iframe reports success. The
 * body is just a paymentId — there is nothing to sign client-side with YouPI,
 * so the only proof is re-reading the session from the gateway with our
 * merchant key (recordPurchase does that). The client never gets to claim an
 * unlock on its own.
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!(await checkRateLimit(ipKey(request, "verify-payment", userId), 10, 60_000))) {
    return rateLimitedResponse();
  }

  const body = await parseJsonBody(request, validateVerifyBody);
  if (body instanceof Response) return body;
  const { paymentId } = body;

  try {
    const failure = await recordPurchase(paymentId, userId);
    if (failure) {
      return Response.json({ error: failure.error }, { status: failure.status });
    }
  } catch (error) {
    console.error("YouPI payment lookup failed:", error);
    // A hung gateway is a 504 the client can retry; the webhook will still
    // settle the purchase either way.
    const status = error instanceof YoupiError && error.status === 504 ? 504 : 502;
    return Response.json({ error: "payment lookup failed" }, { status });
  }

  return Response.json({ verified: true });
}
