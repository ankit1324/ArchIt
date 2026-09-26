"use client";

import { useMemo } from "react";
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

  const [lo, hi] = value;
  const loPos = priceToPos(lo, domain);
  const hiPos = priceToPos(hi, domain);

  const setLo = (pos: number) =>
    onChange([Math.min(pos === 0 ? 0 : posToPrice(pos, domain), hi), hi]);
  const setHi = (pos: number) =>
    onChange([lo, Math.max(pos === 100 ? Infinity : posToPrice(pos, domain), lo)]);

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
        {lo === 0 && !Number.isFinite(hi) ? "Any price" : `${compact(lo)} – ${Number.isFinite(hi) ? compact(hi) : "No limit"}`}
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
          aria-valuetext={lo === 0 ? "No minimum" : compact(lo)}
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
          aria-valuetext={Number.isFinite(hi) ? compact(hi) : "No maximum"}
        />
      </div>
    </div>
  );
}
