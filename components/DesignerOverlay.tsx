"use client";

import { useEffect, useRef } from "react";
import { payFee } from "@/lib/checkout";
import { PAYWALL_ENABLED } from "@/lib/paywall";
import type { DesignMeta, DesignStateV3 } from "@/lib/types";
import type { Neighbor } from "@/lib/design";

interface DesignerOverlayProps {
  /**
   * Which opening this is. The iframe (and the builder's WebGL context) stays
   * mounted across opens; bumping this re-sends archit:init with the current
   * props, so the builder starts over on the new design without a reload.
   */
  session: number;
  /** keep the builder loaded but out of sight (e.g. behind the setup questions) */
  hidden?: boolean;
  plot: { w: number; d: number };
  neighbors: Neighbor[];
  /** floors to pre-create in the builder; new designs only */
  floors?: number;
  facing?: DesignMeta["facing"];
  /** present when reopening a saved design */
  existingDesign?: DesignStateV3;
  /**
   * Persist the design. `snapshot` is a small WebP/JPEG Blob from the builder
   * (a data-URL string only from a stale, cached builder). The result is relayed
   * back to the builder as `archit:saved`, which is when it shows "Saved".
   */
  onSave: (
    design: DesignStateV3,
    snapshot: Blob | string,
  ) => Promise<SaveResult | void> | SaveResult | void;
  onClose: () => void;
}

export interface SaveResult {
  ok: boolean;
  error?: string;
}

type BuilderMessage =
  | { type: "archit:ready" }
  | {
      type: "archit:save";
      payload: { design: DesignStateV3; snapshot: Blob | string };
    }
  | { type: "archit:close"; dirty: boolean }
  | { type: "archit:buy-template"; payload: { key: string; name: string } };

function sendInit(
  frame: HTMLIFrameElement | null,
  p: Pick<DesignerOverlayProps, "plot" | "neighbors" | "floors" | "facing" | "existingDesign">,
) {
  frame?.contentWindow?.postMessage(
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
}

export default function DesignerOverlay({
  session,
  hidden = false,
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
  const readyRef = useRef(false); // the builder has said archit:ready
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

  // Opening another design: hand it to the already-loaded builder. Before the
  // first archit:ready there is nothing to tell yet; that handshake sends it.
  useEffect(() => {
    if (readyRef.current) sendInit(iframeRef.current, propsRef.current);
  }, [session]);

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
        readyRef.current = true;
        sendInit(frame, p);
      } else if (m.type === "archit:save") {
        // Reply only after the save settles — the builder keeps "dirty" and
        // shows "Saving…" until it hears back.
        void Promise.resolve()
          .then(() => p.onSave(m.payload.design, m.payload.snapshot))
          .then(
            (r): SaveResult => r ?? { ok: true },
            (err): SaveResult => ({
              ok: false,
              error: err instanceof Error ? err.message : String(err),
            }),
          )
          .then((payload) => {
            frame.contentWindow?.postMessage(
              { type: "archit:saved", payload },
              location.origin,
            );
          });
      } else if (m.type === "archit:close") {
        if (!m.dirty || window.confirm("Discard unsaved changes?")) p.onClose();
      } else if (m.type === "archit:buy-template") {
        // Paid template (₹99): run checkout in the parent, then tell the builder
        // so it marks the key owned and loads geometry from the server (which
        // does its own ledger check — the message is a hint, not a grant).
        const { key, name } = m.payload;
        if (buyingRef.current) return; // ignore double-clicks mid-checkout
        buyingRef.current = true;
        // Paywall off: nothing to buy (the server serves every template), so
        // never open a checkout — a stale "locked" card just loads the layout.
        void (PAYWALL_ENABLED
          ? payFee("template_unlock", `Template — ${name}`, key)
          : Promise.resolve(true))
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
    <div
      className={`fixed inset-0 z-50 bg-cream ${hidden ? "invisible pointer-events-none" : ""}`}
      aria-hidden={hidden || undefined}
    >
      <iframe
        ref={iframeRef}
        src="/builder/builder.html?embed=1"
        title="ArchIt home designer"
        className="h-full w-full border-0"
      />
    </div>
  );
}
