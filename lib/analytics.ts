import { track as vercelTrack } from "@vercel/analytics";

// Product analytics for the acquisition funnel:
//   landing CTA → sign-up completed → paid unlock.
// Vercel Web Analytics is cookieless and first-party (/_vercel/insights), so
// it needs no consent banner and no new CSP host. Opt-in per environment with
// NEXT_PUBLIC_VERCEL_ANALYTICS=1; unset (local dev, CI, forks) every call is a
// no-op and <Analytics /> renders nothing.
export const analyticsEnabled = process.env.NEXT_PUBLIC_VERCEL_ANALYTICS === "1";

export type FunnelEvent =
  | "landing_cta_click" // { cta, target }
  | "signup_completed"
  | "unlock_started" // { product }
  | "unlock_completed"; // { product }

export type FunnelProps = Record<string, string | number | boolean | null>;

/** Record a funnel step. Never pass PII (emails, phone numbers, names). */
export function track(event: FunnelEvent, props?: FunnelProps): void {
  if (!analyticsEnabled || typeof window === "undefined") return;
  try {
    vercelTrack(event, props);
  } catch {
    // analytics must never break the product flow
  }
}
