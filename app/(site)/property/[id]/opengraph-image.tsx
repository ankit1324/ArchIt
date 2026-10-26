import { ImageResponse } from "next/og";
import sharp from "sharp";
import { cityName, getPublicListing, type PublicListing } from "@/lib/public-listings";
import { formatPrice } from "@/lib/types";
import { thumbnailUrl } from "@/lib/url";
import { dealLabel, headline, isDwelling, kindLabel, photosOf } from "./format";

// Per-listing link preview (WhatsApp, X, Slack…): price, deal, title and city
// on the site's cream/plum/lime palette, with the listing's first photo when
// there is one. Anything that isn't a live listing — unknown id, pending,
// rejected, a DB error — gets the generic ArchIt card instead of an error, so
// a preview never breaks and never reveals a non-public listing.

export const alt = "Property listing on ArchIt";
export const size = { width: 1200, height: 630 };
export const contentType = "image/jpeg";
// Rendered per request like the page itself, so a price edit or a listing
// taken down shows up in the next preview fetch rather than a cached card.
export const dynamic = "force-dynamic";

const CREAM = "#f5f1ea";
const PLUM = "#3d1830";
const PLUM_SOFT = "#6b4560";
const LIME = "#e2ef6a";
const MAGENTA_DEEP = "#b5359a";
const VIOLET = "#6d28d9"; // showcase listings (not for sale/rent), as on /find

const PHOTO_W = 460;

/**
 * The listing's first photo as a JPEG data URL sized for the card, or null.
 * Satori only decodes PNG/JPEG reliably and uploads are often WebP/AVIF, so
 * transcode with sharp. Only allowlisted hosts (photosOf → safeImageUrl), a
 * short timeout and a size cap: a slow or huge photo just drops the photo.
 */
async function photoDataUrl(l: PublicListing): Promise<string | null> {
  const original = photosOf(l)[0];
  if (!original) return null;
  const src = thumbnailUrl(original, 480) ?? original;
  try {
    const res = await fetch(src, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 8 * 1024 * 1024) return null;
    const jpg = await sharp(buf, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize(PHOTO_W, size.height, { fit: "cover" })
      .jpeg({ quality: 78 })
      .toBuffer();
    return `data:image/jpeg;base64,${jpg.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Re-encode the satori PNG as JPEG. With a photo the PNG is ~700 KB, past
 * the ~300 KB WhatsApp will fetch for a link preview; JPEG is a fraction.
 * Short shared cache: rendered per request, but a burst of preview fetches
 * for one freshly shared link shouldn't each redo the render.
 */
async function asJpeg(png: ImageResponse): Promise<Response> {
  const jpg = await sharp(Buffer.from(await png.arrayBuffer())).jpeg({ quality: 84 }).toBuffer();
  return new Response(new Uint8Array(jpg), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=600, s-maxage=600",
    },
  });
}

function clip(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

function Fallback() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "80px 96px",
        background: CREAM,
        color: PLUM,
      }}
    >
      <div style={{ display: "flex", fontSize: 64, fontWeight: 700, letterSpacing: -2 }}>ArchIt.</div>
      <div style={{ display: "flex", fontSize: 84, fontWeight: 700, lineHeight: 1.05, letterSpacing: -3 }}>
        Find your next home on a 3D map.
      </div>
      <div style={{ display: "flex", fontSize: 30, color: PLUM_SOFT }}>
        Browse listings across India — list your own property free.
      </div>
    </div>
  );
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let l: PublicListing | null = null;
  try {
    l = await getPublicListing(id);
  } catch (e) {
    console.error(`og image for ${id}:`, (e as Error).message);
  }
  if (!l) return asJpeg(new ImageResponse(<Fallback />, { ...size }));

  const sale = l.type === "sale";
  // sale lime, rent magenta, showcase violet
  const pillBg = l.type === "showcase" ? VIOLET : sale ? LIME : MAGENTA_DEEP;
  const pillFg = sale ? PLUM : "#ffffff";
  const photo = await photoDataUrl(l);
  const city = cityName(l.city);
  const facts = [
    kindLabel(l),
    isDwelling(l) && l.beds ? `${l.beds} bed` : null,
    isDwelling(l) && l.baths ? `${l.baths} bath` : null,
    l.sqft ? `${l.sqft.toLocaleString("en-IN")} sqft` : null,
  ].filter(Boolean) as string[];

  return asJpeg(
    new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: CREAM, color: PLUM }}>
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "64px 72px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
            <div style={{ display: "flex", fontSize: 44, fontWeight: 700, letterSpacing: -1.5 }}>ArchIt.</div>
            <div
              style={{
                display: "flex",
                fontSize: 26,
                fontWeight: 700,
                padding: "8px 20px",
                borderRadius: 999,
                background: pillBg,
                color: pillFg,
              }}
            >
              {dealLabel(l)}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div
              style={{
                display: "flex",
                alignSelf: "flex-start",
                fontSize: 76,
                fontWeight: 700,
                letterSpacing: -2,
                padding: "2px 16px",
                background: pillBg,
                color: pillFg,
              }}
            >
              {l.type === "showcase" ? "Not for sale/rent" : formatPrice(l)}
            </div>
            <div style={{ display: "flex", fontSize: 54, fontWeight: 700, lineHeight: 1.1, letterSpacing: -1.5 }}>
              {clip(headline(l), photo ? 44 : 60)}
            </div>
            <div style={{ display: "flex", fontSize: 30, color: PLUM_SOFT }}>
              {clip([city, facts.join(" · ")].filter(Boolean).join(" — "), photo ? 52 : 72)}
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 26, color: PLUM_SOFT }}>See it on the 3D map at ArchIt</div>
        </div>
        {photo ? (
          <img src={photo} alt="" width={PHOTO_W} height={size.height} style={{ objectFit: "cover" }} />
        ) : (
          // No photo: a plum panel with a line-drawn house keeps the card
          // balanced instead of leaving the right half empty.
          <div
            style={{
              width: 400,
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: PLUM,
            }}
          >
            <svg width="220" height="220" viewBox="0 0 24 24" fill="none" stroke={LIME} strokeWidth="1.4" strokeLinejoin="round">
              <path d="M3 10.5 12 3l9 7.5" />
              <path d="M5 9v11h14V9" />
              <path d="M10 20v-6h4v6" />
            </svg>
          </div>
        )}
      </div>
    ),
    { ...size },
    ),
  );
}
