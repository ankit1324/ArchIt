// Nominatim place search and reverse geocoding, shared by the publish dialog.
// Same URLs as app/find/page.tsx. No runtime imports so `node --test` can load
// it directly. The CSP (lib/csp.ts) allows this origin in connect-src.

const NOMINATIM = "https://nominatim.openstreetmap.org";
const MAX_LABEL = 120;

export interface PlaceHit {
  center: [number, number]; // [lng, lat]
  bbox: [[number, number], [number, number]]; // [[west, south], [east, north]]
}

export interface ReversePlace {
  /** short readable label: road, suburb, city (≤ 120 chars) */
  label: string;
  city: string;
}

/**
 * First Nominatim hit for `query`, or null when there is none. Throws when the
 * service is unavailable (or the request is aborted) so callers can tell
 * "no such place" apart from "search is down".
 */
export async function searchPlace(
  query: string,
  signal?: AbortSignal,
): Promise<PlaceHit | null> {
  const q = query.trim();
  if (!q) return null;
  const res = await fetch(
    `${NOMINATIM}/search?q=${encodeURIComponent(q)}&format=jsonv2&limit=1`,
    { signal },
  );
  if (!res.ok) throw new Error("Place search unavailable");
  const results = (await res.json()) as Array<{
    lat?: string;
    lon?: string;
    boundingbox?: [string, string, string, string];
  }>;
  const hit = Array.isArray(results) ? results[0] : undefined;
  if (!hit) return null;

  const lng = Number.parseFloat(hit.lon ?? "");
  const lat = Number.parseFloat(hit.lat ?? "");
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  const [s, n, w, e] = (hit.boundingbox ?? []).map(Number);
  const bboxOk = [s, n, w, e].every(Number.isFinite);
  return {
    center: [lng, lat],
    bbox: bboxOk
      ? [
          [w, s],
          [e, n],
        ]
      : [
          [lng, lat],
          [lng, lat],
        ],
  };
}

/**
 * Short label for a spot, e.g. "Madhya Marg, Sector 8, Chandigarh". Best
 * effort: null when the service fails or knows nothing useful about the spot.
 */
export async function reverseGeocode(
  coords: [number, number],
  signal?: AbortSignal,
): Promise<ReversePlace | null> {
  try {
    const res = await fetch(
      `${NOMINATIM}/reverse?lat=${coords[1]}&lon=${coords[0]}&format=jsonv2&zoom=18`,
      { signal },
    );
    if (!res.ok) return null;
    const j = (await res.json()) as {
      display_name?: string;
      address?: Record<string, string | undefined>;
    };
    const a = j.address ?? {};
    const city = a.city ?? a.town ?? a.village ?? "";
    const parts: string[] = [];
    for (const p of [a.road, a.suburb, city]) {
      const t = p?.trim();
      if (t && !parts.includes(t)) parts.push(t);
    }
    const label =
      parts.join(", ") ||
      (j.display_name ?? "").split(",").slice(0, 2).join(",").trim();
    if (!label) return null;
    return { label: label.slice(0, MAX_LABEL).trim(), city };
  } catch {
    return null;
  }
}
