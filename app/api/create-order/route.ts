import Razorpay from "razorpay";
import { FEES, type FeePurpose } from "@/lib/fees";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export async function POST(request: Request) {
  const { purpose } = (await request.json()) as { purpose?: FeePurpose };
  if (!purpose || !(purpose in FEES)) {
    return Response.json({ error: "unknown purpose" }, { status: 400 });
  }

  const amount = FEES[purpose]; // paise, fixed server-side (min 100 enforced by fee table)
  try {
    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: `${purpose}_${Date.now()}`,
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
