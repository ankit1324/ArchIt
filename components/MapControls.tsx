"use client";

import type { MapLayer } from "@/lib/find";
import { MinusIcon, PlusIcon } from "./icons";

interface MapControlsProps {
  is3D: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggleDimension: () => void;
  /** which pins show: property listings, published designs, or both */
  layer?: MapLayer;
  onLayerChange?: (layer: MapLayer) => void;
}

const LAYERS: ReadonlyArray<{ value: MapLayer; label: string; title: string }> = [
  { value: "listings", label: "Listings", title: "Show property listings only" },
  { value: "designs", label: "Designs", title: "Show published 3D designs only" },
  { value: "both", label: "Both", title: "Show listings and designs" },
];

export default function MapControls({
  is3D,
  onZoomIn,
  onZoomOut,
  onToggleDimension,
  layer,
  onLayerChange,
}: MapControlsProps) {
  // floating map controls: paper pills with a hairline, the one shadow the
  // planner language allows (they sit over imagery)
  const btn =
    "grid h-10 w-10 place-items-center text-ink transition-colors hover:bg-paper-soft focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-accent";
  const surface =
    "border border-line bg-paper/95 shadow-[0_18px_35px_-24px_rgb(41_55_44/0.45)]";
  return (
    <div className="flex flex-col items-end gap-2">
      {/* a compact row above the zoom stack, so the column stays short enough
          to clear the result bar on a 800px-tall screen */}
      {layer && onLayerChange && (
        <div
          role="radiogroup"
          aria-label="Map layers"
          className={`${surface} flex items-stretch gap-0.5 rounded-full p-1`}
        >
          {LAYERS.map((l) => {
            const on = layer === l.value;
            return (
              <button
                key={l.value}
                type="button"
                role="radio"
                aria-checked={on}
                title={l.title}
                onClick={() => onLayerChange(l.value)}
                className={`min-h-8 rounded-full px-3 text-[12px] font-semibold transition-colors focus-visible:outline-3 focus-visible:outline-offset-1 focus-visible:outline-accent ${
                  on ? "bg-ink text-paper" : "text-ink hover:bg-paper-soft"
                }`}
              >
                {l.label}
              </button>
            );
          })}
        </div>
      )}
      <div className={`${surface} flex flex-col items-stretch divide-y divide-line overflow-hidden rounded-full`}>
        <button type="button" className={btn} onClick={onZoomIn} aria-label="Zoom in">
          <PlusIcon width={16} height={16} />
        </button>
        <button type="button" className={btn} onClick={onZoomOut} aria-label="Zoom out">
          <MinusIcon width={16} height={16} />
        </button>
        <button
          type="button"
          className={`${btn} text-[12px] font-bold tracking-[0.04em]`}
          onClick={onToggleDimension}
          aria-label="Toggle 2D / 3D view"
        >
          {is3D ? "2D" : "3D"}
        </button>
      </div>
    </div>
  );
}
