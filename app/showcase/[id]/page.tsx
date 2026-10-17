"use client";

import { use, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useDesignViewerBridge } from "@/components/useDesignViewerBridge";
import { round1 } from "@/lib/showcase";

/**
 * Read-only page for one published design: a header with its details and the
 * builder inline in view mode (?embed=1&view=1). The postMessage bridge is
 * shared with components/DesignViewer.tsx; nothing is ever saved back.
 */
export default function ShowcaseDesignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const state = useDesignViewerBridge(id, iframeRef, () => router.push("/showcase"));

  if (state.status !== "ready") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 bg-cream px-6 text-center">
        {state.status === "loading" ? (
          <p className="font-medium text-plum-soft" role="status">
            Loading design…
          </p>
        ) : (
          <p className="font-bold text-plum" role="alert">
            {state.message}
          </p>
        )}
        <Link
          href="/showcase"
          className="rounded-full border border-plum/20 px-4 py-2 text-sm font-bold text-plum hover:bg-plum/5"
        >
          Back to the showcase
        </Link>
      </div>
    );
  }

  const d = state.design;
  return (
    <div className="flex h-full flex-col bg-cream">
      <header className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2 border-b border-plum/10 px-6 py-3">
        <Link
          href="/showcase"
          className="text-[12.5px] font-semibold text-plum-soft transition-colors hover:text-plum"
        >
          ← Showcase
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-extrabold text-plum">{d.name}</h1>
          <p className="truncate text-[12.5px] font-medium text-plum-soft">
            by {d.authorName}
            {d.place ? ` · ${d.place}` : ""} · Plot {round1(d.plotW)} × {round1(d.plotD)} m
          </p>
        </div>
        {d.plotCenter && (
          <Link
            href={`/find?design=${encodeURIComponent(d.id)}`}
            className="rounded-full bg-plum px-4 py-2 text-[13px] font-bold text-cream transition-opacity hover:opacity-90"
          >
            See on map
          </Link>
        )}
      </header>
      <iframe
        ref={iframeRef}
        src="/builder/builder.html?embed=1&view=1"
        title={`${d.name} — 3D view`}
        className="w-full flex-1 border-0"
      />
    </div>
  );
}
