import "server-only";
import { db } from "./db";
import { createEntitlements } from "./entitlements-core";
import { PAYWALL_ENABLED } from "./paywall";

export type { EntitlementResult } from "./entitlements-core";

/**
 * Ledger lookups for paid entitlements. Kept free of the gateway client so route
 * handlers that only need to *check* a purchase (designs, property detail)
 * don't pull the payments client into their bundle.
 *
 * Every paid feature must gate on one of these server-side. A client-rendered
 * paywall is a UI affordance, never the enforcement point.
 *
 * This is the live wiring (Supabase ledger, the paywall switch); the logic and
 * its tests live in lib/entitlements-core.ts.
 */
export const { hasPurchase, hasBuilderUnlock, builderUnlockError } = createEntitlements({
  paywallEnabled: PAYWALL_ENABLED,
  countPurchases: (userId, purpose, ref) => {
    let query = db
      .from("purchases")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("purpose", purpose);
    if (ref !== undefined) query = query.eq("ref", ref);
    return query;
  },
});
