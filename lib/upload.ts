// Photo upload contract — shared by the client form (pre-check) and
// app/api/upload/route.ts (enforcement).
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB

export const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/avif": ".avif",
};

export const SUPPORTED_MIME_TYPES = new Set(Object.keys(EXT_BY_MIME));
