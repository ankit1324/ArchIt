import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";

/**
 * Mark a contact message handled (the admin replied by email). Idempotent:
 * an already-handled message keeps its original handled_at/handled_by.
 * Body is ignored (AdminAction posts `{ action, note }`).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminId = await requireAdmin();
  if (adminId instanceof Response) return adminId;
  const { id } = await params;
  if (!/^\d{1,18}$/.test(id)) return Response.json({ error: "not found" }, { status: 404 });

  const { data, error } = await db
    .from("contact_messages")
    .update({ status: "handled", handled_at: new Date().toISOString(), handled_by: adminId })
    .eq("id", id)
    .eq("status", "open")
    .select("id")
    .maybeSingle<{ id: number }>();
  if (error) {
    console.error(`POST /api/admin/contact/${id} failed:`, error.message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
  if (!data) {
    // Either it doesn't exist or someone already handled it.
    const { data: existing } = await db
      .from("contact_messages")
      .select("id")
      .eq("id", id)
      .maybeSingle<{ id: number }>();
    if (!existing) return Response.json({ error: "not found" }, { status: 404 });
  }
  return Response.json({ id: Number(id), status: "handled" });
}
