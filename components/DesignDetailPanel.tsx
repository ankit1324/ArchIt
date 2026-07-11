"use client";

import Image from "next/image";
import type { Design } from "@/lib/types";
import { CloseIcon } from "./icons";

interface DesignDetailPanelProps {
  design: Design;
  onClose: () => void;
  onReopen: () => void;
  onDelete: () => void;
  deleting?: boolean;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/55 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-plum-soft">
        {label}
      </div>
      <div className="truncate text-[13px] font-bold text-plum">{value}</div>
    </div>
  );
}

export default function DesignDetailPanel({
  design,
  onClose,
  onReopen,
  onDelete,
  deleting = false,
}: DesignDetailPanelProps) {
  // state.blocks is an alias of floors[floor].blocks after JSON round-trip —
  // always derive from floors when present
  const floors = design.design.state.floors ?? [
    { blocks: design.design.state.blocks },
  ];
  const roomCount = floors.reduce((n, f) => n + f.blocks.length, 0);
  const builtUp = floors.reduce(
    (a, f) => a + f.blocks.reduce((s, b) => s + b.w * b.len, 0),
    0,
  );

  return (
    <section className="glass no-scrollbar pointer-events-auto flex w-[300px] max-h-full flex-col gap-2.5 overflow-y-auto rounded-3xl p-4">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-[15px] font-bold leading-snug text-plum">
            {design.name}
          </h3>
          <p className="text-[12px] font-medium text-plum-soft">
            {design.plotCenter[1].toFixed(4)}, {design.plotCenter[0].toFixed(4)}
          </p>
        </div>
        <button
          onClick={onClose}
          aria-label="Close design details"
          className="shrink-0 rounded-full p-1 text-plum-soft transition-colors hover:bg-plum/5 hover:text-plum"
        >
          <CloseIcon width={14} height={14} />
        </button>
      </header>

      {design.snapshot && (
        <div className="relative h-[160px] overflow-hidden rounded-2xl bg-white/40">
          <Image
            src={design.snapshot}
            alt={design.name}
            fill
            sizes="268px"
            className="object-cover"
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-1.5">
        <Fact label="Floors" value={String(floors.length)} />
        <Fact label="Rooms" value={String(roomCount)} />
        <Fact label="Built-up" value={`${Math.round(builtUp)} m²`} />
        <Fact
          label="Plot"
          value={`${Math.round(design.plotW)} × ${Math.round(design.plotD)} m`}
        />
      </div>

      <div className="mt-1 flex gap-2">
        <button
          onClick={onReopen}
          className="flex-1 rounded-full bg-plum py-2.5 text-[13px] font-bold text-cream transition-opacity hover:opacity-90"
        >
          Reopen in builder
        </button>
        <button
          onClick={onDelete}
          disabled={deleting}
          className="rounded-full bg-coral px-4 py-2.5 text-[13px] font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {deleting ? "…" : "Delete"}
        </button>
      </div>
    </section>
  );
}
