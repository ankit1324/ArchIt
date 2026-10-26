"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { PublishedDesign } from "@/lib/types";

type BuilderMessage = { type: "archit:ready" } | { type: "archit:close"; dirty?: boolean };

type LoadResult =
  | { status: "error"; message: string }
  | { status: "ready"; design: PublishedDesign };

export type ViewerLoadState = { status: "loading" } | LoadResult;

/**
 * The read-only viewer's side of the builder postMessage bridge, shared by
 * /showcase/[id] and components/DesignViewer.tsx. Fetches the published
 * design, answers the builder's `archit:ready` with `archit:init`, and calls
 * `onClose` on `archit:close`. Messages are accepted only from this origin and
 * from `iframeRef`'s own window. Mount the iframe
 * (/builder/builder.html?embed=1&view=1) only once the state is "ready".
 */
export function useDesignViewerBridge(
  designId: string,
  iframeRef: RefObject<HTMLIFrameElement | null>,
  onClose: () => void,
): ViewerLoadState {
  // tagged with the id it belongs to, so a new id reads as "loading" without a
  // synchronous reset inside the effect
  const [result, setResult] = useState<{ id: string; result: LoadResult } | null>(null);
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
        // the iframe only mounts once the design is loaded, so it is set here
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
  }, [iframeRef]);

  return result?.id === designId ? result.result : { status: "loading" };
}
