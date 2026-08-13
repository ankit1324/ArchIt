"use client";

import { useEffect, useRef } from "react";
import { payFee } from "@/lib/checkout";
import type { DesignMeta, DesignStateV3 } from "@/lib/types";
import type { Neighbor } from "@/lib/design";

interface DesignerOverlayProps {
  plot: { w: number; d: number };
  neighbors: Neighbor[];
  /** floors to pre-create in the builder; new designs only */
  floors?: number;
  facing?: DesignMeta["facing"];
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
  | { type: "archit:close"; dirty: boolean }
  | { type: "archit:buy-template"; payload: { key: string; name: string } };

export default function DesignerOverlay({
  plot,
  neighbors,
  floors,
  facing,
  existingDesign,
  onSave,
  onClose,
}: DesignerOverlayProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const buyingRef = useRef(false);
  const propsRef = useRef({
    plot,
    neighbors,
    floors,
    facing,
    existingDesign,
    onSave,
    onClose,
  });
  // Refreshed after every commit, not during render: the message listener below
  // mounts once and reads propsRef at event time, which is always post-commit.
  useEffect(() => {
    propsRef.current = {
      plot,
      neighbors,
      floors,
      facing,
      existingDesign,
      onSave,
      onClose,
    };
  });

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
              floors: p.floors,
              facing: p.facing,
              design: p.existingDesign,
            },
          },
          location.origin,
        );
      } else if (m.type === "archit:save") {
        p.onSave(m.payload.design, m.payload.snapshot);
      } else if (m.type === "archit:close") {
        if (!m.dirty || window.confirm("Discard unsaved changes?")) p.onClose();
      } else if (m.type === "archit:buy-template") {
        // Checkout lives here, not in the iframe: the builder is a static file
        // and must never hold payment logic. On success we only signal the key —
        // the geometry still comes from the server, which re-checks the ledger.
        const { key, name } = m.payload;
        if (buyingRef.current) return; // ignore double-clicks mid-checkout
        buyingRef.current = true;
        void payFee("template_unlock", `Template — ${name}`, key)
          .then((paid) => {
            if (!paid) return;
            frame.contentWindow?.postMessage(
              { type: "archit:template-purchased", payload: { key } },
              location.origin,
            );
          })
          .finally(() => {
            buyingRef.current = false;
          });
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
