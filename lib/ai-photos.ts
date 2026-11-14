/**
 * AI photo requests: what a user may ask for, and what they get to see back.
 * Pure (no database, no "server-only") so tests cover it directly; the routes
 * under app/api/ai-photos and app/api/admin/ai-photos do the I/O.
 */

export const AI_PHOTOS_BUCKET = "ai-photos";
/** A user may have this many requests waiting at once. */
export const MAX_PENDING_REQUESTS = 3;
/** ...and may ask this many times in a day. */
export const MAX_REQUESTS_PER_DAY = 5;
/** Largest result an admin may attach. */
// Vercel refuses request bodies over 4.5 MB before our code runs: stay under it
export const MAX_RESULT_BYTES = 4 * 1024 * 1024;

export type AiPhotoStatus = "pending" | "done" | "rejected";

export interface AiPhotoRow {
  id: string;
  user_id: string;
  design_name: string;
  place: string | null;
  prompt: string;
  input_path: string;
  result_path: string | null;
  status: AiPhotoStatus;
  admin_note: string | null;
  created_at: string;
  completed_at: string | null;
}

/** What the requester sees: never the prompt, storage paths or anyone's id. */
export interface AiPhotoItem {
  id: string;
  status: AiPhotoStatus;
  designName: string;
  createdAt: string;
  completedAt: string | null;
  /** why it was turned down; only on a rejected request */
  note: string | null;
  /** same-origin URL of the finished photo; only on a done request */
  image: string | null;
}

/**
 * Same-origin URL of a request's finished photo, versioned by the stored
 * object: a replaced photo gets a new URL, so no browser or React re-render
 * keeps showing the old one.
 */
export function resultImageUrl(id: string, resultPath: string | null): string | null {
  if (!resultPath) return null;
  const v = /-([0-9a-f]{12})\.[a-z]+$/.exec(resultPath)?.[1];
  return `/api/ai-photos/${id}/image${v ? `?v=${v}` : ""}`;
}

export function toAiPhotoItem(row: Pick<AiPhotoRow, "id" | "status" | "design_name" | "created_at" | "completed_at" | "admin_note" | "result_path">): AiPhotoItem {
  const done = row.status === "done" && Boolean(row.result_path);
  return {
    id: row.id,
    status: row.status,
    designName: row.design_name,
    createdAt: row.created_at,
    completedAt: row.completed_at,
    note: row.status === "rejected" ? row.admin_note : null,
    image: done ? resultImageUrl(row.id, row.result_path) : null,
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isRequestId = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

/** A design name as stored with the request: plain text, one line, 80 chars. */
export function cleanDesignName(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80).trim();
}

/** The admin's reason for turning a request down, shown to the requester. */
export function cleanNote(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 300).trim();
}

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MIME: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
export const extForMime = (mime: string): string | undefined => EXT[mime];
/** Content type from a stored object name (we only ever write the three above). */
export function mimeForPath(path: string): string {
  return MIME[path.slice(path.lastIndexOf(".") + 1).toLowerCase()] ?? "application/octet-stream";
}

/** Trust the bytes, not a label: JPEG, PNG or WebP, else null. */
export function sniffImage(buf: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  const ascii = (from: number, to: number) => String.fromCharCode(...buf.subarray(from, to));
  if (buf.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "image/webp";
  return null;
}
