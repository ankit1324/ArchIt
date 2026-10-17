"use client";

import { useRef } from "react";
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

  return (
    <div className="fixed inset-0 z-50 bg-cream" role="dialog" aria-modal="true" aria-label="Design viewer">
      {state.status === "ready" ? (
        <iframe
          ref={iframeRef}
          src="/builder/builder.html?embed=1&view=1"
          title={`${state.design.name} — 3D view`}
          className="h-full w-full border-0"
        />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-4 px-4 text-center">
          {state.status === "loading" ? (
            <p className="font-medium text-plum-soft" role="status">
              Loading design…
            </p>
          ) : (
            <p className="font-bold text-plum" role="alert">
              {state.message}
            </p>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-plum/20 px-4 py-2 text-sm font-bold text-plum hover:bg-plum/5"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
