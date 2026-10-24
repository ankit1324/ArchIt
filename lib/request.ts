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

  // Content-Length is advisory (absent when chunked, or simply wrong), and
  // request.json() buffers the whole body before parsing — so count the bytes
  // as they arrive and stop at the cap instead of holding an unbounded body.
  let raw: Uint8Array | null;
  try {
    raw = await readBodyCapped(request, maxBytes);
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }
  if (!raw) return Response.json({ error: "body too large" }, { status: 413 });

  let body: unknown;
  try {
    // same decoding as Body.json(): UTF-8, leading BOM dropped
    body = JSON.parse(new TextDecoder().decode(raw));
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

/**
 * Read a request body, giving up as soon as it passes `maxBytes` — without
 * ever holding more than that in memory. Content-Length can be absent
 * (chunked) or a lie, and request.formData()/arrayBuffer() buffer everything
 * first; on Vercel the platform caps bodies at 4.5 MB, but self-hosted there
 * is no such ceiling. Returns null when the body is too large.
 */
export async function readBodyCapped(
  request: Request,
  maxBytes: number,
): Promise<Uint8Array | null> {
  if (!request.body) return new Uint8Array(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}
