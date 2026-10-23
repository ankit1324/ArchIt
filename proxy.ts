import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { buildCsp } from "@/lib/csp";

// Landing (/), legal pages, /property/:id, sign-in/up and the free lite link
// stay public; Find, the Designer, the dashboard and all data/payment APIs
// require a session.
const isProtected = createRouteMatcher([
  "/find(.*)",
  "/designer(.*)",
  "/dashboard(.*)",
  "/api/properties(.*)",
  "/api/designs(.*)",
  "/api/create-order(.*)",
  "/api/verify-payment(.*)",
  "/api/purchases(.*)",
  "/api/upload(.*)",
  "/api/reports(.*)",
  // admin role is checked in the pages/routes (lib/admin.ts); this just
  // keeps signed-out visitors out before any handler runs
  "/admin(.*)",
  "/api/admin(.*)",
]);

// Routes rendered per request that need the strict nonce CSP: the signed-in
// app, Clerk's screens, and anything that renders user-submitted content.
// Everything else (landing, legal pages) is prerendered at build time, where no
// nonce can be stamped onto Next's inline scripts, so those get the static
// policy instead. Add the prefix of any new dynamic, user-content route here.
const NONCE_ROUTES = [
  "/find",
  "/designer",
  "/dashboard",
  "/sign-in",
  "/sign-up",
  "/property",
  "/admin",
  "/api",
];

function needsNonce(pathname: string): boolean {
  return NONCE_ROUTES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

const isDev = process.env.NODE_ENV === "development";
const staticCsp = buildCsp({ isDev });

export default clerkMiddleware(async (auth, req) => {
  if (isProtected(req)) {
    const { userId, redirectToSignIn } = await auth();
    if (!userId) {
      // APIs answer 401 JSON (auth.protect() would 404 them); pages redirect.
      if (req.nextUrl.pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }
      return redirectToSignIn({ returnBackUrl: req.url });
    }
  }

  // Signed-in visitors to "/" get the dashboard at the same URL; signed-out
  // ones get the static landing page straight from the prerender.
  let pathname = req.nextUrl.pathname;
  let rewriteTo: URL | null = null;
  if (pathname === "/") {
    const { userId } = await auth();
    if (userId) {
      rewriteTo = new URL("/dashboard", req.url);
      pathname = "/dashboard";
    }
  }

  if (!needsNonce(pathname)) {
    const res = rewriteTo ? NextResponse.rewrite(rewriteTo) : NextResponse.next();
    res.headers.set("Content-Security-Policy", staticCsp);
    return res;
  }

  // Per-request nonce so the CSP can drop 'unsafe-inline' from script-src.
  // Next.js parses the nonce out of the request's Content-Security-Policy header
  // and stamps it onto its framework/page scripts; ClerkProvider
  // (app/(app)/layout) reads it from x-nonce for its own injected scripts.
  // builder.html is excluded by the matcher below and keeps the static
  // 'unsafe-inline' CSP from next.config.ts, since its inline importmap cannot
  // carry a nonce.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp({ isDev, nonce });

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const res = rewriteTo
    ? NextResponse.rewrite(rewriteTo, { request: { headers: requestHeaders } })
    : NextResponse.next({ request: { headers: requestHeaders } });
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
