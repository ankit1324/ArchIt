import { createHmac, timingSafeEqual } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { recordPurchaseFromOrder } from "@/lib/purchases";
import { checkRateLimit, ipKey, rateLimitedResponse } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!checkRateLimit(ipKey(request, "verify-payment", userId), 10, 60_000)) {
    return rateLimitedResponse();
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    (await request.json()) as Record<string, string | undefined>;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return Response.json({ error: "missing fields" }, { status: 400 });
  }

  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    console.error("RAZORPAY_KEY_SECRET unset");
    return Response.json({ error: "payment not configured" }, { status: 500 });
  }

  const expected = createHmac("sha256", secret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(razorpay_signature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return Response.json({ error: "signature mismatch" }, { status: 400 });
  }

  // Every verified payment lands in the purchases ledger, server-side only,
  // after the signature check — the client never gets to claim an unlock.
  try {
    const failure = await recordPurchaseFromOrder(
      razorpay_order_id,
      razorpay_payment_id,
      userId,
    );
    if (failure) {
      return Response.json({ error: failure.error }, { status: failure.status });
    }
  } catch (error) {
    console.error("Razorpay order lookup failed:", error);
    return Response.json({ error: "order lookup failed" }, { status: 502 });
  }

  return Response.json({ verified: true });
}
