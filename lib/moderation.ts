/**
 * Listing moderation and report rules. Pure (no "server-only", no env, no
 * imports) so `node --test` can load it directly; routes and lib/admin.ts do
 * the I/O.
 *
 * The one rule everything else hangs off: the public only ever sees listings
 * whose status is 'live'. A lister also sees their own pending/rejected
 * listings, and admins see everything.
 */

export const LISTING_STATUSES = ["pending", "live", "rejected"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export function isListingStatus(v: unknown): v is ListingStatus {
  return typeof v === "string" && (LISTING_STATUSES as readonly string[]).includes(v);
}

/** Clerk ids look like `user_2abc…`; anything else never reaches a filter string. */
const SAFE_USER_ID = /^[A-Za-z0-9_]{1,64}$/;

/** The subset of a Supabase query builder the visibility filter needs. */
export interface FilterableQuery<Q> {
  eq(column: string, value: string): Q;
  or(filters: string): Q;
}

/**
 * Restrict a `properties` select to what this viewer may see in a list:
 * live listings, plus the viewer's own listings in any status (so a lister
 * can find the listing they just submitted). Anonymous viewers — and anything
 * that isn't a well-formed Clerk id — get live only.
 */
export function onlyVisible<Q>(query: FilterableQuery<Q>, userId?: string | null): Q {
  if (userId && SAFE_USER_ID.test(userId)) {
    return query.or(`status.eq.live,user_id.eq.${userId}`);
  }
  return query.eq("status", "live");
}

/** Public surfaces with no viewer (sitemap, /property/[id] SSR): live only. */
export function onlyLive<Q>(query: FilterableQuery<Q>): Q {
  return query.eq("status", "live");
}

/** Single-row version of onlyVisible, for the detail route. */
export function canViewListing(
  row: { status?: string | null; user_id?: string | null },
  userId: string | null | undefined,
  isAdmin = false,
): boolean {
  if (row.status === "live") return true;
  if (isAdmin) return true;
  return !!userId && row.user_id === userId;
}

/** Listing fields a reviewer actually judged: words, photos, contact. */
export const REVIEWED_FIELDS = ["building_name", "owner", "address", "city", "photos"] as const;
type ReviewedRow = Partial<Record<(typeof REVIEWED_FIELDS)[number], unknown>>;

/** True when an edit changes anything a reviewer approved. */
export function changesReviewedContent(before: ReviewedRow, after: ReviewedRow): boolean {
  const norm = (v: unknown) => JSON.stringify(v ?? null);
  return REVIEWED_FIELDS.some((f) => norm(before[f]) !== norm(after[f]));
}

/**
 * Status a listing takes after its lister edits it. A rejected listing goes
 * back into the queue (the lister fixed it). A live listing stays live for
 * price/size tweaks, but goes back to review when its text, photos or contact
 * change — otherwise an approved listing could be edited into anything.
 */
export function statusAfterEdit(
  current: string | null | undefined,
  reviewedContentChanged = true,
): ListingStatus {
  if (current === "live") return reviewedContentChanged ? "pending" : "live";
  return "pending";
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export const REPORT_REASONS = {
  fraud: "Scam or fraud",
  wrong_info: "Wrong price or details",
  duplicate: "Duplicate listing",
  offensive: "Offensive content or photos",
  unavailable: "No longer available",
  other: "Something else",
} as const;
export type ReportReason = keyof typeof REPORT_REASONS;

export const MAX_REPORT_DETAILS = 1000;
const PROPERTY_ID = /^[A-Za-z0-9-]{1,64}$/;

export interface ReportInput {
  propertyId: string;
  reason: ReportReason;
  details: string | null;
}

export function isReportReason(v: unknown): v is ReportReason {
  return typeof v === "string" && Object.hasOwn(REPORT_REASONS, v);
}

/** Validate a POST /api/reports body. Returns the clean input or an error message. */
export function validateReport(v: unknown): ReportInput | string {
  if (v === null || typeof v !== "object" || Array.isArray(v)) return "body must be a JSON object";
  const b = v as Record<string, unknown>;
  if (typeof b.propertyId !== "string" || !PROPERTY_ID.test(b.propertyId)) {
    return "propertyId is required";
  }
  if (!isReportReason(b.reason)) {
    return `reason must be one of: ${Object.keys(REPORT_REASONS).join(", ")}`;
  }
  let details: string | null = null;
  if (b.details !== undefined && b.details !== null) {
    if (typeof b.details !== "string") return "details must be a string";
    details = b.details.trim() || null;
    if (details && details.length > MAX_REPORT_DETAILS) {
      return `details must be at most ${MAX_REPORT_DETAILS} characters`;
    }
  }
  // "Something else" with nothing said is not actionable
  if (b.reason === "other" && !details) return "details are required for reason \"other\"";
  return { propertyId: b.propertyId, reason: b.reason, details };
}

// ---------------------------------------------------------------------------
// Admin decisions
// ---------------------------------------------------------------------------

export const MAX_REVIEW_NOTE = 500;

export interface Decision<A extends string> {
  action: A;
  note: string | null;
}

function validateDecision<A extends string>(
  v: unknown,
  actions: readonly A[],
): Decision<A> | string {
  if (v === null || typeof v !== "object" || Array.isArray(v)) return "body must be a JSON object";
  const b = v as Record<string, unknown>;
  if (typeof b.action !== "string" || !(actions as readonly string[]).includes(b.action)) {
    return `action must be one of: ${actions.join(", ")}`;
  }
  let note: string | null = null;
  if (b.note !== undefined && b.note !== null) {
    if (typeof b.note !== "string") return "note must be a string";
    note = b.note.trim().slice(0, MAX_REVIEW_NOTE) || null;
  }
  return { action: b.action as A, note };
}

export const LISTING_ACTIONS = ["approve", "reject"] as const;
export const REPORT_ACTIONS = ["dismiss", "takedown"] as const;

export function validateListingDecision(v: unknown) {
  return validateDecision(v, LISTING_ACTIONS);
}

export function validateReportDecision(v: unknown) {
  return validateDecision(v, REPORT_ACTIONS);
}

// ---------------------------------------------------------------------------
// Admin identity
// ---------------------------------------------------------------------------

/** Parse ADMIN_USER_IDS ("user_a, user_b") into a set of Clerk ids. */
export function parseAdminIds(raw: string | undefined | null): Set<string> {
  return new Set(
    (raw ?? "")
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

/** Admin by env list, or by Clerk publicMetadata.role === "admin". */
export function isAdminIdentity(
  userId: string | null | undefined,
  adminIds: Set<string>,
  publicMetadata?: Record<string, unknown> | null,
): boolean {
  if (!userId) return false;
  if (adminIds.has(userId)) return true;
  return publicMetadata?.role === "admin";
}
