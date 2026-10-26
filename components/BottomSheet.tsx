"use client";

import { useRef, useState, type ReactNode } from "react";

/**
 * Below the `lg` breakpoint the wrapped panel docks to the bottom of the map
 * as a sheet (styles come from the caller's `className`). The grab handle
 * dismisses on a downward drag past 80px or on tap; on desktop it is hidden
 * and this is a plain wrapper.
 */
export default function BottomSheet({
  className,
  onDismiss,
  children,
}: {
  className?: string;
  onDismiss: () => void;
  children: ReactNode;
}) {
  const start = useRef<number | null>(null);
  const moved = useRef(false);
  const [drag, setDrag] = useState(0);

  return (
    <div
      className={className}
      style={drag ? { transform: `translateY(${drag}px)`, transition: "none" } : undefined}
    >
      <button
        type="button"
        aria-label="Close property details"
        className="sheet-handle"
        onPointerDown={(e) => {
          start.current = e.clientY;
          moved.current = false;
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (start.current === null) return;
          const dy = Math.max(0, e.clientY - start.current);
          if (dy > 4) moved.current = true;
          setDrag(dy);
        }}
        onPointerUp={() => {
          // A tap is handled by onClick instead: dismissing here unmounts the
          // sheet before the browser's click fires, and on touch screens that
          // click then lands on the map underneath and selects whatever pin
          // sits there. A drag produces no click, so it dismisses here.
          const dismiss = moved.current && drag > 80;
          start.current = null;
          setDrag(0);
          if (dismiss) onDismiss();
        }}
        onPointerCancel={() => {
          start.current = null;
          setDrag(0);
        }}
        onClick={() => {
          // a short drag that snapped back is not a tap
          if (!moved.current) onDismiss();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onDismiss();
          }
        }}
      />
      {children}
    </div>
  );
}
