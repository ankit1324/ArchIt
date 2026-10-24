import "server-only";
import { auth, clerkClient } from "@clerk/nextjs/server";
import {
  hasVerifiedAdminEmail,
  isAdminIdentity,
  parseAdminEmails,
  parseAdminIds,
} from "./moderation";

/**
 * Admin gate for /admin and /api/admin/*. An admin is any of:
 *  - listed in ADMIN_USER_IDS (comma-separated Clerk user ids),
 *  - signed in with a *verified* email listed in ADMIN_EMAILS (no Clerk
 *    dashboard needed to bootstrap the first admin),
 *  - `{"role": "admin"}` in their Clerk publicMetadata (set from the Clerk
 *    dashboard, so admins can be added without a redeploy).
 */
export async function isAdmin(userId: string | null | undefined): Promise<boolean> {
  if (!userId) return false;
  if (parseAdminIds(process.env.ADMIN_USER_IDS).has(userId)) return true;
  try {
    return isAdminUser(await (await clerkClient()).users.getUser(userId));
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

/** Same rule as isAdmin, for a Clerk user already in hand (no extra lookup). */
export function isAdminUser(user: {
  id: string;
  publicMetadata: Record<string, unknown> | null;
  emailAddresses: ReadonlyArray<{ emailAddress: string; verification?: { status?: string | null } | null }>;
}): boolean {
  return (
    isAdminIdentity(user.id, parseAdminIds(process.env.ADMIN_USER_IDS), user.publicMetadata) ||
    hasVerifiedAdminEmail(user.emailAddresses, parseAdminEmails(process.env.ADMIN_EMAILS))
  );
}
