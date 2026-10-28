"use client";

import Image from "next/image";
import type { PublishedDesign } from "@/lib/types";
import { safeImageUrl } from "@/lib/url";
import { CloseIcon } from "./icons";

const metres = (n: number) => `${Math.round(n * 10) / 10}`;
const focusRing =
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent";

/** compact card for a published design pin on the /find map */
export default function DesignPinCard({
  design,
  onClose,
  onOpen3D,
}: {
  design: PublishedDesign;
  onClose: () => void;
  onOpen3D: () => void;
}) {
  // the author controls this URL: only allowlisted public Storage images
  const snapshot = safeImageUrl(design.snapshot);
  return (
    <section
      aria-label={`${design.name} — published design`}
      className="no-scrollbar pointer-events-auto flex w-[300px] max-h-full flex-col gap-3 overflow-y-auto rounded-md border border-line bg-paper/95 p-4 text-ink shadow-[0_18px_35px_-24px_rgb(41_55_44/0.45)] backdrop-blur"
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-soft">
            <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-accent" />
            3D design
          </span>
          <h3 className="mt-1 truncate font-display text-[20px] font-normal leading-tight tracking-[-0.02em] text-ink">
            {design.name}
          </h3>
          <p className="mt-0.5 text-[14px] text-ink-soft">
            by {design.authorName}
            {design.place ? ` · ${design.place}` : ""}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close design card"
          className={`${focusRing} grid size-8 shrink-0 place-items-center rounded-full text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink`}
        >
          <CloseIcon width={14} height={14} />
        </button>
      </header>

      <div className="relative grid h-[140px] place-items-center overflow-hidden rounded-[5px] border border-line bg-paper-soft">
        {snapshot ? (
          <Image
            src={snapshot}
            alt={`${design.name} snapshot`}
            fill
            sizes="268px"
            className="object-cover"
          />
        ) : (
          <span className="font-display text-[20px] text-ink-soft">3D</span>
        )}
      </div>

      <div className="rounded-[5px] border border-line bg-paper-soft px-3 py-2">
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-soft">
          Plot
        </div>
        <div className="text-[14px] font-semibold tabular-nums text-ink">
          {metres(design.plotW)} × {metres(design.plotD)} m
        </div>
      </div>

      <button
        onClick={onOpen3D}
        className={`${focusRing} min-h-11 rounded-[5px] bg-accent px-5 py-3 text-[13px] font-semibold text-paper transition-colors hover:bg-accent-deep`}
      >
        Open 3D <span aria-hidden="true">↗</span>
      </button>
    </section>
  );
}
