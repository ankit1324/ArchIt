"use client";

import { useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDesignViewerBridge } from "@/components/useDesignViewerBridge";

/**
 * The builder inline in read-only view mode (?embed=1&view=1) for one
 * published design. The postMessage bridge is shared with
 * components/DesignViewer.tsx; nothing is ever saved back. The builder's own
 * Close button returns to the gallery.
 */
export default function ShowcaseViewer({ designId, name }: { designId: string; name: string }) {
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const state = useDesignViewerBridge(designId, iframeRef, () => router.push("/showcase"));

  if (state.status !== "ready") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-5 bg-paper-soft px-6 text-center">
        {state.status === "loading" ? (
          <div role="status" className="flex flex-col items-center gap-4 text-ink-soft">
            <span
              aria-hidden
              className="size-7 animate-spin rounded-full border-2 border-line border-t-accent motion-reduce:animate-none"
            />
            <span className="text-[11px] font-bold uppercase tracking-[0.14em]">Loading the 3D view…</span>
          </div>
        ) : (
          <>
            <p className="max-w-md font-display text-[22px] font-normal text-ink" role="alert">
              {state.message}
            </p>
            <Link
              href="/showcase"
              className="inline-flex min-h-11 items-center rounded-[5px] border border-line-strong px-5 py-3 text-[13px] font-semibold text-ink transition-colors hover:border-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Back to the showcase
            </Link>
          </>
        )}
      </div>
    );
  }

  return (
    <iframe
      ref={iframeRef}
      src="/builder/builder.html?embed=1&view=1"
      title={`${name} — 3D view`}
      className="min-h-0 w-full flex-1 border-0"
    />
  );
}
