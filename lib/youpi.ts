import "server-only";
import { createYoupiClient } from "./youpi-client";

export { paiseToRupees, verifyWebhookSignature } from "./youpi-signature";
export {
  YOUPI_TERMINAL,
  YOUPI_TIMEOUT_MS,
  YoupiError,
  type YoupiPayment,
  type YoupiWebhookEvent,
} from "./youpi-client";

/**
 * Live wiring of the YouPI-PG client in lib/youpi-client.ts (where the
 * protocol, headers, timeout and error mapping live, with their tests): the
 * runtime fetch and process.env. The merchant key never reaches the browser.
 */
export const { youpiApiUrl, createPayment, fetchPayment } = createYoupiClient({
  // looked up per call so Next's patched global fetch is the one used
  fetch: (url, init) => fetch(url, init),
  env: (name) => process.env[name],
});

/** Checkout portal base (serves /youpi.js and /checkout/:id). Defaults to the API URL. */
export function youpiPortalUrl(): string {
  return (
    process.env.NEXT_PUBLIC_YOUPI_PORTAL_URL ||
    process.env.YOUPI_API_URL ||
    ""
  ).replace(/\/+$/, "");
}
