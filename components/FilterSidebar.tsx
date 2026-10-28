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
  // a hairline-separated section, not a card: the sidebar is already the
  // floating surface, and no backdrop-filter (a per-frame compositing pass
  // for no visible gain on a 96%-opaque panel)
  return (
    <section className="border-t border-line pt-3.5">
      {title && (
        <h3 className="mb-3 text-[11px] font-bold tracking-[0.14em] text-ink-soft uppercase">
          {title}
        </h3>
      )}
      {children}
    </section>
  );
}

const FOCUS =
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent";

const chip = (active: boolean) =>
  `min-h-9 rounded-full border px-3.5 text-[13px] font-semibold tabular-nums transition-colors ${FOCUS} ${
    active
      ? "border-ink bg-ink text-paper"
      : "border-line-strong bg-paper text-ink hover:border-ink"
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
    <aside className="no-scrollbar pointer-events-auto flex min-h-0 w-full flex-1 flex-col gap-3.5 overflow-y-auto px-0.5 pb-0.5 text-ink">
      <div className="flex items-center justify-between text-[13px] font-semibold"><span className="tabular-nums">{activeCount ? `${activeCount} active filters` : "All properties"}</span><button type="button" onClick={onReset} className={`inline-flex min-h-6 items-center rounded-[3px] px-1 underline decoration-line-strong underline-offset-4 transition-colors hover:text-accent hover:decoration-current ${FOCUS}`}>Reset all</button></div>
      <div className="grid grid-cols-4 gap-0.5 rounded-full border border-line bg-paper-soft p-0.5" aria-label="Listing type">
        {([null, "sale", "rent", "showcase"] as const).map((type) => <button type="button" key={type ?? "all"} aria-pressed={filters.type === type} onClick={() => set({ type })} className={`min-h-8 rounded-full text-[11px] font-bold transition-colors ${FOCUS} ${filters.type === type ? "bg-ink text-paper" : "text-ink hover:bg-paper"}`}>{TYPE_LABELS[type ?? "all"]}</button>)}
      </div>
      {/* property type */}
      <div className="grid grid-cols-3 gap-1.5">
        {KINDS.map(({ id, label, Icon }) => {
          const active = filters.kind === id;
          return (
            <button
              type="button"
              key={id}
              aria-pressed={active}
              onClick={() => set({ kind: active ? null : id })}
              className={`flex aspect-square flex-col items-center justify-center gap-1.5 rounded-[5px] border transition-colors ${FOCUS} ${
                active
                  ? "border-ink bg-ink text-paper"
                  : "border-line bg-paper text-ink hover:border-ink"
              }`}
            >
              <Icon width={21} height={21} aria-hidden="true" />
              <span className="text-[12px] font-semibold">{label}</span>
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
                type="button"
                key={r}
                aria-pressed={active}
                onClick={() => set({ rooms: active ? null : r })}
                className={`h-9 w-9 rounded-[5px] border text-[13px] font-semibold tabular-nums transition-colors ${FOCUS} ${
                  active
                    ? "border-ink bg-ink text-paper"
                    : "border-line-strong bg-paper text-ink hover:border-ink"
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
          <label className="flex min-h-10 items-baseline gap-1.5 rounded-[5px] border border-line-strong bg-paper px-3 py-2 text-[13px] transition-colors focus-within:border-ink has-[input:focus-visible]:outline-3 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-accent">
            <span className="font-medium text-ink-soft">From:</span>
            <input
              type="number"
              min={0}
              value={filters.areaFrom || ""}
              placeholder="Any"
              onChange={(e) => set({ areaFrom: Math.max(0, Number(e.target.value) || 0) })}
              className="w-full min-w-0 bg-transparent font-semibold text-ink tabular-nums outline-none placeholder:font-medium placeholder:text-ink-soft focus-visible:outline-none"
              aria-label="Area from"
            />
          </label>
          <label className="flex min-h-10 items-baseline gap-1.5 rounded-[5px] border border-line-strong bg-paper px-3 py-2 text-[13px] transition-colors focus-within:border-ink has-[input:focus-visible]:outline-3 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-accent">
            <span className="font-medium text-ink-soft">To:</span>
            <input
              type="number"
              min={filters.areaFrom}
              value={Number.isFinite(filters.areaTo) ? filters.areaTo : ""}
              placeholder="Any"
              onChange={(e) => set({ areaTo: e.target.value === "" ? Infinity : Math.max(0, Number(e.target.value)) })}
              className="w-full min-w-0 bg-transparent font-semibold text-ink tabular-nums outline-none placeholder:font-medium placeholder:text-ink-soft focus-visible:outline-none"
              aria-label="Area to"
            />
          </label>
        </div>
        {filters.areaFrom > filters.areaTo && <p role="alert" className="mb-2 text-[14px] text-accent">Maximum area must be at least the minimum.</p>}
        <div className="flex justify-between gap-1.5">
          {AREA_CHIPS.map((a) => {
            const active = filters.areaFrom === a - 15 && filters.areaTo === a + 15;
            return (
              <button
                type="button"
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
                type="button"
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
