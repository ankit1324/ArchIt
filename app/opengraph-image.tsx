import { ImageResponse } from "next/og";

// Statically generated at build time. Uses next/og's bundled default font, so
// no network fetch is needed to render it.
export const alt = "ArchIt — A home begins with your idea.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Planner palette from app/globals.css. ImageResponse renders outside the
// stylesheet, so the tokens have to be repeated as literals here.
const PAPER = "#f8f7f2";
const INK = "#29372c";
const INK_SOFT = "#5d665b";
const LINE = "#d8dcd2";
const ACCENT = "#ad4a31";

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
          padding: "72px 96px",
          background: PAPER,
          color: INK,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingBottom: 28,
            borderBottom: `2px solid ${LINE}`,
          }}
        >
          <div style={{ display: "flex", fontSize: 56, fontWeight: 700, letterSpacing: -2 }}>
            ArchIt<span style={{ color: ACCENT }}>.</span>
          </div>
          <div style={{ display: "flex", fontSize: 20, letterSpacing: 3, color: INK_SOFT }}>
            PLAN YOUR HOME
          </div>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 92,
            lineHeight: 1.05,
            letterSpacing: -3,
          }}
        >
          <span>A home begins</span>
          <span>
            with&nbsp;<span style={{ color: ACCENT }}>your idea.</span>
          </span>
        </div>
        <div style={{ display: "flex", fontSize: 30, color: INK_SOFT }}>
          Plan your plot, lay out rooms, explore in 3D — free in your browser.
        </div>
      </div>
    ),
    { ...size },
  );
}
