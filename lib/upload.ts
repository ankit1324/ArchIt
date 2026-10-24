// Photo upload contract — shared by the client form (pre-check) and
// app/api/upload/route.ts (enforcement).
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB

/**
 * Most pixels an upload may decode to, summed over every frame of an
 * animation. A few-KB PNG can declare a 30000×30000 canvas: past this the
 * upload is refused, so neither the server's resize nor any viewer's browser
 * (which is handed the original whenever thumbnails are missing) decodes it.
 */
export const MAX_INPUT_PIXELS = 40_000_000;

/**
 * Pixel count an image header declares (width × frame height × frames), as
 * reported by sharp's metadata(); 0 when a dimension is missing.
 */
export function declaredPixels(meta: {
  width?: number;
  height?: number;
  pageHeight?: number;
  pages?: number;
}): number {
  const w = meta.width ?? 0;
  const h = meta.pageHeight ?? meta.height ?? 0;
  return w * h * Math.max(1, meta.pages ?? 1);
}

export const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
};

export const SUPPORTED_MIME_TYPES = new Set(Object.keys(EXT_BY_MIME));

/** Sniff real image type from magic bytes; null when unsupported/unknown. */
export function detectImageType(
  buf: Buffer
): "image/jpeg" | "image/png" | "image/webp" | "image/avif" | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buf.length >= 4 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 && // P
    buf[2] === 0x4e && // N
    buf[3] === 0x47 // G
  ) {
    return "image/png";
  }
  if (
    buf.length >= 12 &&
    buf.toString("ascii", 0, 4) === "RIFF" &&
    buf.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  if (buf.length >= 12 && buf.toString("ascii", 4, 8) === "ftyp") {
    const brand = buf.toString("ascii", 8, 12);
    if (brand === "avif" || brand === "avis") return "image/avif";
  }
  return null;
}
