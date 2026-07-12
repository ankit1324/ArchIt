"use client";

import { useEffect, useState } from "react";
import type { Listing, ListingType, PropertyKind } from "@/lib/types";
import { feeLabel } from "@/lib/fees";
import { CloseIcon } from "./icons";

const KINDS: PropertyKind[] = [
  "apartments",
  "house",
  "land",
  "room",
  "business",
  "hotels",
];

export interface PropertyDraft {
  buildingName: string;
  owner: string;
  address: string;
  city: string;
  price: number;
  type: ListingType;
  kind: PropertyKind;
  beds: number;
  baths: number;
  sqft: number;
  floors: number;
  areaM: number;
}

interface AddPropertyFormProps {
  coords: [number, number];
  /** when set, the form edits this listing instead of creating a new one */
  editing?: Listing | null;
  /** address/city prefilled from reverse geocoding, still editable */
  initialAddress: string;
  initialCity: string;
  geocoding: boolean;
  saving?: boolean;
  /** photoFiles: new uploads; keptPhotos: existing URLs the user kept (edit) */
  onSave: (draft: PropertyDraft, photoFiles: File[], keptPhotos: string[]) => void;
  onCancel: () => void;
}

const field =
  "flex items-baseline gap-1.5 rounded-full bg-white/55 px-3.5 py-2 text-[12.5px]";
const fieldLabel = "shrink-0 font-medium text-plum-soft";
const fieldInput =
  "w-full min-w-0 bg-transparent font-bold text-plum outline-none placeholder:font-medium placeholder:text-plum-soft/50";

