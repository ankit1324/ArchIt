// Platform fees in paise. Server routes are the source of truth for amounts —
// the client never sends an amount, only a purpose.
export type FeePurpose = "add_property" | "contact_owner" | "builder_unlock";

export const FEES: Record<FeePurpose, number> = {
  add_property: 10000, // ₹100
  contact_owner: 2000, // ₹20
  builder_unlock: 200000, // ₹2000, one-time per user
};

export function feeLabel(purpose: FeePurpose): string {
  return `₹${FEES[purpose] / 100}`;
}
