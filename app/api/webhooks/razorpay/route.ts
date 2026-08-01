import { validateWebhookSignature } from "razorpay/dist/utils/razorpay-utils";
import { recordPurchaseFromOrder } from "@/lib/purchases";

const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET!;

export async function POST(request: Request) {
  const signature = request.headers.get("x-razorpay-signature");
  if (!signature) {
    return Response.json({ error: "missing signature" }, { status: 400 });
  }

  const body = await request.text();
  let verified: boolean;
  try {
    verified = validateWebhookSignature(body, signature, WEBHOOK_SECRET);
  } catch {
    return Response.json({ error: "signature verification failed" }, { status: 400 });
  }
  if (!verified) {
    return Response.json({ error: "invalid signature" }, { status: 400 });
  }

  const event = JSON.parse(body) as {
    event: string;
    payload: {
      payment: {
        entity: { id: string; order_id: string };
      };
    };
  };

  if (event.event !== "payment.captured") {
    return Response.json({ received: true });
  }

  const payment = event.payload.payment.entity;
  try {
    const failure = await recordPurchaseFromOrder(payment.order_id, payment.id);
    if (failure) {
      return Response.json({ error: failure.error }, { status: failure.status });
    }
  } catch {
    return Response.json({ error: "order lookup failed" }, { status: 500 });
  }

  return Response.json({ received: true });
}
