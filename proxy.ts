import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Landing (/), sign-in/up and the free lite link stay public;
// Find, the Designer and all data/payment APIs require a session.
const isProtected = createRouteMatcher([
  "/find(.*)",
  "/designer(.*)",
  "/api/properties(.*)",
  "/api/designs(.*)",
  "/api/upload(.*)",
  "/api/create-order(.*)",
  "/api/verify-payment(.*)",
  "/api/purchases(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtected(req)) await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
