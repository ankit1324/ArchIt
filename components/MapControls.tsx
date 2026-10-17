"use client";

import type { MapLayer } from "@/lib/find";
import { MinusIcon, PlusIcon } from "./icons";

const LAYERS: { id: MapLayer; label: string }[] = [
  { id: "listings", label: "Listings" },
  { id: "designs", label: "Designs" },
  { id: "both", label: "Both" },
];

interface MapControlsProps {
  is3D: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggleDimension: () => void;
  layer: MapLayer;
  onLayerChange: (l: MapLayer) => void;
}

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
      <div
        role="radiogroup"
        aria-label="Map layers"
        className="glass flex flex-col items-stretch gap-0.5 overflow-hidden rounded-2xl p-1"
      >
        {LAYERS.map(({ id, label }) => (
          <button
            key={id}
            role="radio"
            aria-checked={layer === id}
            onClick={() => onLayerChange(id)}
            className={`rounded-xl px-2 py-1.5 text-[10.5px] font-bold transition-colors ${
              layer === id ? "bg-plum text-cream" : "text-plum hover:bg-plum/5"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
