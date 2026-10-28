"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Design, Listing, ListingType, ListingView, PropertyKind } from "@/lib/types";
import { feeLabel } from "@/lib/fees";
import { PAYWALL_ENABLED } from "@/lib/paywall";
import { MAX_UPLOAD_BYTES, SUPPORTED_MIME_TYPES } from "@/lib/upload";
import { safeImageUrl } from "@/lib/url";
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
  /** true when the user opted-in and paid the featured-listing fee */
  featured: boolean;
  /** attached published design; null = none (detaches on edit) */
  designId: string | null;
  /** what the listing opens on; "photos" whenever no design is attached */
  defaultView: ListingView;
}

const INTENTS: { id: ListingType; label: string }[] = [
  { id: "sale", label: "Sale" },
  { id: "rent", label: "Rent" },
  { id: "showcase", label: "Showcase only" },
];

/** the owner's designs that can be offered in the attach select */
type OwnerDesign = Pick<Design, "id" | "name" | "publishedAt">;

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

// Hairline field boxes; the focus ring sits on the box (the bare input inside
// has no outline of its own), so keyboard users always see where they are.
const field =
  "flex min-h-11 items-baseline gap-2 rounded-[5px] border border-line-strong bg-paper px-3 py-2.5 text-[14px] transition-colors hover:border-ink focus-within:border-ink focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-accent";
const fieldLabel = "shrink-0 text-[13px] font-semibold text-ink-soft";
const fieldInput =
  "w-full min-w-0 bg-transparent font-semibold tabular-nums text-ink outline-none placeholder:font-normal placeholder:text-ink-soft/70";
const focusRing =
  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent";
