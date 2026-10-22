import { ImageResponse } from "next/og";

// Statically generated at build time. Uses next/og's bundled default font, so
// no network fetch is needed to render it.
export const alt = "ArchIt — A home begins with your idea.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CREAM = "#f4efe6";
const FOREST = "#1f3d2b";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px 96px",
          background: CREAM,
          color: FOREST,
        }}
      >
        <div style={{ display: "flex", fontSize: 64, fontWeight: 700, letterSpacing: -2 }}>
          ArchIt.
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 92,
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: -3,
            maxWidth: 900,
          }}
        >
          A home begins with your idea.
        </div>
        <div style={{ display: "flex", fontSize: 30, opacity: 0.75 }}>
          Plan your plot, lay out rooms, explore in 3D — free in your browser.
        </div>
      </div>
    ),
    { ...size },
  );
}
