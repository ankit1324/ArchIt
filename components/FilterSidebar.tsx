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

const TYPE_LABELS = { all: "All", sale: "Buy", rent: "Rent", showcase: "Showcase" } as const;

const ROOMS = [1, 2, 3, 4, 5];
const AREA_CHIPS = [25, 45, 65];
const FLOOR_CHIPS: { id: NonNullable<Filters["floorArea"]>; label: string }[] = [
  { id: "less5", label: "1–5" },
  { id: "6-10", label: "6-10" },
  { id: "more10", label: "11+" },
];

interface FilterSidebarProps {
  filters: Filters;
  onChange: (f: Filters) => void;
  allListings: Listing[];
  onReset: () => void;
  activeCount: number;
}

function Panel({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  // no backdrop-filter here: the sidebar is already a 94%-opaque surface, so
  // a blur would cost a per-frame compositing pass for no visible gain
  return (
    <section className="rounded-3xl bg-white/55 p-3.5 shadow-[0_8px_28px_rgb(61_24_48/0.1)]">
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
  onReset,
  activeCount,
}: FilterSidebarProps) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  return (
    <aside className="no-scrollbar pointer-events-auto flex min-h-0 w-full flex-1 flex-col gap-3 overflow-y-auto">
      <div className="flex items-center justify-between text-xs font-semibold"><span>{activeCount ? `${activeCount} active filters` : "All properties"}</span><button onClick={onReset} className="rounded-lg px-2 py-2 underline underline-offset-4">Reset all</button></div>
      <div className="grid grid-cols-4 gap-1 rounded-full bg-plum/5 p-1" aria-label="Listing type">
        {([null, "sale", "rent", "showcase"] as const).map((type) => <button key={type ?? "all"} aria-pressed={filters.type === type} onClick={() => set({ type })} className={`${chip(filters.type === type)} px-0! text-[11px]!`}>{TYPE_LABELS[type ?? "all"]}</button>)}
      </div>
      {/* property type */}
      <div className="grid grid-cols-3 gap-2">
        {KINDS.map(({ id, label, Icon }) => {
          const active = filters.kind === id;
          return (
            <button
              key={id}
              aria-pressed={active}
              onClick={() => set({ kind: active ? null : id })}
              className={`flex aspect-square flex-col items-center justify-center gap-1.5 rounded-2xl transition-colors ${
                active
                  ? "bg-plum/90 text-cream shadow-lg"
                  : "bg-white/55 text-plum shadow-[0_8px_28px_rgb(61_24_48/0.1)] hover:bg-white/70"
              }`}
            >
              <Icon width={21} height={21} />
              <span className="text-[10px] font-semibold">{label}</span>
            </button>
          );
        })}
      </div>

      {/* showcase listings have no price, so the range never applies to them */}
      {filters.type !== "showcase" && (
        <Panel title={filters.type === "rent" ? "Monthly rent (₹)" : "Price range (₹)"}>
          <PriceHistogram
            listings={allListings.filter((l) => l.type !== "showcase")}
            value={filters.price}
            onChange={(price) => set({ price })}
          />
        </Panel>
      )}

      <Panel title="Property rooms">
        <div className="flex justify-between gap-1.5">
          {ROOMS.map((r) => {
            const active = filters.rooms === r;
            return (
              <button
                key={r}
                aria-pressed={active}
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

      <Panel title="Property area (m²)">
        <div className="mb-2.5 grid grid-cols-2 gap-2">
          <label className="flex items-baseline gap-1.5 rounded-full bg-white/55 px-3.5 py-2 text-[12.5px]">
            <span className="font-medium text-plum-soft">From:</span>
            <input
              type="number"
              min={0}
              value={filters.areaFrom || ""}
              placeholder="Any"
              onChange={(e) => set({ areaFrom: Math.max(0, Number(e.target.value) || 0) })}
              className="w-full min-w-0 bg-transparent font-bold text-plum outline-none"
              aria-label="Area from"
            />
          </label>
          <label className="flex items-baseline gap-1.5 rounded-full bg-white/55 px-3.5 py-2 text-[12.5px]">
            <span className="font-medium text-plum-soft">To:</span>
            <input
              type="number"
              min={filters.areaFrom}
              value={Number.isFinite(filters.areaTo) ? filters.areaTo : ""}
              placeholder="Any"
              onChange={(e) => set({ areaTo: e.target.value === "" ? Infinity : Math.max(0, Number(e.target.value)) })}
              className="w-full min-w-0 bg-transparent font-bold text-plum outline-none"
              aria-label="Area to"
            />
          </label>
        </div>
        {filters.areaFrom > filters.areaTo && <p role="alert" className="mb-2 text-xs text-coral">Maximum area must be at least the minimum.</p>}
        <div className="flex justify-between gap-1.5">
          {AREA_CHIPS.map((a) => {
            const active = filters.areaFrom === a - 15 && filters.areaTo === a + 15;
            return (
              <button
                key={a}
                aria-pressed={active}
                // a pressed chip toggles off, like the room and floor chips
                onClick={() =>
                  set(active ? { areaFrom: 0, areaTo: Infinity } : { areaFrom: a - 15, areaTo: a + 15 })
                }
                className={chip(active)}
              >
                {a} m²
              </button>
            );
          })}
        </div>
      </Panel>

      <Panel title="Building floors">
        <div className="flex justify-between gap-1.5">
          {FLOOR_CHIPS.map(({ id, label }) => {
            const active = filters.floorArea === id;
            return (
              <button
                key={id}
                aria-pressed={active}
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
