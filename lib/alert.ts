import "server-only";
import * as Sentry from "@sentry/nextjs";

/**
 * Page a human about something that costs money or trust. console.error alone
 * only lands in function logs nobody is watching.
 *
 * Two independent channels, both env-gated so local dev and CI stay quiet:
 *   - Sentry (SENTRY_DSN, initialised in instrumentation.ts): every incident is
 *     an error-level event tagged `incident:<kind>` — point an alert rule at
 *     that tag.
 *   - ALERT_WEBHOOK_URL: a Slack or Discord incoming webhook for a direct ping
 *     that doesn't depend on Sentry being set up.
 *
 * Never throws: a broken alert channel must not fail the payment path.
 */
export async function reportIncident(
  kind: string,
  message: string,
  context: Record<string, unknown> = {},
): Promise<void> {
  console.error(`[${kind}] ${message}`, context);

  if (process.env.SENTRY_DSN) {
    try {
      Sentry.withScope((scope) => {
        scope.setLevel("error");
        scope.setTag("incident", kind);
        scope.setContext("incident", context);
        Sentry.captureMessage(message);
      });
      // Serverless functions freeze after the response; flush before that.
      await Sentry.flush(2000);
    } catch (e) {
      console.error("Sentry capture failed:", e);
    }
  }

  const hook = process.env.ALERT_WEBHOOK_URL;
  if (hook) {
    const text = `:rotating_light: [${kind}] ${message}`;
    try {
      await fetch(hook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // `text` is Slack's field, `content` Discord's — each ignores the other
        body: JSON.stringify({ text, content: text }),
        signal: AbortSignal.timeout(3000),
      });
    } catch (e) {
      console.error("Alert webhook failed:", e);
    }
  }
}
