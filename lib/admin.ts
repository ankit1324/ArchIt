import "server-only";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { isAdminIdentity, parseAdminIds } from "./moderation";

/**
 * Admin gate for /admin and /api/admin/*. An admin is either listed in
 * ADMIN_USER_IDS (comma-separated Clerk user ids — the bootstrap path) or has
 * `{"role": "admin"}` in their Clerk publicMetadata (set from the Clerk
 * dashboard, so admins can be added without a redeploy).
 */
export async function isAdmin(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  const ids = parseAdminIds(process.env.ADMIN_USER_IDS);
  if (ids.has(userId)) return true;
  try {
    const user = await (await clerkClient()).users.getUser(userId);
    return isAdminIdentity(userId, ids, user.publicMetadata);
  } catch (e) {
    // Fail closed: a Clerk outage must not open the admin area.
    console.error("admin check: Clerk lookup failed:", e instanceof Error ? e.message : e);
    return false;
  }
}

/**
 * Route-handler guard: the admin's user id, or a 404 Response for everyone
 * else (signed out included) so the admin API doesn't advertise itself.
 */
export async function requireAdmin(): Promise<string | Response> {
  const { userId } = await auth();
  if (userId && (await isAdmin(userId))) return userId;
  return Response.json({ error: "not found" }, { status: 404 });
}
