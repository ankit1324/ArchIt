import { requireAdmin } from "@/lib/admin";
import { logAdminAction } from "@/lib/admin-audit";
import { validateOrderAction } from "@/lib/admin-tools";
import { db } from "@/lib/db";
import { parseJsonBody } from "@/lib/request";

/**
 * Close out a refund_due order once the money has been sent back from the
 * gateway's own admin. Only a refund_due order can be marked refunded.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminId = await requireAdmin();
  if (adminId instanceof Response) return adminId;
  const { id } = await params;
  const decision = await parseJsonBody(request, validateOrderAction);
  if (decision instanceof Response) return decision;

  const { data, error } = await db
    .from("payment_orders")
    .update({ status: "refunded", checked_at: new Date().toISOString() })
    .eq("order_id", id)
    .eq("status", "refund_due")
    .select("order_id, payment_id, user_id, amount")
    .maybeSingle<{ order_id: string; payment_id: string; user_id: string; amount: number }>();
  if (error) {
    console.error(`POST /api/admin/orders/${id} failed:`, error.message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
  if (!data) return Response.json({ error: "no refund-due order with that id" }, { status: 404 });

  await logAdminAction({
    adminId,
    action: "refunded",
    targetType: "order",
    targetId: id,
    note: decision.note,
    details: { payment: data.payment_id, user: data.user_id, amount: data.amount },
  });
  return Response.json({ id, status: "refunded" });
}
