/**
 * Pure helpers for the admin area: query-string parsing, search sanitising
 * and action validation. No runtime imports beyond the import-free
 * moderation module, so `node --test` can load this directly.
 */
import { isListingStatus, validateDecision, type ListingStatus } from "./moderation.ts";

export const ADMIN_PAGE_SIZE = 50;

/** Things the audit log records (lib/admin-audit.ts). */
export type AuditTarget = "listing" | "report" | "user" | "order";

export interface ListingFilters {
  q: string;
  status: ListingStatus | "all";
  page: number;
}

type SearchParamsLike = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

/** 1-based page number from ?page=, clamped to a sane range. */
export function parsePage(raw: string | string[] | undefined): number {
  const n = Number.parseInt(first(raw), 10);
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 1000) : 1;
}

/**
 * Free-text search for a PostgREST `or=(…ilike…)` filter. Characters with
 * meaning in that syntax (`,` `(` `)` `*` `%` `\` `:` `"`) are dropped, so a
 * search can only ever narrow results, never inject another filter.
 */
export function sanitizeSearch(raw: string | string[] | undefined): string {
  return first(raw)
    .replace(/[,()*%\\:"]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export function parseListingFilters(sp: SearchParamsLike): ListingFilters {
  const status = first(sp.status);
  return {
    q: sanitizeSearch(sp.q),
    status: isListingStatus(status) ? status : "all",
    page: parsePage(sp.page),
  };
}

/** `or` filter matching the search across the listing's text columns. */
export function listingSearchFilter(q: string): string | null {
  if (!q) return null;
  const like = `%${q}%`;
  return ["building_name", "address", "city", "id"].map((c) => `${c}.ilike.${like}`).join(",");
}

export const USER_ACTIONS = ["ban", "unban"] as const;
export const ORDER_ACTIONS = ["refunded"] as const;

export function validateUserAction(v: unknown) {
  return validateDecision(v, USER_ACTIONS);
}

export function validateOrderAction(v: unknown) {
  return validateDecision(v, ORDER_ACTIONS);
}

/**
 * Whether `actorId` may ban `targetId`. Admins can't ban themselves (an easy
 * lock-out) or another admin (demote them first).
 */
export function canBan(actorId: string, targetId: string, targetIsAdmin: boolean): string | null {
  if (actorId === targetId) return "you can't ban yourself";
  if (targetIsAdmin) return "can't ban an admin — remove their admin access first";
  return null;
}

/** Sum of paise amounts, ignoring nulls (legacy rows). */
export function sumPaise(rows: ReadonlyArray<{ amount: number | null }>): number {
  return rows.reduce((s, r) => s + (typeof r.amount === "number" ? r.amount : 0), 0);
}

/** "3 days", "5 hours", "just now" — the age of the oldest pending listing. */
export function ageLabel(iso: string | null, now = Date.now()): string {
  if (!iso) return "—";
  const ms = Math.max(0, now - new Date(iso).getTime());
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return "under an hour";
  if (h < 48) return `${h} hour${h === 1 ? "" : "s"}`;
  const d = Math.floor(h / 24);
  return `${d} days`;
}
