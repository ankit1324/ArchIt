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
  type: "sale" | "rent";
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

const input = "w-full rounded-xl border border-plum/15 bg-white px-3 py-2 text-[14px]";
const label = "flex flex-col gap-1 text-[12px] font-bold uppercase tracking-wide text-plum-soft";

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
    <form onSubmit={save} className="grid gap-3 rounded-2xl bg-white/70 p-4 sm:grid-cols-2">
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
        <select className={input} value={v.type} onChange={(e) => set("type", e.target.value as "sale" | "rent")}>
          <option value="sale">Sale</option>
          <option value="rent">Rent</option>
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
      <div className="grid grid-cols-3 gap-3 sm:col-span-2 sm:grid-cols-6">
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
          <div className="mt-2 flex flex-wrap gap-3">
            {initial.photos.map((p) => (
              <label key={p} className="flex flex-col items-center gap-1 text-[12px]">
                {/* eslint-disable-next-line @next/next/no-img-element -- admin preview of an already-allowlisted URL */}
                <img src={p} alt="" className="h-20 w-28 rounded-lg object-cover" />
                <input
                  type="checkbox"
                  checked={v.photos.includes(p)}
                  onChange={(e) =>
                    set("photos", e.target.checked ? initial.photos.filter((x) => x === p || v.photos.includes(x)) : v.photos.filter((x) => x !== p))
                  }
                />
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div className="flex items-center gap-3 sm:col-span-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-plum px-5 py-2 text-[13px] font-bold text-cream disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        {message && (
          <span role="status" className={`text-[13px] font-semibold ${message.ok ? "text-emerald-800" : "text-coral"}`}>
            {message.text}
          </span>
        )}
      </div>
    </form>
  );
}
