"use client";

import { useEffect, useRef, useState } from "react";
import type { PublishedDesign } from "@/lib/types";

type BuilderMessage = { type: "archit:ready" } | { type: "archit:close"; dirty?: boolean };

type LoadResult =
  | { status: "error"; message: string }
  | { status: "ready"; design: PublishedDesign };

type LoadState = { status: "loading" } | LoadResult;

/**
 * Read-only 3D view of a published design, full screen. Same postMessage
 * bridge as DesignerOverlay, but the builder runs with ?view=1 and nothing is
 * ever saved back.
 */
export default function DesignViewer({
  designId,
  onClose,
}: {
  designId: string;
  onClose: () => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  // result is tagged with the id it belongs to, so switching designs shows
  // "loading" without a synchronous reset inside the effect
  const [result, setResult] = useState<{ id: string; result: LoadResult } | null>(null);
  const state: LoadState =
    result?.id === designId ? result.result : { status: "loading" };
  const loadedRef = useRef<PublishedDesign | null>(null);
  const onCloseRef = useRef(onClose);
  // Refreshed after every commit; the message listener reads it at event time.
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const ctrl = new AbortController();
    loadedRef.current = null;
    const fail = (message: string) =>
      setResult({ id: designId, result: { status: "error", message } });
    fetch(`/api/showcase/${encodeURIComponent(designId)}`, { signal: ctrl.signal })
      .then(async (r) => {
        if (r.status === 404) return fail("This design is no longer published.");
        if (!r.ok) return fail("Couldn't load this design. Try again.");
        const design = (await r.json()) as PublishedDesign;
        if (!design.design) return fail("Couldn't load this design. Try again.");
        loadedRef.current = design;
        setResult({ id: designId, result: { status: "ready", design } });
      })
      .catch(() => {
        if (!ctrl.signal.aborted) fail("Couldn't load this design. Check your connection.");
      });
    return () => ctrl.abort();
  }, [designId]);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const frame = iframeRef.current;
      if (e.origin !== location.origin || !frame || e.source !== frame.contentWindow) return;
      const m = e.data as BuilderMessage;
      if (m?.type === "archit:ready") {
        // The iframe only mounts once the design is loaded, so it is set here.
        const d = loadedRef.current;
        if (!d) return;
        frame.contentWindow?.postMessage(
          {
            type: "archit:init",
            payload: {
              design: d.design,
              plot: { w: d.plotW, d: d.plotD },
              neighbors: [],
              facing: d.facing,
            },
          },
          location.origin,
        );
      } else if (m?.type === "archit:close") {
        // read-only: nothing to discard
        onCloseRef.current();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

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
