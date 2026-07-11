"use client";

import { useEffect, useRef } from "react";
import type { DesignStateV3 } from "@/lib/types";
import type { Neighbor } from "@/lib/design";

interface DesignerOverlayProps {
  plot: { w: number; d: number };
  neighbors: Neighbor[];
  /** present when reopening a saved design */
  existingDesign?: DesignStateV3;
  onSave: (design: DesignStateV3, snapshotDataUrl: string) => void;
  onClose: () => void;
}

type BuilderMessage =
  | { type: "archit:ready" }
  | {
      type: "archit:save";
      payload: { design: DesignStateV3; snapshot: string };
    }
  | { type: "archit:close"; dirty: boolean };

export default function DesignerOverlay({
  plot,
  neighbors,
  existingDesign,
  onSave,
  onClose,
}: DesignerOverlayProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const propsRef = useRef({ plot, neighbors, existingDesign, onSave, onClose });
  propsRef.current = { plot, neighbors, existingDesign, onSave, onClose };

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      const frame = iframeRef.current;
      if (
        e.origin !== location.origin ||
        !frame ||
        e.source !== frame.contentWindow
      )
        return;
      const m = e.data as BuilderMessage;
      const p = propsRef.current;
      if (m.type === "archit:ready") {
        // handshake, not iframe onLoad — the module script boots async
        frame.contentWindow?.postMessage(
          {
            type: "archit:init",
            payload: {
              plot: p.plot,
              neighbors: p.neighbors,
              design: p.existingDesign,
            },
          },
          location.origin,
        );
      } else if (m.type === "archit:save") {
        p.onSave(m.payload.design, m.payload.snapshot);
      } else if (m.type === "archit:close") {
        if (!m.dirty || window.confirm("Discard unsaved changes?")) p.onClose();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-cream">
      <iframe
        ref={iframeRef}
        src="/builder/builder.html?embed=1"
        title="ArchIt home designer"
        className="h-full w-full border-0"
      />
    </div>
  );
}
