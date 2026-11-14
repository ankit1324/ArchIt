import {
  FACADE_COLOURS,
  FACADE_MATERIALS,
  ROOF_COLOURS,
  ROOF_STYLES,
  sanitizePlace,
  type RenderBrief,
  type RenderFacing,
  type RenderTime,
} from "./prompt.ts";

/** Largest picture accepted from the builder, decoded. Its own shots are ~200-400 KB. */
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

export interface RenderRequest extends RenderBrief {
  /** the builder's picture, base64 without the data: prefix */
  imageBase64: string;
  mime: "image/jpeg" | "image/png" | "image/webp";
}

type Parsed = { ok: true; value: RenderRequest } | { ok: false; error: string };

/** Trust the bytes, not the label on the data URL. */
function sniff(buf: Buffer): RenderRequest["mime"] | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

const pick = (table: Record<string, string>, value: unknown, fallback: string) =>
  typeof value === "string" && Object.hasOwn(table, value) ? value : fallback;

/**
 * Validate what the designer page posts. Style keys are matched against the
 * known catalog and fall back to the builder's defaults, so nothing the client
 * sends reaches the prompt as free text except the place label, which
 * sanitizePlace() strips down.
 */
export function parseRenderRequest(body: unknown): Parsed {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "invalid request" };
  const b = body as Record<string, unknown>;

  if (typeof b.image !== "string") return { ok: false, error: "image required" };
  const m = /^data:image\/(?:jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(b.image);
  if (!m) return { ok: false, error: "image must be a JPEG, PNG or WebP data URL" };
  // 4 base64 chars carry 3 bytes: refuse before decoding something enormous
  if (m[1].length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4) return { ok: false, error: "image too large" };
  const buf = Buffer.from(m[1], "base64");
  if (buf.length > MAX_IMAGE_BYTES) return { ok: false, error: "image too large" };
  const mime = sniff(buf);
  if (!mime) return { ok: false, error: "image must be a JPEG, PNG or WebP" };

  const s = (b.style && typeof b.style === "object" ? b.style : {}) as Record<string, unknown>;
  const floors = Math.min(3, Math.max(1, Math.round(Number(b.floors)) || 1));
  const facing = ["N", "E", "S", "W"].includes(b.facing as string) ? (b.facing as RenderFacing) : undefined;
  const time: RenderTime = b.time === "evening" ? "evening" : "day";

  return {
    ok: true,
    value: {
      imageBase64: buf.toString("base64"),
      mime,
      style: {
        facade: pick(FACADE_COLOURS, s.facade, "white"),
        facadeMat: pick(FACADE_MATERIALS, s.facadeMat, "paint"),
        roofStyle: pick(ROOF_STYLES, s.roofStyle, "flat"),
        roofCol: pick(ROOF_COLOURS, s.roofCol, "light"),
      },
      floors,
      facing,
      place: sanitizePlace(b.place) || undefined,
      time,
    },
  };
}
