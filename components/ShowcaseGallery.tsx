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

const FOCUS = "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent";
// the landing's starter-card tints, cycled so a full grid doesn't read as one block
const TINTS = ["bg-[#f0f0e7]", "bg-[#eee5d9]", "bg-[#e7ece4]"];

function DesignCard({ d, priority, index }: { d: PublishedDesign; priority: boolean; index: number }) {
  // the author controls this URL: anything off the allowlist gets the placeholder
  const src = safeImageUrl(d.snapshot);
  const date = publishedOn(d.publishedAt);
  return (
    <li>
      <Link
        href={`/showcase/${encodeURIComponent(d.id)}`}
        className={`group flex h-full flex-col overflow-hidden rounded-md border border-line transition-colors hover:border-line-strong ${TINTS[index % TINTS.length]} ${FOCUS}`}
      >
        <span className="relative block aspect-[4/3] w-full overflow-hidden border-b border-line bg-paper-soft">
          {src ? (
            <Image
              src={src}
              alt=""
              fill
              priority={priority}
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
            />
          ) : (
            <span className="flex h-full items-center justify-center text-[11px] font-bold uppercase tracking-[0.14em] text-ink-soft">
              No preview
            </span>
          )}
          {d.mine && (
            <span className="absolute left-3 top-3 rounded-full bg-ink px-2.5 py-0.5 text-[11px] font-bold text-paper">
              Yours
            </span>
          )}
        </span>
        <span className="flex flex-1 flex-col p-5">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] tabular-nums text-ink-soft">
            Plot {round1(d.plotW)} × {round1(d.plotD)} m
          </span>
          <span className="mt-3 truncate font-display text-[24px] font-normal leading-tight tracking-[-0.02em] text-ink">
            {d.name}
          </span>
          <span className="mt-1 truncate text-[14px] text-ink-soft">
            by {d.authorName}
            {d.place ? ` · ${d.place}` : ""}
          </span>
          <span className="mt-auto flex items-center justify-between gap-2 pt-5 text-[13px] font-semibold text-ink">
            <span className="underline-offset-4 group-hover:text-accent-deep group-hover:underline">Walk around it in 3D</span>
            {date && <span className="font-normal tabular-nums text-ink-soft">{date}</span>}
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
      <ul className="grid grid-cols-1 gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
        {designs.map((d, i) => (
          <DesignCard key={d.id} d={d} priority={i < 3} index={i} />
        ))}
      </ul>
      {(hasMore || failed) && (
        <div className="mt-10 flex flex-col items-center gap-3">
          {failed && (
            <p className="text-[14px] font-semibold text-accent" role="alert">
              Couldn&apos;t load more designs.
            </p>
          )}
          <button
            type="button"
            onClick={loadMore}
            disabled={loading}
            className={`inline-flex min-h-11 items-center rounded-[5px] border border-line-strong px-5 py-3 text-[13px] font-semibold text-ink transition-colors hover:border-ink disabled:opacity-50 ${FOCUS}`}
          >
            {loading ? "Loading…" : failed ? "Try again" : "Load more"}
          </button>
        </div>
      )}
    </>
  );
}
