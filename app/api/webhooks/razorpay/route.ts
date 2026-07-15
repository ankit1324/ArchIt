import { validateWebhookSignature } from "razorpay/dist/utils/razorpay-utils";
import { db } from "@/lib/db";

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
        entity: {
          id: string;
          order_id: string;
          amount: number;
          status: string;
        };
      };
    };
  };

  if (event.event !== "payment.captured") {
    return Response.json({ received: true });
  }

  const payment = event.payload.payment.entity;
  const { id: payment_id, order_id, amount } = payment;

  try {
    const order = await fetch(
      `https://api.razorpay.com/v1/orders/${order_id}`,
      {
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`
          ).toString("base64")}`,
        },
      }
    ).then((r) => r.json());

    const notes = (order.notes ?? {}) as {
      purpose?: string;
      userId?: string;
      ref?: string;
    };
    const userId = notes.userId;
    const purpose = notes.purpose;
    const ref = notes.ref;

    if (!userId || !purpose) {
      return Response.json({ error: "missing notes" }, { status: 400 });
    }

    const { error } = await db.from("purchases").insert({
      user_id: userId,
      purpose,
      ref: ref ?? null,
      order_id,
      payment_id,
      amount,
    });

    if (error && error.code !== "23505") {
      return Response.json({ error: error.message }, { status: 500 });
    }
  } catch {
    return Response.json({ error: "order lookup failed" }, { status: 500 });
  }

  return Response.json({ received: true });
}
