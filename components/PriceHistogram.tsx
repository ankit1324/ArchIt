"use client";

import { useMemo } from "react";
import type { Listing } from "@/lib/types";
import { PRICE_DOMAIN } from "@/lib/listings";

const BUCKETS = 26;
const LOG_MIN = Math.log10(PRICE_DOMAIN[0]);
const LOG_MAX = Math.log10(PRICE_DOMAIN[1]);

/** slider position 0..100 <-> price, on a log scale (prices span $5k rent to $1.5M sale) */
export function posToPrice(pos: number): number {
  return Math.round(10 ** (LOG_MIN + (pos / 100) * (LOG_MAX - LOG_MIN)));
}
export function priceToPos(price: number): number {
  return ((Math.log10(price) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * 100;
}

function compact(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000).toLocaleString()},000`;
  return `$${n}`;
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
  const bars = useMemo(() => {
    const counts = new Array(BUCKETS).fill(0);
    listings.forEach((l) => {
      const i = Math.min(
        BUCKETS - 1,
        Math.max(0, Math.floor((priceToPos(l.price) / 100) * BUCKETS)),
      );
      counts[i] += 1;
    });
    const max = Math.max(1, ...counts);
    // organic skyline: real counts + a soft pseudo-random floor
    return counts.map((c, i) => {
      const noise = 0.22 + 0.28 * Math.abs(Math.sin(i * 2.7 + 1.3));
      return Math.max(noise, c / max);
    });
  }, [listings]);

  const [lo, hi] = value;
  const loPos = priceToPos(lo);
  const hiPos = priceToPos(hi);

  const setLo = (pos: number) =>
    onChange([Math.min(posToPrice(pos), hi), hi]);
  const setHi = (pos: number) =>
    onChange([lo, Math.max(posToPrice(pos), lo)]);

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
                inRange ? "bg-plum" : "bg-plum/20"
              }`}
            />
          );
        })}
      </div>

      <div className="text-center text-[15px] font-bold text-plum">
        {compact(lo)}-{compact(hi).replace("$", "")}
      </div>

      {/* dual-thumb slider */}
      <div className="relative h-[22px]">
        <div className="absolute inset-x-1 top-1/2 h-[22px] -translate-y-1/2 rounded-full bg-white/55" />
        <div
          className="absolute top-1/2 h-[22px] -translate-y-1/2 rounded-full bg-plum"
          style={{ left: `${loPos}%`, right: `${100 - hiPos}%` }}
        />
        <input
          type="range"
          min={0}
          max={100}
          step={0.5}
          value={loPos}
          onChange={(e) => setLo(Number(e.target.value))}
          className="range-input"
          aria-label="Minimum price"
        />
        <input
          type="range"
          min={0}
          max={100}
          step={0.5}
          value={hiPos}
          onChange={(e) => setHi(Number(e.target.value))}
          className="range-input"
          aria-label="Maximum price"
        />
      </div>
    </div>
  );
}
