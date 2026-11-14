import { auth } from "@clerk/nextjs/server";
import { reportIncident } from "@/lib/alert";
import { AiRenderError, renderImage } from "@/lib/ai-render/gemini";
import { buildRenderPrompt } from "@/lib/ai-render/prompt";
import { MAX_IMAGE_BYTES, parseRenderRequest } from "@/lib/ai-render/request";
import { checkRateLimit } from "@/lib/rate-limit";
import { readBodyCapped } from "@/lib/request";

/**
 * AI photo of a design: the builder's own 3D picture goes to an image model
 * with the owner's colours, materials and place, and comes back as a
 * photograph.
 *
 * GET  -> { enabled, dailyLimit }   whether the designer should offer it
 * POST -> { image: "data:image/…" } one photo
 *
 * Env-gated like email and alerts: with GEMINI_API_KEY unset the feature is
 * simply off. Each picture costs money, so every signed-in user gets a daily
 * allowance, counted only for requests that actually reach the model.
 */

// the model usually answers in 10-30 s; leave room before the platform cuts us off
export const maxDuration = 60;
const MODEL_TIMEOUT_MS = 50_000;
const DAY_MS = 24 * 60 * 60_000;
// base64 inflates the picture by a third; the rest of the body is a few hundred bytes
const MAX_BODY_BYTES = Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 16 * 1024;

function config() {
  const limit = Number(process.env.AI_RENDER_DAILY_LIMIT);
  return {
    apiKey: process.env.GEMINI_API_KEY || "",
    model: process.env.AI_RENDER_MODEL || "gemini-nano-banana-2.1",
    baseUrl: process.env.AI_RENDER_API_BASE || "https://generativelanguage.googleapis.com/v1",
    dailyLimit: Number.isFinite(limit) && limit >= 1 ? Math.min(50, Math.floor(limit)) : 5,
  };
}

const fail = (status: number, error: string, message: string) =>
  Response.json({ error, message }, { status, headers: { "cache-control": "no-store" } });

/** What the person sees for each way the model can fail. */
const MESSAGES: Record<AiRenderError["kind"], [number, string]> = {
  blocked: [422, "The AI declined to paint this picture. Try the other view or light."],
  no_image: [502, "The AI answered without a picture. Try again."],
  busy: [503, "The AI is busy right now. Try again in a minute."],
  config: [500, "AI photos are not set up correctly yet. We have been told."],
  timeout: [504, "The AI took too long. Try again."],
  upstream: [502, "The AI could not make the photo. Try again."],
};

export async function GET() {
  const { userId } = await auth();
  if (!userId) return fail(401, "unauthorized", "Sign in to use AI photos.");
  const c = config();
  return Response.json({ enabled: Boolean(c.apiKey), dailyLimit: c.dailyLimit }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) return fail(401, "unauthorized", "Sign in to use AI photos.");
  const c = config();
  if (!c.apiKey) return fail(503, "not_configured", "AI photos are not switched on yet.");

  const raw = await readBodyCapped(request, MAX_BODY_BYTES);
  if (!raw) return fail(413, "too_large", "That picture is too large.");
  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(raw));
  } catch {
    return fail(400, "invalid", "Invalid request.");
  }
  const parsed = parseRenderRequest(body);
  if (!parsed.ok) return fail(400, "invalid", parsed.error);

  // counted only now, for a request that will reach the (paid) model
  if (!(await checkRateLimit(`ai-render:${userId}`, c.dailyLimit, DAY_MS))) {
    return fail(429, "rate_limited", `Daily limit of ${c.dailyLimit} AI photos reached. Try again tomorrow.`);
  }

  try {
    const out = await renderImage(
      { imageBase64: parsed.value.imageBase64, mime: parsed.value.mime, prompt: buildRenderPrompt(parsed.value) },
      { fetch, apiKey: c.apiKey, model: c.model, baseUrl: c.baseUrl, timeoutMs: MODEL_TIMEOUT_MS },
    );
    return Response.json(
      { image: `data:${out.mime};base64,${out.base64}` },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (err) {
    if (err instanceof AiRenderError) {
      console.error(`ai-render ${err.kind}: ${err.message}${err.detail ? ` | ${err.detail}` : ""}`);
      // a bad key or model id fails every request until someone fixes the env
      if (err.kind === "config") {
        await reportIncident("ai-render-config", err.message, { model: c.model, detail: err.detail });
      }
      const [status, message] = MESSAGES[err.kind];
      return fail(status, err.kind, message);
    }
    console.error("ai-render failed:", err);
    return fail(500, "internal", "Could not make the photo. Try again.");
  }
}
