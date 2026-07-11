"use client";

import type { ComponentType, ComponentProps } from "react";
import type { Filters, Listing, PropertyKind } from "@/lib/types";
import PriceHistogram from "./PriceHistogram";
import {
  ApartmentsIcon,
  BusinessIcon,
  HotelsIcon,
  HouseIcon,
  LandIcon,
  RoomIcon,
} from "./icons";

const KINDS: { id: PropertyKind; label: string; Icon: ComponentType<ComponentProps<"svg">> }[] = [
  { id: "apartments", label: "Apartments", Icon: ApartmentsIcon },
  { id: "house", label: "House", Icon: HouseIcon },
  { id: "land", label: "Land", Icon: LandIcon },
  { id: "room", label: "Room", Icon: RoomIcon },
  { id: "business", label: "Business", Icon: BusinessIcon },
  { id: "hotels", label: "Hotels", Icon: HotelsIcon },
];

const ROOMS = [1, 2, 3, 4, 5];
const AREA_CHIPS = [25, 45, 65];
const FLOOR_CHIPS: { id: NonNullable<Filters["floorArea"]>; label: string }[] = [
  { id: "less5", label: "less 5" },
  { id: "6-10", label: "6-10" },
  { id: "more10", label: "more 10" },
];

interface FilterSidebarProps {
  filters: Filters;
  onChange: (f: Filters) => void;
  allListings: Listing[];
}

function Panel({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="glass rounded-3xl p-3.5">
      {title && (
        <h3 className="mb-3 text-center text-[13px] font-bold text-plum">
          {title}
        </h3>
      )}
      {children}
    </section>
  );
}

const chip = (active: boolean) =>
  `rounded-full px-4 py-2 text-[12.5px] font-semibold transition-colors ${
    active
      ? "bg-plum text-cream"
      : "bg-white/55 text-plum hover:bg-white/85"
  }`;

export default function FilterSidebar({
  filters,
  onChange,
  allListings,
}: FilterSidebarProps) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  return (
    <aside className="no-scrollbar pointer-events-auto flex h-full w-[240px] flex-col gap-3 overflow-y-auto">
      {/* property type */}
      <div className="grid grid-cols-3 gap-2">
        {KINDS.map(({ id, label, Icon }) => {
          const active = filters.kind === id;
          return (
            <button
              key={id}
              onClick={() => set({ kind: active ? null : id })}
              className={`glass flex aspect-square flex-col items-center justify-center gap-1.5 rounded-2xl transition-all ${
                active
                  ? "bg-plum/90! text-cream shadow-lg"
                  : "text-plum hover:bg-white/70"
              }`}
            >
              <Icon width={21} height={21} />
              <span className="text-[10px] font-semibold">{label}</span>
            </button>
          );
        })}
      </div>

      <Panel title="Price range">
        <PriceHistogram
          listings={allListings}
          value={filters.price}
          onChange={(price) => set({ price })}
        />
      </Panel>

      <Panel title="Property rooms">
        <div className="flex justify-between gap-1.5">
          {ROOMS.map((r) => {
            const active = filters.rooms === r;
            return (
              <button
                key={r}
                onClick={() => set({ rooms: active ? null : r })}
                className={`h-9 w-9 rounded-xl text-[13px] font-bold transition-colors ${
                  active
                    ? "bg-plum text-cream"
                    : "bg-white/55 text-plum hover:bg-white/85"
                }`}
              >
                {r === 5 ? "5+" : r}
              </button>
            );
          })}
        </div>
      </Panel>

      <Panel title="Area">
        <div className="mb-2.5 grid grid-cols-2 gap-2">
          <label className="flex items-baseline gap-1.5 rounded-full bg-white/55 px-3.5 py-2 text-[12.5px]">
            <span className="font-medium text-plum-soft">From:</span>
            <input
              type="number"
              value={filters.areaFrom}
              onChange={(e) => set({ areaFrom: Number(e.target.value) || 0 })}
              className="w-full min-w-0 bg-transparent font-bold text-plum outline-none"
              aria-label="Area from"
            />
          </label>
          <label className="flex items-baseline gap-1.5 rounded-full bg-white/55 px-3.5 py-2 text-[12.5px]">
            <span className="font-medium text-plum-soft">To:</span>
            <input
              type="number"
              value={filters.areaTo}
              onChange={(e) => set({ areaTo: Number(e.target.value) || 0 })}
              className="w-full min-w-0 bg-transparent font-bold text-plum outline-none"
              aria-label="Area to"
            />
          </label>
        </div>
        <div className="flex justify-between gap-1.5">
          {AREA_CHIPS.map((a) => {
            const active = filters.areaFrom === a - 15 && filters.areaTo === a + 15;
            return (
              <button
                key={a}
                onClick={() => set({ areaFrom: a - 15, areaTo: a + 15 })}
                className={chip(active)}
              >
                {a}m
              </button>
            );
          })}
        </div>
      </Panel>

      <Panel title="House floor area">
        <div className="flex justify-between gap-1.5">
          {FLOOR_CHIPS.map(({ id, label }) => {
            const active = filters.floorArea === id;
            return (
              <button
                key={id}
                onClick={() => set({ floorArea: active ? null : id })}
                className={chip(active)}
              >
                {label}
              </button>
            );
          })}
        </div>
      </Panel>
    </aside>
  );
}
