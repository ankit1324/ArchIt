import { createHmac, timingSafeEqual } from "node:crypto";
import Razorpay from "razorpay";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export async function POST(request: Request) {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
    (await request.json()) as Record<string, string | undefined>;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return Response.json({ error: "missing fields" }, { status: 400 });
  }

  const expected = createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
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
    const order = await razorpay.orders.fetch(razorpay_order_id);
    const notes = (order.notes ?? {}) as {
      purpose?: string;
      userId?: string;
      ref?: string;
    };
    const userId = notes.userId || (await auth()).userId;
    if (!notes.purpose || !userId) {
      return Response.json({ error: "no user for purchase" }, { status: 400 });
    }
    const { error } = await db.from("purchases").insert({
      user_id: userId,
      purpose: notes.purpose,
      ref: notes.ref || null,
      order_id: razorpay_order_id,
      payment_id: razorpay_payment_id,
      amount: Number(order.amount) || null,
    });
    // 23505 = duplicate (verify retry or already-owned one-time purchase)
    if (error && error.code !== "23505") {
      return Response.json({ error: error.message }, { status: 500 });
    }
  } catch {
    return Response.json({ error: "order lookup failed" }, { status: 500 });
  }

  return Response.json({ verified: true });
}
