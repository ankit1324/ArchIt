import { clerkClient } from "@clerk/nextjs/server";
import { isAdmin, requireAdmin } from "@/lib/admin";
import { logAdminAction } from "@/lib/admin-audit";
import { canBan, validateUserAction } from "@/lib/admin-tools";
import { parseJsonBody } from "@/lib/request";

/**
 * Ban or unban a user through Clerk. A banned user is signed out everywhere
 * and can't sign back in; their listings stay as they are (hide them from the
 * listing pages if needed).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const adminId = await requireAdmin();
  if (adminId instanceof Response) return adminId;
  const { id } = await params;
  if (!/^user_[A-Za-z0-9]{1,64}$/.test(id)) return Response.json({ error: "not found" }, { status: 404 });
  const decision = await parseJsonBody(request, validateUserAction);
  if (decision instanceof Response) return decision;

  if (decision.action === "ban") {
    const refused = canBan(adminId, id, await isAdmin(id));
    if (refused) return Response.json({ error: refused }, { status: 400 });
  }

  try {
    const users = (await clerkClient()).users;
    if (decision.action === "ban") await users.banUser(id);
    else await users.unbanUser(id);
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status === 404) return Response.json({ error: "not found" }, { status: 404 });
    console.error(`POST /api/admin/users/${id} ${decision.action} failed:`, e instanceof Error ? e.message : e);
    return Response.json({ error: "Clerk request failed" }, { status: 502 });
  }

  await logAdminAction({
    adminId,
    action: decision.action,
    targetType: "user",
    targetId: id,
    note: decision.note,
  });
  return Response.json({ id, banned: decision.action === "ban" });
}
