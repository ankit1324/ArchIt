import { requireAdmin } from "@/lib/admin";
import { logAdminAction } from "@/lib/admin-audit";
import { validateDesignAction } from "@/lib/admin-tools";
import { db } from "@/lib/db";
import { parseJsonBody } from "@/lib/request";
import { isDesignId } from "@/lib/showcase";

/**
 * Take a published design out of the showcase and off the /find map (and out
 * of any listing that attached it). Same effect as the author's own
 * "Unpublish": the design itself stays in the author's /designer list, and
 * they may publish it again.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminId = await requireAdmin();
  if (adminId instanceof Response) return adminId;
  const { id } = await params;
  if (!isDesignId(id)) return Response.json({ error: "not found" }, { status: 404 });
  const decision = await parseJsonBody(request, validateDesignAction);
  if (decision instanceof Response) return decision;

  const { data, error } = await db
    .from("designs")
    .update({ published_at: null, author_name: null })
    .eq("id", id)
    // only an actual change: a double-submit must not add a second audit entry
    .not("published_at", "is", null)
    .select("id, name, user_id")
    .maybeSingle<{ id: string; name: string; user_id: string }>();
  if (error) {
    console.error(`POST /api/admin/designs/${id} failed:`, error.message);
    return Response.json({ error: "internal error" }, { status: 500 });
  }
  if (!data) {
    const { data: existing, error: lookupError } = await db
      .from("designs")
      .select("id")
      .eq("id", id)
      .maybeSingle<{ id: string }>();
    if (lookupError) {
      console.error(`POST /api/admin/designs/${id} lookup failed:`, lookupError.message);
      return Response.json({ error: "internal error" }, { status: 500 });
    }
    if (!existing) return Response.json({ error: "not found" }, { status: 404 });
    // already private: idempotent, the page refreshes and drops the row
    return Response.json({ id, published: false, unchanged: true });
  }

  await logAdminAction({
    adminId,
    action: "unpublish_design",
    targetType: "design",
    targetId: data.id,
    note: decision.note,
    details: { authorId: data.user_id, name: data.name },
  });
  return Response.json({ id: data.id, published: false });
}
