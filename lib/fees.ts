// Platform fees in paise. Server routes are the source of truth for amounts —
// the client never sends an amount, only a purpose.
export type FeePurpose =
  | "contact_owner"      // ₹50 — unlock owner contact details
  | "featured_property"  // ₹250 — one-time boost per listing, highlights it on the map
  | "builder_unlock";    // ₹2000 — one-time per user, full builder suite

export const FEES: Record<FeePurpose, number> = {
  contact_owner: 5000,      // ₹50
  featured_property: 25000, // ₹250
  builder_unlock: 200000,   // ₹2000
};

export function feeLabel(purpose: FeePurpose): string {
  return `₹${FEES[purpose] / 100}`;
}
