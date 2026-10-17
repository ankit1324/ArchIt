"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import { round1 } from "@/lib/showcase";
import { nextImageUrl } from "@/lib/url";
import type { PublishedDesign } from "@/lib/types";

const PAGE_SIZE = 24;

function publishedOn(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function DesignCard({ d }: { d: PublishedDesign }) {
  // the author controls this URL: anything next/image would reject gets the
  // placeholder instead of a broken image
  const src = nextImageUrl(d.snapshot);
  const date = publishedOn(d.publishedAt);
  return (
    <Link
      href={`/showcase/${encodeURIComponent(d.id)}`}
      className="group flex flex-col overflow-hidden rounded-3xl bg-white/70 shadow-sm transition-shadow hover:shadow-md"
    >
      <span className="relative block aspect-[4/3] w-full overflow-hidden bg-cream-soft">
        {src ? (
          <Image
            src={src}
            alt=""
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-[12px] font-semibold text-plum-soft">
            No preview
          </span>
        )}
        {d.mine && (
          <span className="absolute left-3 top-3 rounded-full bg-plum px-2.5 py-0.5 text-[11px] font-bold text-cream">
            Yours
          </span>
        )}
      </span>
      <span className="flex flex-col gap-1 p-4">
        <span className="truncate text-[15px] font-extrabold text-plum">{d.name}</span>
        <span className="truncate text-[12.5px] font-semibold text-plum-soft">
          by {d.authorName}
        </span>
        {d.place && (
          <span className="truncate text-[12.5px] font-medium text-plum-soft">{d.place}</span>
        )}
        <span className="mt-1 flex items-center justify-between text-[12px] font-medium text-plum-soft">
          <span>
            Plot {round1(d.plotW)} × {round1(d.plotD)} m
          </span>
          {date && <span>{date}</span>}
        </span>
      </span>
    </Link>
  );
}

type Status = "loading" | "ready" | "error";

export default function ShowcasePage() {
  const [designs, setDesigns] = useState<PublishedDesign[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/showcase?limit=${PAGE_SIZE}`, { signal: ctrl.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error(`showcase ${r.status}`);
        const page = (await r.json()) as PublishedDesign[];
        setDesigns(page);
        setHasMore(page.length === PAGE_SIZE);
        setStatus("ready");
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setStatus("error");
      });
    return () => ctrl.abort();
  }, [attempt]);

  async function loadMore() {
    const last = designs[designs.length - 1];
    if (!last || loadingMore) return;
    setLoadingMore(true);
    setMoreError(false);
    try {
      const r = await fetch(
        `/api/showcase?limit=${PAGE_SIZE}&before=${encodeURIComponent(last.publishedAt)}`,
      );
      if (!r.ok) throw new Error(`showcase ${r.status}`);
      const page = (await r.json()) as PublishedDesign[];
      // a design re-published between pages could repeat; keep ids unique
      setDesigns((prev) => {
        const seen = new Set(prev.map((d) => d.id));
        return [...prev, ...page.filter((d) => !seen.has(d.id))];
      });
      setHasMore(page.length === PAGE_SIZE);
    } catch {
      setMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <div className="flex h-full flex-col bg-cream">
      <Navbar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl px-6 pb-16 pt-6">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-extrabold text-plum">Showcase</h1>
              <p className="mt-1 text-[13.5px] font-medium text-plum-soft">
                Homes designed by the ArchIt community. Open one to walk around it in 3D.
              </p>
            </div>
            <Link
              href="/designer"
              className="rounded-full bg-plum px-4 py-2 text-[13px] font-bold text-cream transition-opacity hover:opacity-90"
            >
              Design your own
            </Link>
          </div>

          {status === "loading" && (
            <p className="py-16 text-center font-medium text-plum-soft" role="status">
              Loading designs…
            </p>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center gap-4 py-16 text-center" role="alert">
              <p className="font-bold text-plum">Couldn&apos;t load the showcase.</p>
              <button
                type="button"
                onClick={() => {
                  setStatus("loading");
                  setAttempt((a) => a + 1);
                }}
                className="rounded-full border border-plum/20 px-4 py-2 text-sm font-bold text-plum hover:bg-plum/5"
              >
                Try again
              </button>
            </div>
          )}

          {status === "ready" && designs.length === 0 && (
            <div className="glass mx-auto mt-10 max-w-sm rounded-3xl p-8 text-center">
              <h2 className="text-lg font-extrabold text-plum">Nothing published yet</h2>
              <p className="mt-2 text-[13.5px] font-medium text-plum-soft">
                Design a home and publish it to be the first one here.
              </p>
              <Link
                href="/designer"
                className="mt-6 inline-block w-full rounded-full bg-plum py-2.5 text-[13px] font-bold text-cream transition-opacity hover:opacity-90"
              >
                Open the designer
              </Link>
            </div>
          )}

          {status === "ready" && designs.length > 0 && (
            <>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {designs.map((d) => (
                  <DesignCard key={d.id} d={d} />
                ))}
              </div>
              {(hasMore || moreError) && (
                <div className="mt-8 flex flex-col items-center gap-2">
                  {moreError && (
                    <p className="text-[13px] font-semibold text-coral" role="alert">
                      Couldn&apos;t load more designs.
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="rounded-full border border-plum/20 px-5 py-2 text-[13px] font-bold text-plum transition-colors hover:bg-plum/5 disabled:opacity-50"
                  >
                    {loadingMore ? "Loading…" : moreError ? "Try again" : "Load more"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
