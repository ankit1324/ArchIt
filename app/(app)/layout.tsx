import { ClerkProvider } from "@clerk/nextjs";
import { headers } from "next/headers";
import CelebrationLayer from "@/components/Celebration";
import { ClerkPresenceProvider } from "@/components/ClerkPresence";
import SignupTracker from "@/components/SignupTracker";

// The signed-in app: Find, the Designer, the dashboard and Clerk's own screens.
// Only these routes ship Clerk's client bundle (and clerk.browser.js);
// marketing and legal pages outside this group stay prerendered and Clerk-free.
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // The nonce is minted per request in proxy.ts. Reading it here also opts
  // these pages into dynamic rendering, which a per-request nonce requires.
  // Clerk needs it so its injected scripts satisfy the nonce-based CSP.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <ClerkProvider nonce={nonce}>
      <ClerkPresenceProvider>
        {children}
        <CelebrationLayer />
        <SignupTracker />
      </ClerkPresenceProvider>
    </ClerkProvider>
  );
}
