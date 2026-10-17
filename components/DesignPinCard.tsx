"use client";

import Image from "next/image";
import type { PublishedDesign } from "@/lib/types";
import { safeImageUrl } from "@/lib/url";
import { CloseIcon } from "./icons";

const metres = (n: number) => `${Math.round(n * 10) / 10}`;

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
  const snapshot = safeImageUrl(design.snapshot);
  return (
    <section
      aria-label={`${design.name} — published design`}
      className="glass no-scrollbar pointer-events-auto flex w-[300px] max-h-full flex-col gap-2.5 overflow-y-auto rounded-3xl p-4"
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="text-[10px] font-bold uppercase tracking-wide text-violet-600">
            3D design
          </span>
          <h3 className="truncate text-[15px] font-bold leading-snug text-plum">
            {design.name}
          </h3>
          <p className="text-[12px] font-medium text-plum-soft">
            by {design.authorName}
            {design.place ? ` · ${design.place}` : ""}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close design card"
          className="shrink-0 rounded-full p-1 text-plum-soft transition-colors hover:bg-plum/5 hover:text-plum"
        >
          <CloseIcon width={14} height={14} />
        </button>
      </header>

      <div className="relative grid h-[140px] place-items-center overflow-hidden rounded-2xl bg-white/55 ring-2 ring-violet-500">
        {snapshot ? (
          <Image
            src={snapshot}
            alt={`${design.name} snapshot`}
            fill
            sizes="268px"
            className="object-cover"
          />
        ) : (
          <span className="text-[13px] font-bold text-violet-600">3D</span>
        )}
      </div>

      <div className="rounded-2xl bg-white/55 px-3 py-2">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-plum-soft">
          Plot
        </div>
        <div className="text-[13px] font-bold text-plum">
          {metres(design.plotW)} × {metres(design.plotD)} m
        </div>
      </div>

      <button
        onClick={onOpen3D}
        className="rounded-full bg-violet-500 py-2.5 text-[13px] font-bold text-white transition-opacity hover:opacity-90"
      >
        Open 3D
      </button>
    </section>
  );
}
