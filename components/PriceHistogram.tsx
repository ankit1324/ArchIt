"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Listing } from "@/lib/types";
import { PRICE_DOMAIN } from "@/lib/listings";

const BUCKETS = 26;

/** Slider position 0..100 <-> rupee price, on a log scale. */
export function posToPrice(pos: number, domain = PRICE_DOMAIN): number {
  return Math.round(10 ** (Math.log10(domain[0]) + (pos / 100) * (Math.log10(domain[1]) - Math.log10(domain[0]))));
}
export function priceToPos(price: number, domain = PRICE_DOMAIN): number {
  if (price <= 0) return 0;
  return Math.max(0, Math.min(100, ((Math.log10(price) - Math.log10(domain[0])) / (Math.log10(domain[1]) - Math.log10(domain[0]))) * 100));
}

function compact(n: number): string {
  if (!Number.isFinite(n)) return "Any";
  if (n >= 10_000_000) return `₹${Number((n / 10_000_000).toFixed(1))} Cr`;
  if (n >= 100_000) return `₹${Number((n / 100_000).toFixed(1))} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

interface PriceHistogramProps {
  listings: Listing[]; // unfiltered, for the distribution
  value: [number, number];
  onChange: (v: [number, number]) => void;
}

export default function PriceHistogram({
  listings,
  value,
  onChange,
}: PriceHistogramProps) {
  const domain = useMemo<[number, number]>(() => {
    const prices = listings.map((l) => l.price).filter((price) => price > 0);
    return [Math.min(PRICE_DOMAIN[0], ...prices), Math.max(PRICE_DOMAIN[1], ...prices)];
  }, [listings]);
  const bars = useMemo(() => {
    const counts = new Array(BUCKETS).fill(0);
    listings.forEach((l) => {
      const i = Math.min(
        BUCKETS - 1,
        Math.max(0, Math.floor((priceToPos(l.price, domain) / 100) * BUCKETS)),
      );
      counts[i] += 1;
    });
    const max = Math.max(1, ...counts);
    return counts.map((c) => c / max);
  }, [listings, domain]);

  // The thumbs track a local copy while dragging so the histogram, label and
  // range bar repaint instantly; the (expensive) filter commit via onChange
  // happens when the gesture ends. Snap back to the committed value whenever
  // the parent changes it (reset, external edit).
  const [local, setLocal] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  if (prevValue !== value) {
    setPrevValue(value);
    setLocal(value);
  }
  const [lo, hi] = local;
  const loPos = priceToPos(lo, domain);
  const hiPos = priceToPos(hi, domain);

  const setLo = (pos: number) =>
    setLocal(([, h]) => [Math.min(pos === 0 ? 0 : posToPrice(pos, domain), h), h]);
  const setHi = (pos: number) =>
    setLocal(([l]) => [l, Math.max(pos === 100 ? Infinity : posToPrice(pos, domain), l)]);
  const commit = () => {
    if (local[0] !== value[0] || local[1] !== value[1]) onChange(local);
  };
  const commitOnKey = (e: React.KeyboardEvent) => {
    // arrow/home/end nudges fire change per press; commit once the key lifts
    if (e.key !== "Tab") commit();
  };
  // Fallback for a thumb released outside the input (no pointerup on it): a
  // native `change` on a range input fires exactly once, at gesture end.
  // React's onChange maps to `input`, so this is wired by hand.
  const commitRef = useRef(commit);
  useEffect(() => {
    commitRef.current = commit;
  });
  const loInput = useRef<HTMLInputElement>(null);
  const hiInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const onNativeChange = () => commitRef.current();
    const inputs = [loInput.current, hiInput.current];
    inputs.forEach((el) => el?.addEventListener("change", onNativeChange));
    return () => inputs.forEach((el) => el?.removeEventListener("change", onNativeChange));
  }, []);

  return (
    <div className="flex flex-col gap-2.5">
      {/* histogram */}
      <div className="flex h-12 items-end gap-[3px] px-1">
        {bars.map((h, i) => {
          const center = ((i + 0.5) / BUCKETS) * 100;
          const inRange = center >= loPos && center <= hiPos;
          return (
            <div
              key={i}
              style={{ height: `${Math.round(h * 100)}%` }}
              className={`w-full rounded-full transition-colors ${
                inRange ? "bg-ink" : "bg-line"
              }`}
            />
          );
        })}
      </div>

      <div className="text-center font-display text-[17px] font-normal tracking-[-0.01em] text-ink tabular-nums">
        {lo === 0 && !Number.isFinite(hi) ? "Any price" : `${compact(lo)} – ${Number.isFinite(hi) ? compact(hi) : "No limit"}`}
      </div>

      {/* dual-thumb slider */}
      <div className="relative h-[22px] rounded-full has-[input:focus-visible]:outline-3 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-accent">
        <div className="absolute inset-x-1 top-1/2 h-[22px] -translate-y-1/2 rounded-full border border-line bg-paper-soft" />
        <div
          className="absolute top-1/2 h-[22px] -translate-y-1/2 rounded-full bg-ink"
          style={{ left: `${loPos}%`, right: `${100 - hiPos}%` }}
        />
        <input
          ref={loInput}
          type="range"
          min={0}
          max={100}
          step={0.5}
          value={loPos}
          onChange={(e) => setLo(Number(e.target.value))}
          onPointerUp={commit}
          onTouchEnd={commit}
          onKeyUp={commitOnKey}
          onBlur={commit}
          className="range-input focus-visible:outline-none"
          aria-label="Minimum price"
          aria-valuetext={lo === 0 ? "No minimum" : compact(lo)}
        />
        <input
          ref={hiInput}
          type="range"
          min={0}
          max={100}
          step={0.5}
          value={hiPos}
          onChange={(e) => setHi(Number(e.target.value))}
          onPointerUp={commit}
          onTouchEnd={commit}
          onKeyUp={commitOnKey}
          onBlur={commit}
          className="range-input focus-visible:outline-none"
          aria-label="Maximum price"
          aria-valuetext={Number.isFinite(hi) ? compact(hi) : "No maximum"}
        />
      </div>
    </div>
  );
}
