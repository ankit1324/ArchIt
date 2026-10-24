"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";

// Catches errors thrown by the root layout itself. Per the Next.js docs
// this file must render its own <html>/<body> and cannot rely on the app's
// global styles, fonts, or providers (they may be the thing that failed),
// so the styling here is deliberately inline and self-contained.
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

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
          justifyContent: "center",
          padding: "24px",
          boxSizing: "border-box",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          background: "#f5f1ea",
          color: "#3d1830",
        }}
      >
        <main
          style={{
            maxWidth: 380,
            width: "100%",
            padding: "32px 28px",
            boxSizing: "border-box",
            textAlign: "center",
            borderRadius: 24,
            background: "#ffffff",
            boxShadow: "0 8px 28px rgba(61,24,48,0.12)",
          }}
        >
          <div aria-hidden="true" style={{ fontSize: 28, marginBottom: 12 }}>
            ⚠️
          </div>
          <h1 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800 }}>
            Something went wrong
          </h1>
          <p style={{ margin: "0 0 20px", fontSize: 13.5, color: "#6b4560" }}>
            The app hit an unexpected error. Please try again.
          </p>
          <button
            type="button"
            onClick={() => unstable_retry()}
            style={{
              width: "100%",
              minHeight: 44,
              padding: "10px 0",
              borderRadius: 999,
              border: "none",
              background: "#3d1830",
              color: "#f5f1ea",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {/* Plain <a>, not next/link: when the root layout broke, a full
              document load is the reliable way back. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            style={{
              display: "block",
              marginTop: 8,
              padding: "12px 0",
              color: "#3d1830",
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            Back to home
          </a>
        </main>
      </body>
    </html>
  );
}
