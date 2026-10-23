import * as Sentry from "@sentry/nextjs";

// Server-side error tracking only — no client SDK, so nothing is added to the
// browser bundle. Without SENTRY_DSN this is a no-op (local dev, CI).
export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  if (process.env.NEXT_RUNTIME === "nodejs" || process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
      // errors only; tracing is not wired up
      tracesSampleRate: 0,
    });
  }
}

// Uncaught errors from route handlers, server components and server actions.
export const onRequestError = Sentry.captureRequestError;
