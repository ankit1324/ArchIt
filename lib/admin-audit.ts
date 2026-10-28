import "server-only";
import type { AuditTarget } from "./admin-tools";
import { db } from "./db";

/**
 * What admin_audit_log.target_type accepts (its CHECK constraint): the
 * admin-tools targets plus 'design', added by
 * 20261028120100_audit_design_target_and_order_purpose.sql.
 */
export type AuditTargetType = AuditTarget | "design";

export interface AuditEntry {
  id: number;
  admin_id: string;
  action: string;
  target_type: AuditTargetType;
  target_id: string;
  note: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

/**
 * Record an admin action in admin_audit_log. Called after the action has
 * succeeded. Never throws: a failed log write is reported but must not undo
 * or fail the action itself.
 */
export async function logAdminAction(entry: {
  adminId: string;
  action: string;
  targetType: AuditTargetType;
  targetId: string;
  note?: string | null;
  details?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await db.from("admin_audit_log").insert({
    admin_id: entry.adminId,
    action: entry.action,
    target_type: entry.targetType,
    target_id: entry.targetId,
    note: entry.note ?? null,
    details: entry.details ?? null,
  });
  if (error) {
    console.error(
      `admin audit write failed (${entry.action} ${entry.targetType}:${entry.targetId}):`,
      error.message,
    );
  }
}

/** A Clerk user id, safe to interpolate into a PostgREST filter string. */
const PLAIN_ID = /^[A-Za-z0-9_]{1,64}$/;

/**
 * Latest entries, optionally for one record. A user's history also lists the
 * actions taken on their designs (target 'design', author in
 * details.authorId), which were logged against the user before 'design'
 * became a target type.
 */
export async function auditHistory(
  target?: { type: AuditTargetType; id: string },
  limit = 200,
): Promise<{ entries: AuditEntry[]; error: string | null }> {
  let q = db
    .from("admin_audit_log")
    .select("id, admin_id, action, target_type, target_id, note, details, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (target?.type === "user" && PLAIN_ID.test(target.id)) {
    q = q.or(
      `and(target_type.eq.user,target_id.eq.${target.id}),` +
        `and(target_type.eq.design,details->>authorId.eq.${target.id})`,
    );
  } else if (target) {
    q = q.eq("target_type", target.type).eq("target_id", target.id);
  }
  const { data, error } = await q.overrideTypes<AuditEntry[], { merge: false }>();
  return { entries: data ?? [], error: error?.message ?? null };
}
