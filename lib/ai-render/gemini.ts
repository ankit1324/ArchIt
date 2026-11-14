/**
 * One call to Google's Gemini image model: a picture and an instruction in, a
 * picture out. Plain fetch against the documented REST endpoint, no SDK.
 *
 *   POST {baseUrl}/models/{model}:generateContent      x-goog-api-key: <key>
 *
 * Everything the caller needs injected (fetch, key, model, base URL, timeout)
 * comes in through `deps`, so tests run it without a network or a key.
 */

export type AiRenderErrorKind =
  | "blocked"   // the model's safety filter refused the picture or the prompt
  | "no_image"  // answered, but with words only
  | "busy"      // rate-limited or out of quota upstream
  | "config"    // bad key, unknown model, bad request: ours to fix
  | "timeout"
  | "upstream"; // anything else that went wrong on their side

export class AiRenderError extends Error {
  kind: AiRenderErrorKind;
  /** upstream's own words, for the server log only */
  detail?: string;
  constructor(kind: AiRenderErrorKind, message: string, detail?: string) {
    super(message);
    this.name = "AiRenderError";
    this.kind = kind;
    this.detail = detail;
  }
}

export interface RenderImageInput {
  imageBase64: string;
  mime: string;
  prompt: string;
}

export interface RenderImageDeps {
  fetch: typeof fetch;
  apiKey: string;
  model: string;
  baseUrl: string;
  timeoutMs: number;
}

interface Part {
  text?: string;
  thought?: boolean;
  inlineData?: { mimeType?: string; data?: string };
  inline_data?: { mime_type?: string; data?: string };
}

const BLOCKED = new Set(["SAFETY", "IMAGE_SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST", "IMAGE_PROHIBITED_CONTENT", "RECITATION"]);

export async function renderImage(
  input: RenderImageInput,
  deps: RenderImageDeps,
): Promise<{ mime: string; base64: string }> {
  const scrub = (s: string) => s.split(deps.apiKey).join("[key]").slice(0, 500);
  let res: Response;
  try {
    res = await deps.fetch(`${deps.baseUrl}/models/${encodeURIComponent(deps.model)}:generateContent`, {
      method: "POST",
      // the key goes in a header, never the URL, so it stays out of access logs
      headers: { "content-type": "application/json", "x-goog-api-key": deps.apiKey },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: input.prompt },
            // the REST API takes snake_case here (the SDKs use camelCase)
            { inline_data: { mime_type: input.mime, data: input.imageBase64 } },
          ],
        }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
          imageConfig: { aspectRatio: "16:9" },
        },
      }),
      signal: AbortSignal.timeout(deps.timeoutMs),
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    if (name === "TimeoutError" || name === "AbortError") throw new AiRenderError("timeout", "the image model took too long");
    throw new AiRenderError("upstream", "could not reach the image model", scrub(String(err)));
  }

  const raw = await res.text();
  if (!res.ok) {
    const detail = scrub(raw);
    if (res.status === 429) throw new AiRenderError("busy", "the image model is rate-limited", detail);
    if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 404)
      throw new AiRenderError("config", `the image model rejected the request (${res.status})`, detail);
    throw new AiRenderError("upstream", `the image model failed (${res.status})`, detail);
  }

  let data: {
    promptFeedback?: { blockReason?: string };
    candidates?: Array<{ finishReason?: string; content?: { parts?: Part[] } }>;
  };
  try {
    data = JSON.parse(raw);
  } catch {
    throw new AiRenderError("upstream", "the image model sent an unreadable answer");
  }

  if (data.promptFeedback?.blockReason) throw new AiRenderError("blocked", "the image model declined this picture", data.promptFeedback.blockReason);
  const candidate = data.candidates?.[0];
  // interim "thought" pictures come first; the answer is the one that is not a thought
  for (const part of candidate?.content?.parts ?? []) {
    if (part.thought) continue;
    const base64 = part.inlineData?.data ?? part.inline_data?.data;
    if (base64) return { mime: part.inlineData?.mimeType ?? part.inline_data?.mime_type ?? "image/png", base64 };
  }
  if (candidate?.finishReason && BLOCKED.has(candidate.finishReason))
    throw new AiRenderError("blocked", "the image model declined this picture", candidate.finishReason);
  throw new AiRenderError("no_image", "the image model answered without a picture", candidate?.finishReason);
}
