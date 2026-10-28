import type { FeePurpose } from "./fees";

/**
 * Pure per-purpose rules for what a `ref` may point at when a checkout session
 * is opened. No runtime imports (the FeePurpose import is type-only) so this is
 * unit-testable under `node --test`; create-order does the I/O and passes the
 * results in via `ctx`.
 *
 * Opening a session for a bad ref is money-unsafe: the payment would succeed
 * at the gateway and then either grant nothing (template that doesn't exist,
 * property the payer doesn't own) or trip the ledger and have to be refunded.
 */

export interface PurchaseRefProperty {
  /** The lister's Clerk id (null for legacy rows without one). */
  userId: string | null;
  /** Whether the listing has a non-empty owner contact to unlock. */
  hasOwner: boolean;
  /** properties.status: 'live' | 'pending' | 'rejected'. */
  status: string | null;
}

export interface PurchaseRefContext {
  /** The session user opening the order. */
  userId: string;
  /** TEMPLATE_KEYS.has(key) && isPaidTemplate(key), injected to stay import-free. */
  isPaidTemplateKey: (ref: string) => boolean;
  /** The `properties` row for `ref`, or null when none was fetched/found. */
  property: PurchaseRefProperty | null;
}

export type PurchaseRefResult = { ok: true } | { ok: false; error: string };

/** Validate `ref` for `purpose`. Returns `{ ok: true }` or a 400-able message. */
export function validatePurchaseRef(
  purpose: FeePurpose,
  ref: string | null | undefined,
  ctx: PurchaseRefContext,
): PurchaseRefResult {
  const value = typeof ref === "string" ? ref : "";

  switch (purpose) {
    case "builder_unlock":
      // one-time per user: nothing to point at
      return value === ""
        ? { ok: true }
        : { ok: false, error: "builder_unlock takes no ref" };

    case "template_unlock":
      if (!value) return { ok: false, error: "template ref required" };
      return ctx.isPaidTemplateKey(value)
        ? { ok: true }
        : { ok: false, error: "unknown or free template" };

    case "featured_property":
      if (!value) return { ok: false, error: "property ref required" };
      // only the lister may boost their own listing
      if (!ctx.property || ctx.property.userId !== ctx.userId) {
        return { ok: false, error: "property not found or not yours" };
      }
      return { ok: true };

    case "contact_owner":
      if (!value) return { ok: false, error: "property ref required" };
      if (!ctx.property) return { ok: false, error: "property not found" };
      // paying to see your own contact is nonsense; refuse rather than charge
      if (ctx.property.userId === ctx.userId) {
        return { ok: false, error: "you already own this listing" };
      }
      if (!ctx.property.hasOwner) {
        return { ok: false, error: "listing has no owner contact to unlock" };
      }
      // Only live listings are public (lib/moderation.ts); a pending or
      // rejected one may never be shown, so its contact must not be sold.
      if (ctx.property.status !== "live") {
        return { ok: false, error: "listing is not live" };
      }
      return { ok: true };

    default: {
      const never: never = purpose;
      return { ok: false, error: `unknown purpose ${String(never)}` };
    }
  }
}

/** Purposes whose ref is a `properties.id`, so create-order knows to fetch the row. */
export function refIsProperty(purpose: FeePurpose): boolean {
  return purpose === "featured_property" || purpose === "contact_owner";
}
