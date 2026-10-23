"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { analyticsEnabled, track } from "@/lib/analytics";

// Clerk's hosted sign-up has no completion callback we can hook, so infer it:
// the first time a just-created account lands in the app, count one sign-up.
const FRESH_MS = 15 * 60_000;

export default function SignupTracker() {
  const { user } = useUser();
  useEffect(() => {
    if (!analyticsEnabled || !user?.createdAt) return;
    if (Date.now() - user.createdAt.getTime() > FRESH_MS) return;
    const key = `archit:signup-tracked:${user.id}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      // storage blocked: may double count, still better than nothing
    }
    track("signup_completed");
  }, [user]);
  return null;
}
