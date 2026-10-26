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
  const btn =
    "grid h-9 w-9 place-items-center text-plum transition-colors hover:bg-plum/5";
  return (
    <div className="flex flex-col items-end gap-2">
      {/* a compact row above the zoom stack, so the column stays short enough
          to clear the result bar on a 800px-tall screen */}
      {layer && onLayerChange && (
        <div
          role="radiogroup"
          aria-label="Map layers"
          className="glass flex items-stretch gap-0.5 overflow-hidden rounded-full p-1"
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
                className={`min-h-7 rounded-full px-2.5 text-[11px] font-bold transition-colors ${
                  on ? "bg-plum text-cream" : "text-plum hover:bg-plum/5"
                }`}
              >
                {l.label}
              </button>
            );
          })}
        </div>
      )}
      <div className="glass flex flex-col items-stretch divide-y divide-plum/8 overflow-hidden rounded-2xl">
        <button className={btn} onClick={onZoomIn} aria-label="Zoom in">
          <PlusIcon width={16} height={16} />
        </button>
        <button className={btn} onClick={onZoomOut} aria-label="Zoom out">
          <MinusIcon width={16} height={16} />
        </button>
        <button
          className={`${btn} text-[12px] font-bold`}
          onClick={onToggleDimension}
          aria-label="Toggle 2D / 3D view"
        >
          {is3D ? "2D" : "3D"}
        </button>
      </div>
    </div>
  );
}
