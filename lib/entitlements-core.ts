import type { FeePurpose } from "./fees.ts";

/**
 * The entitlement checks with the ledger query and the paywall switch
 * injected, so they are unit-testable without Supabase or "server-only".
 * Type-only imports plus an explicit .ts extension keep this loadable by
 * `node --test`. lib/entitlements.ts wires the real dependencies.
 */

export type EntitlementResult =
  | { ok: true; granted: boolean }
  | { ok: false; error: string };

export interface EntitlementDeps {
  /** lib/paywall.ts PAYWALL_ENABLED. */
  paywallEnabled: boolean;
  /**
   * Count of purchases rows for (userId, purpose), further scoped to `ref`
   * only when one is given.
   */
  countPurchases(
    userId: string,
    purpose: FeePurpose,
    ref?: string,
  ): PromiseLike<{ count: number | null; error: { message: string } | null }>;
}

export function createEntitlements(deps: EntitlementDeps) {
  /**
   * True when the user has a recorded purchase for `purpose` (optionally scoped
   * to a specific `ref`, e.g. a property id). Returns ok:false on a DB failure so
   * callers can fail closed with a 500 instead of silently denying a paid user.
   */
  async function hasPurchase(
    userId: string,
    purpose: FeePurpose,
    ref?: string,
  ): Promise<EntitlementResult> {
    const { count, error } = await deps.countPurchases(userId, purpose, ref);
    if (error) {
      console.error(
        `entitlement check failed (${purpose}${ref ? `:${ref}` : ""}):`,
        error.message,
      );
      return { ok: false, error: "internal error" };
    }
    return { ok: true, granted: Boolean(count) };
  }

  /** One-time ₹2000 unlock for the full builder suite. */
  async function hasBuilderUnlock(userId: string): Promise<EntitlementResult> {
    return hasPurchase(userId, "builder_unlock");
  }

  /**
   * Guard for the builder routes: returns a Response to send back when the user
   * has not paid (or the check failed), or null when they may proceed.
   */
  async function builderUnlockError(userId: string): Promise<Response | null> {
    if (!deps.paywallEnabled) return null;
    const result = await hasBuilderUnlock(userId);
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: 500 });
    }
    if (!result.granted) {
      return Response.json(
        { error: "builder unlock required", purpose: "builder_unlock" },
        { status: 402 },
      );
    }
    return null;
  }

  return { hasPurchase, hasBuilderUnlock, builderUnlockError };
}
