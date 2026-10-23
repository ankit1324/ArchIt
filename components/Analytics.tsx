"use client";

import { useEffect } from "react";
import { Analytics as VercelAnalytics } from "@vercel/analytics/next";
import { analyticsEnabled, track, type FunnelEvent, type FunnelProps } from "@/lib/analytics";

/**
 * Cookieless page views + funnel events (see lib/analytics.ts). Query strings
 * are stripped before sending: sign-in redirect targets and search params are
 * not analytics data. Also forwards "archit:track" DOM events, which modules
 * that must not import the SDK (lib/checkout.ts) use to report funnel steps.
 */
export default function Analytics() {
  useEffect(() => {
    if (!analyticsEnabled) return;
    const onTrack = (e: Event) => {
      const { event, props } = (e as CustomEvent<{ event: FunnelEvent; props?: FunnelProps }>).detail;
      track(event, props);
    };
    window.addEventListener("archit:track", onTrack);
    return () => window.removeEventListener("archit:track", onTrack);
  }, []);

  if (!analyticsEnabled) return null;
  return (
    <VercelAnalytics
      beforeSend={(event) => ({ ...event, url: event.url.split("?")[0] })}
    />
  );
}
