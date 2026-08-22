import "server-only";
import { db } from "./db";
import type { FeePurpose } from "./fees";

/**
 * Ledger lookups for paid entitlements. Kept free of the Razorpay SDK so route
 * handlers that only need to *check* a purchase (designs, property detail)
 * don't pull the payments client into their bundle.
 *
 * Every paid feature must gate on one of these server-side. A client-rendered
 * paywall is a UI affordance, never the enforcement point.
 */

export type EntitlementResult =
  | { ok: true; granted: boolean }
  | { ok: false; error: string };

/**
 * True when the user has a recorded purchase for `purpose` (optionally scoped
 * to a specific `ref`, e.g. a property id). Returns ok:false on a DB failure so
 * callers can fail closed with a 500 instead of silently denying a paid user.
 */
export async function hasPurchase(
  userId: string,
  purpose: FeePurpose,
  ref?: string,
): Promise<EntitlementResult> {
  let query = db
    .from("purchases")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("purpose", purpose);
  if (ref !== undefined) query = query.eq("ref", ref);

  const { count, error } = await query;
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
export async function hasBuilderUnlock(
  userId: string,
): Promise<EntitlementResult> {
  return hasPurchase(userId, "builder_unlock");
}

/**
 * Guard for the builder routes: returns a Response to send back when the user
 * has not paid (or the check failed), or null when they may proceed.
 *
 * [PAYWALL DISABLED — free for now] The ₹2000 builder_unlock check is commented
 * out so every signed-in user can use the builder. To re-enable monetization,
 * restore the body below (and the payFee("builder_unlock") flow in
 * app/designer/page.tsx + lib/checkout.ts).
 */
export async function builderUnlockError(
  userId: string,
): Promise<Response | null> {
  // --- original paid gate (restore to re-enable the paywall) ---
  // const result = await hasBuilderUnlock(userId);
  // if (!result.ok) {
  //   return Response.json({ error: result.error }, { status: 500 });
  // }
  // if (!result.granted) {
  //   return Response.json(
  //     { error: "builder unlock required", purpose: "builder_unlock" },
  //     { status: 402 },
  //   );
  // }
  void userId; // unused while the paywall is disabled
  return null;
}
