import { auth } from "@clerk/nextjs/server";
import { FEES, type FeePurpose } from "@/lib/fees";
import { razorpay } from "@/lib/purchases";
import { checkRateLimit, ipKey, rateLimitedResponse } from "@/lib/rate-limit";

export async function POST(request: Request) {
  const { purpose, ref } = (await request.json()) as {
    purpose?: FeePurpose;
    ref?: string;
  };
  if (!purpose || !(purpose in FEES)) {
    return Response.json({ error: "unknown purpose" }, { status: 400 });
  }
  if (ref !== undefined && ref !== null && (typeof ref !== "string" || ref.length > 64)) {
    return Response.json({ error: "invalid ref" }, { status: 400 });
  }

  const amount = FEES[purpose]; // paise, fixed server-side (min 100 enforced by fee table)
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!checkRateLimit(ipKey(request, "create-order", userId), 5, 60_000)) {
    return rateLimitedResponse();
  }
  try {
    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `${purpose}_${Date.now()}`,
      // verify-payment reads these back to record the purchase
      notes: { purpose, userId, ref: ref ?? "" },
    });
    return Response.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (e) {
    const status =
      (e as { statusCode?: number }).statusCode === 401 ? 401 : 500;
    return Response.json({ error: "order creation failed" }, { status });
  }
}
