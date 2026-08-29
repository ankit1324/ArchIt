import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { buildCsp } from "@/lib/csp";

// Landing (/), sign-in/up and the free lite link stay public;
// Find, the Designer and all data/payment APIs require a session.
const isProtected = createRouteMatcher([
  "/find(.*)",
  "/designer(.*)",
  "/api/properties(.*)",
  "/api/designs(.*)",
  "/api/create-order(.*)",
  "/api/verify-payment(.*)",
  "/api/purchases(.*)",
  "/api/upload(.*)",
]);

const isDev = process.env.NODE_ENV === "development";

export default clerkMiddleware(async (auth, req) => {
  if (isProtected(req)) await auth.protect();

  // Per-request nonce so the CSP can drop 'unsafe-inline' from script-src.
  // Next.js parses the nonce out of the request's Content-Security-Policy header
  // and stamps it onto its framework/page scripts; ClerkProvider (app/layout)
  // reads it from x-nonce for its own injected scripts. builder.html is excluded
  // by the matcher below and keeps the static 'unsafe-inline' CSP from
  // next.config.ts, since its inline importmap cannot carry a nonce.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp({ isDev, nonce });

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
