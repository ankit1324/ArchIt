"use client";

import { useEffect, useRef } from "react";
import { useDesignViewerBridge } from "@/components/useDesignViewerBridge";

/**
 * Read-only 3D view of a published design, full screen. Same postMessage
 * bridge as DesignerOverlay, but the builder runs with ?view=1 and nothing is
 * ever saved back (see useDesignViewerBridge).
 */
export default function DesignViewer({
  designId,
  onClose,
}: {
  designId: string;
  onClose: () => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const state = useDesignViewerBridge(designId, iframeRef, onClose);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-paper" role="dialog" aria-modal="true" aria-label="Design viewer">
      {state.status === "ready" ? (
        <iframe
          ref={iframeRef}
          src="/builder/builder.html?embed=1&view=1"
          title={`${state.design.name} — 3D view`}
          className="h-full w-full border-0"
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-5 bg-paper-soft px-6 text-center">
          {state.status === "loading" ? (
            <div role="status" className="flex flex-col items-center gap-4 text-ink-soft">
              <span
                aria-hidden
                className="size-7 animate-spin rounded-full border-2 border-line border-t-accent motion-reduce:animate-none"
              />
              <span className="text-[11px] font-bold uppercase tracking-[0.14em]">Loading design…</span>
            </div>
          ) : (
            <p className="max-w-md font-display text-[22px] font-normal text-ink" role="alert">
              {state.message}
            </p>
          )}
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 items-center rounded-[5px] border border-line-strong px-5 py-3 text-[13px] font-semibold text-ink transition-colors hover:border-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
