"use client";

import { createContext, useContext } from "react";

// True only under app/(app)/layout.tsx, where ClerkProvider is mounted. Shared
// components (Navbar) check it so they can render Clerk widgets inside the app
// and plain sign-in links elsewhere, without pulling Clerk into public pages.
const ClerkPresence = createContext(false);

export function ClerkPresenceProvider({ children }: { children: React.ReactNode }) {
  return <ClerkPresence.Provider value>{children}</ClerkPresence.Provider>;
}

export function useClerkPresent(): boolean {
  return useContext(ClerkPresence);
}