export default function AddPropertyForm({
  coords,
  editing = null,
  initialAddress,
  initialCity,
  geocoding,
  saving = false,
  onSave,
  onCancel,
}: AddPropertyFormProps) {
  const [buildingName, setBuildingName] = useState(editing?.buildingName ?? "");
  const [owner, setOwner] = useState(editing?.owner ?? "");
  const [address, setAddress] = useState(editing?.address ?? initialAddress);
  const [city, setCity] = useState(editing?.city ?? initialCity);
  const [price, setPrice] = useState(editing ? String(editing.price) : "");
  const [type, setType] = useState<ListingType>(editing?.type ?? "sale");
  const [kind, setKind] = useState<PropertyKind>(editing?.kind ?? "apartments");
  const [beds, setBeds] = useState(String(editing?.beds ?? 2));
  const [baths, setBaths] = useState(String(editing?.baths ?? 1));
  const [sqft, setSqft] = useState(String(editing?.sqft ?? 1000));
  const [floors, setFloors] = useState(String(editing?.floors ?? 5));
  const [areaM, setAreaM] = useState(String(editing?.areaM ?? 50));
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [keptPhotos, setKeptPhotos] = useState<string[]>(
    editing?.photos ?? (editing?.photo ? [editing.photo] : []),
  );
  const [previews, setPreviews] = useState<string[]>([]);
  const photoCount = keptPhotos.length + photoFiles.length;

  // object URLs for new-file thumbnails; revoked on change/unmount
  useEffect(() => {
    const urls = photoFiles.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [photoFiles]);

  const addPhotos = (list: FileList | null) => {
    if (!list) return;
    setPhotoFiles((prev) =>
      [...prev, ...Array.from(list)].slice(0, Math.max(0, 5 - keptPhotos.length)),
    );
  };
  const [error, setError] = useState("");
  const [addressDirty, setAddressDirty] = useState(!!editing);

  // adopt reverse-geocode results as they arrive, unless the user already typed
  useEffect(() => {
    if (!addressDirty) {
      setAddress(initialAddress);
      setCity(initialCity);
    }
  }, [initialAddress, initialCity, addressDirty]);

  const submit = () => {
    if (saving) return;
    const p = Number(price);
    if (!p || p <= 0) return setError("Enter a price");
    if (!address.trim()) return setError("Enter an address");
    onSave(
      {
      buildingName: buildingName.trim(),
      owner: owner.trim(),
      address: address.trim(),
      city: city.trim(),
      price: p,
      type,
      kind,
        beds: Math.max(0, Number(beds) || 0),
        baths: Math.max(0, Number(baths) || 0),
        sqft: Math.max(0, Number(sqft) || 0),
        floors: Math.max(1, Number(floors) || 1),
        areaM: Math.max(1, Number(areaM) || 1),
      },
      photoFiles,
      keptPhotos,
    );
  };

  const toggle = (active: boolean) =>
    `rounded-full px-3.5 py-1.5 text-[12px] font-bold transition-colors ${
      active ? "bg-plum text-cream" : "bg-white/55 text-plum hover:bg-white/85"
    }`;

  return (
    <section className="glass no-scrollbar pointer-events-auto flex w-[300px] max-h-full flex-col gap-2.5 overflow-y-auto rounded-3xl p-4">
      <header className="flex items-center justify-between">
        <h3 className="text-[14px] font-bold text-plum">
          {editing ? "Edit property" : "New property"}
        </h3>
        <button
          onClick={onCancel}
          aria-label="Cancel new property"
          className="rounded-full p-1 text-plum-soft transition-colors hover:bg-plum/5 hover:text-plum"
        >
          <CloseIcon width={14} height={14} />
        </button>
      </header>

      <p className="text-[11px] font-medium text-plum-soft">
        {coords[1].toFixed(5)}, {coords[0].toFixed(5)}
        {geocoding && " · looking up address…"}
      </p>

      <label className={field}>
        <span className={fieldLabel}>Building</span>
        <input
          className={fieldInput}
          value={buildingName}
          onChange={(e) => setBuildingName(e.target.value)}
          placeholder="Sunrise Tower"
        />
      </label>

      <label className={field}>
        <span className={fieldLabel}>Owner</span>
        <input
          className={fieldInput}
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          placeholder="Full name"
        />
      </label>

      <label className={field}>
        <span className={fieldLabel}>Address</span>
        <input
          className={fieldInput}
          value={address}
          onChange={(e) => {
            setAddress(e.target.value);
            setAddressDirty(true);
          }}
          placeholder="SCO 12, Sector 17"
        />
      </label>

      <label className={field}>
        <span className={fieldLabel}>City</span>
        <input
          className={fieldInput}
          value={city}
          onChange={(e) => {
            setCity(e.target.value);
            setAddressDirty(true);
          }}
          placeholder="Chandigarh"
        />
      </label>

      <div className="flex items-center gap-1.5">
        <label className={`${field} flex-1`}>
          <span className={fieldLabel}>₹</span>
          <input
            className={fieldInput}
            type="number"
            min={0}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder={type === "rent" ? "per month" : "price"}
          />
        </label>
        <button className={toggle(type === "sale")} onClick={() => setType("sale")}>
          Sale
        </button>
        <button className={toggle(type === "rent")} onClick={() => setType("rent")}>
          Rent
        </button>
      </div>

      <label className={field}>
        <span className={fieldLabel}>Type</span>
        <select
          className={`${fieldInput} appearance-none capitalize`}
          value={kind}
          onChange={(e) => setKind(e.target.value as PropertyKind)}
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-3 gap-1.5">
        <label className={field}>
          <span className={fieldLabel}>Bd</span>
          <input
            className={fieldInput}
            type="number"
            min={0}
            value={beds}
            onChange={(e) => setBeds(e.target.value)}
            aria-label="Beds"
          />
        </label>
        <label className={field}>
          <span className={fieldLabel}>Ba</span>
          <input
            className={fieldInput}
            type="number"
            min={0}
            value={baths}
            onChange={(e) => setBaths(e.target.value)}
            aria-label="Baths"
          />
        </label>
        <label className={field}>
          <span className={fieldLabel}>Fl</span>
          <input
            className={fieldInput}
            type="number"
            min={1}
            value={floors}
            onChange={(e) => setFloors(e.target.value)}
            aria-label="Floors"
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <label className={field}>
          <span className={fieldLabel}>Sqft</span>
          <input
            className={fieldInput}
            type="number"
            min={0}
            value={sqft}
            onChange={(e) => setSqft(e.target.value)}
          />
        </label>
        <label className={field}>
          <span className={fieldLabel}>Area m²</span>
          <input
            className={fieldInput}
            type="number"
            min={1}
            value={areaM}
            onChange={(e) => setAreaM(e.target.value)}
          />
        </label>
      </div>

      <label className={field}>
        <span className={fieldLabel}>Photos</span>
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,image/avif"
          disabled={photoCount >= 5}
          onChange={(e) => {
            addPhotos(e.target.files);
            e.target.value = "";
          }}
          className="w-full min-w-0 text-[11px] font-medium text-plum-soft file:mr-2 file:rounded-full file:border-0 file:bg-plum/10 file:px-2.5 file:py-1 file:text-[11px] file:font-semibold file:text-plum disabled:opacity-50"
        />
      </label>
      <p className="px-1 text-[11px] font-medium text-plum-soft">
        {photoCount}/5 photos{photoCount >= 5 ? " — limit reached" : ""}
      </p>
      {photoCount > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {keptPhotos.map((url) => (
            <span key={url} className="relative h-14 w-16 overflow-hidden rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() => setKeptPhotos((prev) => prev.filter((u) => u !== url))}
                className="absolute right-0.5 top-0.5 rounded-full bg-plum/70 p-0.5 text-cream"
              >
                <CloseIcon width={9} height={9} />
              </button>
            </span>
          ))}
          {previews.map((url, i) => (
            <span key={url} className="relative h-14 w-16 overflow-hidden rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() =>
                  setPhotoFiles((prev) => prev.filter((_, j) => j !== i))
                }
                className="absolute right-0.5 top-0.5 rounded-full bg-plum/70 p-0.5 text-cream"
              >
                <CloseIcon width={9} height={9} />
              </button>
            </span>
          ))}
        </div>
      )}

      {error && (
        <p className="text-[12px] font-semibold text-coral">{error}</p>
      )}

      <button
        onClick={submit}
        disabled={saving}
        className="mt-1 rounded-full bg-plum py-2.5 text-[13px] font-bold text-cream transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {saving
          ? "Saving…"
          : editing
            ? "Save changes"
            : `Pay ${feeLabel("add_property")} & save property`}
      </button>
    </section>
  );
}