const hint = "px-0.5 text-[14px] leading-snug text-ink-soft";
// a selected intent takes its map category colour (Map3D PRISM_COLORS)
const INTENT_FILL: Record<ListingType, string> = {
  sale: "bg-highlight",
  rent: "bg-clay",
  showcase: "bg-mist",
};

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
  // owner is paywalled and absent from the public list, so preload the gated
  // detail for the lister before the edit form renders
  const [owner, setOwner] = useState(editing?.owner ?? "");
  const [prevEditId, setPrevEditId] = useState(editing?.id);
  if (editing && prevEditId !== editing.id) {
    setPrevEditId(editing.id);
    setOwner(editing.owner ?? "");
  }
  const [address, setAddress] = useState(editing?.address ?? initialAddress);
  const [city, setCity] = useState(editing?.city ?? initialCity);
  // showcase listings store price 0; start blank if the owner switches intent
  const [price, setPrice] = useState(
    editing && editing.type !== "showcase" ? String(editing.price) : "",
  );
  const [type, setType] = useState<ListingType>(editing?.type ?? "sale");
  const [kind, setKind] = useState<PropertyKind>(editing?.kind ?? "apartments");
  const [beds, setBeds] = useState(String(editing?.beds ?? 2));
  const [baths, setBaths] = useState(String(editing?.baths ?? 1));
  const [sqft, setSqft] = useState(String(editing?.sqft ?? 1000));
  const [floors, setFloors] = useState(String(editing?.floors ?? 5));
  const [areaM, setAreaM] = useState(String(editing?.areaM ?? 50));
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [featured, setFeatured] = useState(editing?.featured ?? false);
  const [keptPhotos, setKeptPhotos] = useState<string[]>(
    editing?.photos ?? (editing?.photo ? [editing.photo] : []),
  );
  const [designId, setDesignId] = useState<string | null>(editing?.designId ?? null);
  const [defaultView, setDefaultView] = useState<ListingView>(
    editing?.defaultView ?? "photos",
  );
  // null while loading; the owner's designs from /api/designs
  const [ownerDesigns, setOwnerDesigns] = useState<OwnerDesign[] | null>(null);
  const [designsFailed, setDesignsFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/designs", { signal: controller.signal })
      .then(async (r) => {
        if (!r.ok) throw new Error("designs unavailable");
        const data: unknown = await r.json();
        if (!Array.isArray(data)) throw new Error("bad designs response");
        if (!controller.signal.aborted) {
          setOwnerDesigns(
            (data as Design[]).map(({ id, name, publishedAt }) => ({ id, name, publishedAt })),
          );
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setDesignsFailed(true);
      });
    return () => controller.abort();
  }, []);

  // only published designs can be newly attached (the server re-checks); the
  // stored attachment stays listed even if it was unpublished since
  const storedDesignId = editing?.designId ?? null;
  const publishedDesigns = (ownerDesigns ?? []).filter(
    (d) => d.publishedAt && d.id !== storedDesignId,
  );
  const storedDesign = ownerDesigns?.find((d) => d.id === storedDesignId);
  const storedUnpublished =
    !!storedDesignId &&
    (editing?.designPublished === false || (!!storedDesign && !storedDesign.publishedAt));
  const photoCount = keptPhotos.length + photoFiles.length;

  // object URLs for new-file thumbnails, derived from the files; stale ones
  // revoked whenever the list changes (and on unmount)
  const previews = useMemo(
    () => photoFiles.map((f) => URL.createObjectURL(f)),
    [photoFiles],
  );
  useEffect(
    () => () => previews.forEach((u) => URL.revokeObjectURL(u)),
    [previews],
  );

  const addPhotos = (list: FileList | null) => {
    if (!list) return;
    const files = Array.from(list);
    const supported = files.filter((f) => SUPPORTED_MIME_TYPES.has(f.type));
    const sized = supported.filter((f) => f.size <= MAX_UPLOAD_BYTES);
    if (supported.length < files.length) {
      setError("Some photos skipped — use JPG, PNG, WebP or AVIF (HEIC not supported)");
    } else if (sized.length < supported.length) {
      setError(
        `Some photos skipped — each photo must be under ${MAX_UPLOAD_BYTES / 1024 / 1024} MB`,
      );
    } else {
      setError("");
    }
    setPhotoFiles((prev) =>
      [...prev, ...sized].slice(0, Math.max(0, 5 - keptPhotos.length)),
    );
  };
  const [error, setError] = useState("");
  const [addressDirty, setAddressDirty] = useState(!!editing);

  // show live reverse-geocode results until the user types, then their input wins
  const shownAddress = addressDirty ? address : initialAddress;
  const shownCity = addressDirty ? city : initialCity;

  const submit = () => {
    if (saving) return;
    const showcase = type === "showcase";
    const p = showcase ? 0 : Number(price);
    if (!showcase && (!p || p <= 0)) return setError("Enter a price");
    if (!shownAddress.trim()) return setError("Enter an address");
    onSave(
      {
      buildingName: buildingName.trim(),
      owner: owner.trim(),
      address: shownAddress.trim(),
      city: shownCity.trim(),
      price: p,
      type,
      kind,
        beds: Math.max(0, Number(beds) || 0),
        baths: Math.max(0, Number(baths) || 0),
        sqft: Math.max(0, Number(sqft) || 0),
        floors: Math.max(1, Number(floors) || 1),
        areaM: Math.max(1, Number(areaM) || 1),
        featured,
        designId,
        defaultView: designId ? defaultView : "photos",
      },
      photoFiles,
      keptPhotos,
    );
  };

  const toggle = (active: boolean, fill = "bg-highlight") =>
    `${focusRing} min-h-9 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold text-ink transition-colors ${
      active ? `border-ink ${fill}` : "border-line-strong bg-paper hover:border-ink"
    }`;

  return (
    <section className="no-scrollbar pointer-events-auto flex w-[300px] max-h-full flex-col gap-2.5 overflow-y-auto rounded-md border border-line bg-paper/95 p-4 text-ink shadow-[0_18px_35px_-24px_rgb(41_55_44/0.45)] backdrop-blur">
      <header className="flex items-center justify-between">
        <h3 className="font-display text-[20px] font-normal leading-tight tracking-[-0.02em] text-ink">
          {editing ? "Edit property" : "New property"}
        </h3>
        <button
          onClick={onCancel}
          aria-label="Cancel new property"
          className={`${focusRing} grid size-8 shrink-0 place-items-center rounded-full text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink`}
        >
          <CloseIcon width={14} height={14} />
        </button>
      </header>

      <p className="text-[11px] font-bold uppercase tracking-[0.14em] tabular-nums text-ink-soft">
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
          // signed-in viewers get Call / WhatsApp / Email buttons from this
          // (lib/contact-links.ts), so ask for a number or an address
          placeholder="Name, phone or email"
          aria-label="Owner name and phone or email"
        />
      </label>

      <label className={field}>
        <span className={fieldLabel}>Address</span>
        <input
          className={fieldInput}
          value={shownAddress}
          onChange={(e) => {
            setAddress(e.target.value);
            if (!addressDirty) {
              setCity(shownCity); // freeze the geocoded city too
              setAddressDirty(true);
            }
          }}
          placeholder="SCO 12, Sector 17"
        />
      </label>

      <label className={field}>
        <span className={fieldLabel}>City</span>
        <input
          className={fieldInput}
          value={shownCity}
          onChange={(e) => {
            setCity(e.target.value);
            if (!addressDirty) {
              setAddress(shownAddress); // freeze the geocoded address too
              setAddressDirty(true);
            }
          }}
          placeholder="Chandigarh"
        />
      </label>

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Listing intent">
        {INTENTS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            aria-pressed={type === id}
            className={toggle(type === id, INTENT_FILL[id])}
            onClick={() => setType(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {type === "showcase" ? (
        <p className={hint}>
          Shown on the map as “not for sale/rent” — no price needed. Showcase
          listings are reviewed like any other.
        </p>
      ) : (
        <label className={field}>
          <span className={fieldLabel}>₹</span>
          <input
            className={fieldInput}
            type="number"
            min={0}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder={type === "rent" ? "per month" : "price"}
            aria-label={type === "rent" ? "Monthly rent" : "Price"}
          />
        </label>
      )}

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
        <span className={fieldLabel}>
          Photos <span className="font-normal">(optional)</span>
        </span>
        <input
          type="file"
          multiple
          accept="image/*"
          disabled={photoCount >= 5}
          onChange={(e) => {
            addPhotos(e.target.files);
            e.target.value = "";
          }}
          className="w-full min-w-0 text-[13px] text-ink-soft outline-none file:mr-2 file:cursor-pointer file:rounded-[5px] file:border file:border-solid file:border-line-strong file:bg-paper-soft file:px-2.5 file:py-1 file:text-[13px] file:font-semibold file:text-ink disabled:opacity-50"
        />
      </label>
      <p className={`${hint} tabular-nums`}>
        {photoCount === 0
          ? "0/5 photos — you can list without images"
          : `${photoCount}/5 photos${photoCount >= 5 ? " — limit reached" : ""}`}
      </p>
      {photoCount > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {keptPhotos.map((url, i) => {
            const safeUrl = safeImageUrl(url);
            return safeUrl ? (
            <span key={url} className="relative h-14 w-16 overflow-hidden rounded-[5px] border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={safeUrl}
                alt={`Saved listing photo ${i + 1}`}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() => setKeptPhotos((prev) => prev.filter((u) => u !== url))}
                // inset ring: the thumbnail clips anything drawn outside the button
                className="absolute right-0.5 top-0.5 grid size-6 place-items-center rounded-full bg-ink/75 text-paper hover:bg-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-paper"
              >
                <CloseIcon width={9} height={9} />
              </button>
            </span>
            ) : null;
          })}
          {previews.map((url, i) => (
            <span key={url} className="relative h-14 w-16 overflow-hidden rounded-[5px] border border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`New photo to upload: ${photoFiles[i]?.name ?? i + 1}`}
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() =>
                  setPhotoFiles((prev) => prev.filter((_, j) => j !== i))
                }
                // inset ring: the thumbnail clips anything drawn outside the button
                className="absolute right-0.5 top-0.5 grid size-6 place-items-center rounded-full bg-ink/75 text-paper hover:bg-ink focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-paper"
              >
                <CloseIcon width={9} height={9} />
              </button>
            </span>
          ))}
        </div>
      )}

      <label className={field}>
        <span className={fieldLabel}>3D design</span>
        <select
          className={`${fieldInput} appearance-none`}
          value={designId ?? ""}
          onChange={(e) => setDesignId(e.target.value || null)}
          aria-label="Attach a 3D design"
        >
          <option value="">None</option>
          {storedDesignId && (
            <option value={storedDesignId}>
              {storedDesign?.name ?? "Attached design"}
              {storedUnpublished ? " (unpublished — hidden from visitors)" : ""}
            </option>
          )}
          {publishedDesigns.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </label>
      {ownerDesigns === null && !designsFailed ? (
        <p className={hint}>Loading your designs…</p>
      ) : designsFailed ? (
        <p className={hint}>
          Couldn’t load your designs — the current attachment is kept.
        </p>
      ) : (
        publishedDesigns.length === 0 &&
        !storedDesignId && (
          <p className={hint}>
            No published designs yet —{" "}
            <Link href="/designer" className={`${focusRing} rounded-[3px] font-semibold text-accent underline underline-offset-4 hover:text-accent-deep`}>
              publish one in the designer
            </Link>{" "}
            to attach it.
          </p>
        )
      )}

      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Open first with">
        <span className={`${fieldLabel} px-0.5 ${designId ? "" : "opacity-60"}`}>
          Open first with
        </span>
        {(["photos", "3d"] as const).map((v) => (
          <button
            key={v}
            type="button"
            disabled={!designId}
            aria-pressed={!!designId && defaultView === v}
            className={`${toggle(!!designId && defaultView === v)} disabled:cursor-not-allowed disabled:opacity-50`}
            onClick={() => setDefaultView(v)}
          >
            {v === "photos" ? "Photos" : "3D"}
          </button>
        ))}
      </div>

      {error && (
        <p role="alert" className="text-[14px] font-semibold text-accent">{error}</p>
      )}

      {/* ── Featured listing upsell (paid; hidden while the paywall is off) ── */}
      {PAYWALL_ENABLED && (
        <button
          type="button"
          onClick={() => setFeatured((v) => !v)}
          aria-pressed={featured}
          className={`${focusRing} flex items-center gap-2.5 rounded-[5px] border px-3.5 py-2.5 text-left text-ink transition-colors ${
            featured
              ? "border-highlight-deep bg-highlight"
              : "border-line-strong bg-paper hover:border-ink"
          }`}
        >
          <span aria-hidden="true" className="text-[18px]">{featured ? "⭐" : "☆"}</span>
          <span className="flex flex-col">
            <span className="text-[14px] font-semibold">
              {featured
                ? `Featured listing — ${feeLabel("featured_property")}`
                : `Feature on map — ${feeLabel("featured_property")}`}
            </span>
            <span className="text-[14px] leading-snug text-ink-soft">
              {featured
                ? "Your property gets a golden star on the 3D map"
                : "Stand out with a glowing star marker on the map"}
            </span>
          </span>
        </button>
      )}

      <button
        onClick={submit}
        disabled={saving}
        className={`${focusRing} mt-1 min-h-11 rounded-[5px] bg-accent px-5 py-3 text-[13px] font-semibold text-paper transition-colors hover:bg-accent-deep disabled:opacity-50`}
      >
        {saving
          ? "Saving…"
          : editing
            ? "Save changes"
            : featured
              ? `Pay ${feeLabel("featured_property")} & save featured property`
              : "Save property — free"}
      </button>
    </section>
  );
}
