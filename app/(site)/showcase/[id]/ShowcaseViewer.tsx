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
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        {state.status === "loading" ? (
          <p className="font-medium text-plum-soft" role="status">
            Loading the 3D view…
          </p>
        ) : (
          <>
            <p className="font-bold text-plum" role="alert">
              {state.message}
            </p>
            <Link
              href="/showcase"
              className="rounded-full border border-plum/20 px-4 py-2 text-sm font-bold text-plum hover:bg-plum/5"
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
