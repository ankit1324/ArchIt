import { ClerkProvider } from "@clerk/nextjs";
import { headers } from "next/headers";
import CelebrationLayer from "@/components/Celebration";
import { ClerkPresenceProvider } from "@/components/ClerkPresence";
import SignupTracker from "@/components/SignupTracker";

// Clerk's sign-in/up cards, modals and UserButton menu in the planner palette.
// Clerk takes literal values, so these are the hex tokens from app/globals.css
// (ink, ink-soft, paper, line-strong, accent, accent-deep). Style objects
// rather than Tailwind classes in `elements`: Clerk's own styles are unlayered
// and would beat Tailwind's layered utilities.
const CLERK_APPEARANCE = {
  variables: {
    colorPrimary: "#ad4a31",
    colorPrimaryForeground: "#f8f7f2",
    colorForeground: "#29372c",
    colorMutedForeground: "#5d665b",
    colorBackground: "#f8f7f2",
    colorInput: "#fdfdfa",
    colorInputForeground: "#29372c",
    colorBorder: "#a1a99b",
    colorDanger: "#8e3b27",
    colorRing: "#ad4a31",
    colorShadow: "#29372c",
    fontFamily: "var(--font-manrope), ui-sans-serif, system-ui, sans-serif",
    borderRadius: "5px",
  },
  elements: {
    cardBox: { boxShadow: "none", border: "1px solid #d8dcd2" },
    headerTitle: {
      fontFamily: "var(--font-fraunces), Georgia, serif",
      fontWeight: 450,
      fontSize: "26px",
      letterSpacing: "-0.02em",
    },
    formButtonPrimary: { boxShadow: "none", fontWeight: 600 },
  },
} as const;

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
    <ClerkProvider nonce={nonce} appearance={CLERK_APPEARANCE}>
      <ClerkPresenceProvider>
        {children}
        <CelebrationLayer />
        <SignupTracker />
      </ClerkPresenceProvider>
    </ClerkProvider>
  );
}
