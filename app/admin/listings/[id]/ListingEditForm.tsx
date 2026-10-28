"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const KINDS = ["apartments", "house", "land", "room", "business", "hotels"] as const;

export interface EditableListing {
  buildingName: string;
  owner: string;
  address: string;
  city: string;
  price: number;
  type: "sale" | "rent" | "showcase";
  kind: string;
  beds: number;
  baths: number;
  sqft: number;
  rooms: number;
  areaM: number;
  floors: number;
  lng: number;
  lat: number;
  photos: string[];
}

type NumberField = "price" | "beds" | "baths" | "sqft" | "rooms" | "areaM" | "floors" | "lng" | "lat";

/** [field, label, whole number ≥ 0?] — checked before saving. */
const NUMBER_FIELDS: ReadonlyArray<readonly [NumberField, string, boolean]> = [
  ["price", "Price", false],
  ["beds", "Beds", true],
  ["baths", "Baths", true],
  ["sqft", "Sqft", true],
  ["rooms", "Rooms", true],
  ["areaM", "Area m²", true],
  ["floors", "Floors", true],
  ["lng", "Longitude", false],
  ["lat", "Latitude", false],
];

const FOCUS = "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent";
const input = `w-full rounded-[5px] border border-line-strong bg-paper px-3 py-2.5 text-[14px] font-normal normal-case tracking-normal text-ink tabular-nums ${FOCUS}`;
const label = "flex flex-col gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-soft";

/**
 * Admin edit of a listing's details. Sends the full listing to
 * PATCH /api/admin/listings/[id] (same validation as the lister's own edit);
 * status, lister and the paid featured flag are not editable here.
 */
export default function ListingEditForm({ id, initial }: { id: string; initial: EditableListing }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const set = <K extends keyof EditableListing>(k: K, value: EditableListing[K]) =>
    setV((prev) => ({ ...prev, [k]: value }));
  const num = (k: NumberField) => ({
    type: "number" as const,
    step: k === "lng" || k === "lat" ? "any" : "1",
    value: Number.isFinite(v[k]) ? v[k] : "",
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(k, e.target.valueAsNumber),
    className: input,
  });

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    // An emptied number input is NaN, which JSON.stringify sends as null; the
    // API then silently resets the field to its default (area 50 m², 1 floor…).
    // Catch it here with a message instead.
    const bad = NUMBER_FIELDS.find(([k, , int]) => {
      const n = v[k];
      return !Number.isFinite(n) || (int && (!Number.isInteger(n) || n < 0));
    });
    if (bad) {
      setMessage({
        ok: false,
        text: bad[2] ? `${bad[1]} must be a whole number, 0 or more` : `${bad[1]} must be a number`,
      });
      return;
    }
    if (v.price < 0) {
      setMessage({ ok: false, text: "Price can't be negative" });
      return;
    }
    if (!v.address.trim()) {
      setMessage({ ok: false, text: "Address is required" });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/listings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buildingName: v.buildingName.trim() || undefined,
          owner: v.owner.trim() || undefined,
          address: v.address,
          city: v.city,
          price: v.price,
          type: v.type,
          kind: v.kind,
          beds: v.beds,
          baths: v.baths,
          sqft: v.sqft,
          rooms: v.rooms,
          areaM: v.areaM,
          floors: v.floors,
          coords: [v.lng, v.lat],
          photos: v.photos,
        }),
      });
      if (!res.ok) {
        const msg = await res.json().then((j: { error?: string }) => j.error).catch(() => null);
        setMessage({ ok: false, text: msg || `Failed (${res.status})` });
        return;
      }
      setMessage({ ok: true, text: "Saved" });
      router.refresh();
    } catch {
      setMessage({ ok: false, text: "Network error — try again" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} className="grid gap-4 rounded-md border border-line bg-paper-soft p-4 sm:grid-cols-2 sm:p-6">
      <label className={label}>
        Building name
        <input className={input} value={v.buildingName} onChange={(e) => set("buildingName", e.target.value)} />
      </label>
      <label className={label}>
        Owner contact (private)
        <input className={input} value={v.owner} onChange={(e) => set("owner", e.target.value)} />
      </label>
      <label className={`${label} sm:col-span-2`}>
        Address
        <input className={input} required value={v.address} onChange={(e) => set("address", e.target.value)} />
      </label>
      <label className={label}>
        City
        <input className={input} value={v.city} onChange={(e) => set("city", e.target.value)} />
      </label>
      <label className={label}>
        Price (₹)
        <input {...num("price")} min={0} required />
      </label>
      <label className={label}>
        Type
        <select
          className={input}
          value={v.type}
          onChange={(e) => set("type", e.target.value as EditableListing["type"])}
        >
          <option value="sale">Sale</option>
          <option value="rent">Rent</option>
          {/* not on the market: saved with price 0 (lib/validators.ts) */}
          <option value="showcase">Showcase only</option>
        </select>
      </label>
      <label className={label}>
        Kind
        <select className={input} value={v.kind} onChange={(e) => set("kind", e.target.value)}>
          {KINDS.map((k) => (
            <option key={k} value={k}>{k}</option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-3 gap-4 sm:col-span-2 sm:grid-cols-6">
        <label className={label}>Beds<input {...num("beds")} min={0} /></label>
        <label className={label}>Baths<input {...num("baths")} min={0} /></label>
        <label className={label}>Sqft<input {...num("sqft")} min={0} /></label>
        <label className={label}>Rooms<input {...num("rooms")} min={0} /></label>
        <label className={label}>Area m²<input {...num("areaM")} min={0} /></label>
        <label className={label}>Floors<input {...num("floors")} min={0} /></label>
      </div>
      <label className={label}>Longitude<input {...num("lng")} required /></label>
      <label className={label}>Latitude<input {...num("lat")} required /></label>
      {initial.photos.length > 0 && (
        <fieldset className="sm:col-span-2">
          <legend className={label}>Photos (untick to remove)</legend>
          <div className="mt-3 flex flex-wrap gap-3">
            {initial.photos.map((p, i) => (
              // The visible "Keep photo N" text is the checkbox's accessible
              // name: the preview's alt is empty, so on its own the label gave
              // screen readers an unnamed checkbox.
              <label
                key={p}
                className="group flex cursor-pointer flex-col gap-2 rounded-md border border-line bg-paper p-2 text-[13px] font-semibold text-ink has-[input:not(:checked)]:border-dashed has-[input:not(:checked)]:border-line-strong"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of an already-allowlisted URL */}
                <img src={p} alt="" className="h-20 w-28 rounded-[3px] object-cover transition-opacity group-has-[input:not(:checked)]:opacity-40" />
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className={`size-4 accent-accent ${FOCUS}`}
                    checked={v.photos.includes(p)}
                    onChange={(e) =>
                      set("photos", e.target.checked ? initial.photos.filter((x) => x === p || v.photos.includes(x)) : v.photos.filter((x) => x !== p))
                    }
                  />
                  Keep photo {i + 1}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4 sm:col-span-2">
        <button
          type="submit"
          disabled={saving}
          className={`inline-flex min-h-11 items-center rounded-[5px] bg-accent px-5 py-3 text-[13px] font-semibold text-paper transition-colors hover:bg-accent-deep disabled:opacity-50 ${FOCUS}`}
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        {message && (
          <span role="status" className={`text-[14px] font-semibold ${message.ok ? "text-ink" : "text-accent"}`}>
            {message.text}
          </span>
        )}
      </div>
    </form>
  );
}
