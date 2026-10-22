/**
 * Shared JSON body parsing for route handlers. Pure (no "server-only", no
 * env) so the policy is testable; every API that reads a JSON body goes
 * through here so malformed/oversized/non-object bodies answer with a clean
 * 4xx instead of an unhandled TypeError → 500.
 */

/** Largest JSON body any route accepts; designs are capped tighter in their validator. */
export const MAX_JSON_BODY_BYTES = 256 * 1024;

/**
 * Parse and validate a JSON request body.
 *
 * `validate` receives the parsed (object) body and returns either the typed
 * value or a string error message, which becomes a 400 with that message.
 * The result is either the validated value or a ready-to-return Response.
 */
export async function parseJsonBody<T>(
  request: Request,
  validate: (v: unknown) => T | string,
  options: { maxBytes?: number } = {},
): Promise<T | Response> {
  const maxBytes = options.maxBytes ?? MAX_JSON_BODY_BYTES;
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    return Response.json({ error: "body too large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "body must be a JSON object" }, { status: 400 });
  }

  const result = validate(body);
  if (typeof result === "string") {
    return Response.json({ error: result }, { status: 400 });
  }
  return result;
}
