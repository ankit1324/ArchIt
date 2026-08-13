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
      <body
        style={{
          margin: 0,
          height: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
          background: "#f5f1ea",
          color: "#3d1830",
        }}
      >
        <div
          style={{
            maxWidth: 380,
            width: "100%",
            padding: "32px 28px",
            textAlign: "center",
            borderRadius: 24,
            background: "#ffffff",
            boxShadow: "0 8px 28px rgba(61,24,48,0.12)",
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 12 }}>⚠️</div>
          <h2 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 800 }}>
            Something went wrong
          </h2>
          <p style={{ margin: "0 0 20px", fontSize: 13.5, color: "#6b4560" }}>
            The app hit an unexpected error. Please try again.
          </p>
          <button
            onClick={() => unstable_retry()}
            style={{
              width: "100%",
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
        </div>
      </body>
    </html>
  );
}
