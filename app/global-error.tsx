"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";

// Catches errors thrown by the root layout itself. Per the Next.js docs
// this file must render its own <html>/<body> and cannot rely on the app's
// global styles, fonts, or providers (they may be the thing that failed),
// so the styling here is deliberately inline and self-contained. Colours are
// the planner tokens from app/globals.css, copied as literals for that reason.
const PAPER = "#f8f7f2";
const INK = "#29372c";
const INK_SOFT = "#5d665b";
const LINE = "#d8dcd2";
const LINE_STRONG = "#a1a99b";
const ACCENT = "#ad4a31";

// Next 16.4 passes `retry`; `unstable_retry` no longer exists at runtime.
export default function GlobalError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const button = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    minHeight: 44,
    padding: "12px 20px",
    borderRadius: 5,
    fontFamily: "inherit",
    fontSize: 13,
    fontWeight: 600,
    textDecoration: "none",
    cursor: "pointer",
  } as const;

  return (
    <html lang="en">
      {/* React 19 hoists <title> into <head>; a client file can't export metadata */}
      <title>Something went wrong · ArchIt</title>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          padding: "48px clamp(20px, 5.5vw, 84px)",
          boxSizing: "border-box",
          fontFamily:
            "Manrope, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
          background: PAPER,
          color: INK,
        }}
      >
        <main style={{ maxWidth: 560, width: "100%", margin: "0 auto" }}>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              paddingBottom: 20,
              borderBottom: `1px solid ${LINE}`,
            }}
          >
            ArchIt<span style={{ color: ACCENT }}>.</span>
          </p>
          <h1
            style={{
              margin: "28px 0 0",
              fontFamily: "Fraunces, Georgia, 'Times New Roman', serif",
              fontSize: "clamp(34px, 6vw, 48px)",
              fontWeight: 400,
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
            }}
          >
            Something went wrong.
          </h1>
          <p style={{ margin: "18px 0 30px", fontSize: 15, lineHeight: 1.8, color: INK_SOFT }}>
            The app hit an unexpected error. Please try again.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <button
              type="button"
              onClick={() => retry()}
              style={{ ...button, border: `1px solid ${ACCENT}`, background: ACCENT, color: PAPER }}
            >
              Try again
            </button>
            {/* Plain <a>, not next/link: when the root layout broke, a full
                document load is the reliable way back. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/"
              style={{ ...button, border: `1px solid ${LINE_STRONG}`, background: "transparent", color: INK }}
            >
              Back to home
            </a>
          </div>
        </main>
      </body>
    </html>
  );
}
