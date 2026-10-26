"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { round1 } from "@/lib/showcase";
import type { PublishedDesign } from "@/lib/types";
import { safeImageUrl } from "@/lib/url";

export const SHOWCASE_PAGE_SIZE = 24;

function publishedOn(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function DesignCard({ d, priority }: { d: PublishedDesign; priority: boolean }) {
  // the author controls this URL: anything off the allowlist gets the placeholder
  const src = safeImageUrl(d.snapshot);
  const date = publishedOn(d.publishedAt);
  return (
    <li>
      <Link
        href={`/showcase/${encodeURIComponent(d.id)}`}
        className="group flex h-full flex-col overflow-hidden rounded-3xl bg-white/70 shadow-sm transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-plum"
      >
        <span className="relative block aspect-[4/3] w-full overflow-hidden bg-cream-soft">
          {src ? (
            <Image
              src={src}
              alt=""
              fill
              priority={priority}
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
          <span className="truncate text-[12.5px] font-semibold text-plum-soft">by {d.authorName}</span>
          {d.place && (
            <span className="truncate text-[12.5px] font-medium text-plum-soft">{d.place}</span>
          )}
          <span className="mt-1 flex items-center justify-between gap-2 text-[12px] font-medium text-plum-soft">
            <span>
              Plot {round1(d.plotW)} × {round1(d.plotD)} m
            </span>
            {date && <span>{date}</span>}
          </span>
        </span>
      </Link>
    </li>
  );
}

/**
 * The /showcase card grid. The first page is server-rendered (props); "Load
 * more" pages through GET /api/showcase with the last card's publishedAt.
 */
export default function ShowcaseGallery({
  initial,
  initialHasMore,
}: {
  initial: PublishedDesign[];
  initialHasMore: boolean;
}) {
  const [designs, setDesigns] = useState(initial);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  async function loadMore() {
    const last = designs[designs.length - 1];
    if (!last || loading) return;
    setLoading(true);
    setFailed(false);
    try {
      const r = await fetch(
        `/api/showcase?limit=${SHOWCASE_PAGE_SIZE}&before=${encodeURIComponent(last.publishedAt)}`,
      );
      if (!r.ok) throw new Error(`showcase ${r.status}`);
      const page = (await r.json()) as PublishedDesign[];
      // a design re-published between pages could repeat; keep ids unique
      setDesigns((prev) => {
        const seen = new Set(prev.map((d) => d.id));
        return [...prev, ...page.filter((d) => !seen.has(d.id))];
      });
      setHasMore(page.length === SHOWCASE_PAGE_SIZE);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {designs.map((d, i) => (
          <DesignCard key={d.id} d={d} priority={i < 3} />
        ))}
      </ul>
      {(hasMore || failed) && (
        <div className="mt-8 flex flex-col items-center gap-2">
          {failed && (
            <p className="text-[13px] font-semibold text-coral" role="alert">
              Couldn&apos;t load more designs.
            </p>
          )}
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className="min-h-11 rounded-full border border-plum/20 px-5 py-2 text-[13px] font-bold text-plum transition-colors hover:bg-plum/5 disabled:opacity-50"
          >
            {loading ? "Loading…" : failed ? "Try again" : "Load more"}
          </button>
        </div>
      )}
    </>
  );
}
