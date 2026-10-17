"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PublishedDesign } from "@/lib/types";

type BuilderMessage = { type: "archit:ready" } | { type: "archit:close"; dirty?: boolean };

type LoadResult =
  | { status: "error"; message: string }
  | { status: "ready"; design: PublishedDesign };

type LoadState = { status: "loading" } | LoadResult;

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Read-only page for one published design: a header with its details and the
 * builder inline in view mode (?embed=1&view=1). Same postMessage bridge as
 * components/DesignViewer.tsx; nothing is ever saved back.
 */
export default function ShowcaseDesignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const loadedRef = useRef<PublishedDesign | null>(null);
  // tagged with the id it belongs to, so a new id reads as "loading" without a
  // synchronous reset inside the effect
  const [result, setResult] = useState<{ id: string; result: LoadResult } | null>(null);
  const state: LoadState = result?.id === id ? result.result : { status: "loading" };

  useEffect(() => {
    const ctrl = new AbortController();
    loadedRef.current = null;
    const fail = (message: string) =>
      setResult({ id, result: { status: "error", message } });
    fetch(`/api/showcase/${encodeURIComponent(id)}`, { signal: ctrl.signal })
      .then(async (r) => {
        if (r.status === 404) return fail("This design isn't published any more.");
        if (!r.ok) return fail("Couldn't load this design. Try again.");
        const design = (await r.json()) as PublishedDesign;
        if (!design.design) return fail("Couldn't load this design. Try again.");
        loadedRef.current = design;
        setResult({ id, result: { status: "ready", design } });
      })
      .catch(() => {
        if (!ctrl.signal.aborted) fail("Couldn't load this design. Check your connection.");
      });
    return () => ctrl.abort();
  }, [id]);

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
        router.push("/showcase");
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [router]);

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
