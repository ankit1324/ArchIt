"use client";

import { MinusIcon, PlusIcon } from "./icons";

interface MapControlsProps {
  is3D: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggleDimension: () => void;
}

export default function MapControls({
  is3D,
  onZoomIn,
  onZoomOut,
  onToggleDimension,
}: MapControlsProps) {
  const btn =
    "grid h-9 w-9 place-items-center text-plum transition-colors hover:bg-plum/5";
  return (
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
  );
}
