"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { Filters, Listing } from "@/lib/types";
import { POIS, PRICE_DOMAIN } from "@/lib/listings";
import Navbar from "@/components/Navbar";
import FilterSidebar from "@/components/FilterSidebar";
import SearchBar from "@/components/SearchBar";
import MapControls from "@/components/MapControls";
import PropertyCarousel from "@/components/PropertyCarousel";
import PropertyDetailPanel from "@/components/PropertyDetailPanel";
import AddPropertyForm, {
  type PropertyDraft,
} from "@/components/AddPropertyForm";
import { payFee } from "@/lib/checkout";
import { celebrate } from "@/components/Celebration";

const Map3D = dynamic(() => import("@/components/Map3D"), { ssr: false });

const DEFAULT_FILTERS: Filters = {
  kind: null,
  price: PRICE_DOMAIN,
  rooms: null,
  areaFrom: 40,
  areaTo: 60,
  floorArea: null,
};

type AddStage = "idle" | "picking" | "form";

export default function Home() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [is3D, setIs3D] = useState(true);
  const [listings, setListings] = useState<Listing[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addStage, setAddStage] = useState<AddStage>("idle");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftCoords, setDraftCoords] = useState<[number, number] | null>(null);
  const [geoAddress, setGeoAddress] = useState("");
  const [geoCity, setGeoCity] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const geocodeSeq = useRef(0);
  const mapRef = useRef<MapLibreMap | null>(null);

  useEffect(() => {
    fetch("/api/properties")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Listing[]) => setListings(data))
      .catch(() => {});
  }, []);

  const filtered = useMemo(
    () =>
      listings.filter((l) => {
        if (filters.kind && l.kind !== filters.kind) return false;
        if (l.price < filters.price[0] || l.price > filters.price[1]) return false;
        if (filters.rooms !== null) {
          if (filters.rooms === 5 ? l.rooms < 5 : l.rooms !== filters.rooms)
            return false;
        }
        if (l.areaM < filters.areaFrom || l.areaM > filters.areaTo) return false;
        if (filters.floorArea === "less5" && l.floors > 5) return false;
        if (filters.floorArea === "6-10" && (l.floors < 6 || l.floors > 10))
          return false;
        if (filters.floorArea === "more10" && l.floors <= 10) return false;
        return true;
      }),
    [filters, listings],
  );

  const selected = listings.find((l) => l.id === selectedId) ?? null;
  const editing = listings.find((l) => l.id === editingId) ?? null;

  const flyToListing = (id: string) => {
    const l = listings.find((x) => x.id === id);
    if (!l) return;
    setSelectedId(id);
    mapRef.current?.flyTo({ center: l.coords, zoom: 16.4, duration: 1600 });
  };

  const searchPlace = async (query: string): Promise<boolean> => {
    const map = mapRef.current;
    if (!map) return false;
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=jsonv2&limit=1`,
      );
      if (!res.ok) return false;
      const results = (await res.json()) as Array<{
        lat: string;
        lon: string;
        boundingbox: [string, string, string, string];
      }>;
      const hit = results[0];
      if (!hit) return false;

      // fit the result's bounding box, but keep the 3D perspective
      const [s, n, w, e] = hit.boundingbox.map(Number);
      const cam = map.cameraForBounds(
        [
          [w, s],
          [e, n],
        ],
        { padding: 80 },
      );
      map.flyTo({
        center: cam?.center ?? [Number(hit.lon), Number(hit.lat)],
        zoom: Math.min(cam?.zoom ?? 13, 16),
        pitch: is3D ? 58 : 0,
        duration: 3000,
        essential: true,
      });
      return true;
    } catch {
      return false;
    }
  };

  const reverseGeocode = async (coords: [number, number]) => {
    const seq = ++geocodeSeq.current;
    setGeocoding(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${coords[1]}&lon=${coords[0]}&format=jsonv2&zoom=18`,
      );
      if (res.ok && seq === geocodeSeq.current) {
        const j = (await res.json()) as {
          display_name?: string;
          address?: Record<string, string>;
        };
        const a = j.address ?? {};
        const line = [a.house_number, a.road ?? a.neighbourhood, a.suburb]
          .filter(Boolean)
          .join(", ");
        const cityName = a.city ?? a.town ?? a.village ?? a.county ?? "";
        setGeoAddress(
          line ||
            (j.display_name ?? "").split(",").slice(0, 2).join(",").trim(),
        );
        setGeoCity([cityName, a.postcode].filter(Boolean).join(", "));
      }
    } catch {
      // leave fields blank — user types the address
    }
    if (seq === geocodeSeq.current) setGeocoding(false);
  };

  const handleMapClick = (coords: [number, number]) => {
    if (addStage === "idle") return;
    setDraftCoords(coords);
    setAddStage("form");
    if (!editingId) {
      setGeoAddress("");
      setGeoCity("");
      reverseGeocode(coords);
    }
  };

  const cancelAdd = () => {
    setAddStage("idle");
    setEditingId(null);
    setDraftCoords(null);
  };

  const openEdit = (l: Listing) => {
    setSelectedId(null);
    setEditingId(l.id);
    setDraftCoords(l.coords);
    setGeoAddress(l.address);
    setGeoCity(l.city);
    setAddStage("form");
  };

  const saveProperty = async (
    d: PropertyDraft,
    photoFiles: File[],
    keptPhotos: string[],
  ) => {
    if (!draftCoords || saving) return;
    setSaving(true);
    try {
      // featured listings require a one-time ₹250 payment; plain listings are free
      if (!editing && d.featured && !(await payFee("featured_property", "Featured listing boost"))) {
        return;
      }

      const uploadedPhotos = await Promise.all(
        photoFiles.map(async (photoFile) => {
          const fd = new FormData();
          fd.append("file", photoFile);
          const up = await fetch("/api/upload", { method: "POST", body: fd });
          return up.ok ? ((await up.json()) as { url: string }).url : null;
        }),
      );
      const failedUploads = uploadedPhotos.filter((url) => url === null).length;
      if (failedUploads > 0) {
        window.alert(
          `${failedUploads} photo${failedUploads > 1 ? "s" : ""} failed to upload — saving the listing with the rest.`,
        );
      }
      const photos = [
        ...keptPhotos,
        ...uploadedPhotos.filter((url) => url !== null),
      ].slice(0, 5);

      const body = {
        buildingName: d.buildingName || undefined,
        owner: d.owner || undefined,
        address: d.address,
        city: d.city,
        price: d.price,
        type: d.type,
        kind: d.kind,
        beds: d.beds,
        baths: d.baths,
        sqft: d.sqft,
        rooms: Math.max(1, d.beds + 1),
        areaM: d.areaM,
        floors: d.floors,
        coords: draftCoords,
        photo: photos[0],
        photos,
        featured: d.featured,
      };

      const res = editing
        ? await fetch(`/api/properties/${editing.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/properties", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
      if (!res.ok) {
        const msg = await res
          .json()
          .then((j: { error?: string }) => j.error)
          .catch(() => null);
        window.alert(`Could not save the listing${msg ? `: ${msg}` : ""}. Please try again.`);
        return;
      }
      const saved = (await res.json()) as Listing;

      setListings((prev) =>
        editing
          ? prev.map((l) => (l.id === saved.id ? saved : l))
          : [...prev, saved],
      );
      // widen filters so the saved property is never hidden by defaults
      setFilters({
        ...DEFAULT_FILTERS,
        price: [
          Math.min(PRICE_DOMAIN[0], d.price),
          Math.max(PRICE_DOMAIN[1], d.price),
        ],
        areaFrom: Math.min(DEFAULT_FILTERS.areaFrom, d.areaM),
        areaTo: Math.max(DEFAULT_FILTERS.areaTo, d.areaM),
      });
      cancelAdd();
      setSelectedId(saved.id);
      mapRef.current?.flyTo({ center: saved.coords, zoom: 16.4, duration: 1600 });
      celebrate(
        editing ? "Listing updated!" : "Listing added — it\u2019s live on the map!",
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteProperty = async (id: string) => {
    if (deleting) return;
    if (!window.confirm("Delete this property? This cannot be undone.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/properties/${id}`, { method: "DELETE" });
      if (res.ok || res.status === 404) {
        setListings((prev) => prev.filter((l) => l.id !== id));
        setSelectedId(null);
      }
    } finally {
      setDeleting(false);
    }
  };

  const toggleDimension = () => {
    const next = !is3D;
    setIs3D(next);
    mapRef.current?.easeTo({ pitch: next ? 58 : 0, duration: 900 });
  };

  return (
    <div className="flex h-full flex-col bg-cream">
      <Navbar />

      <main className="relative mx-3 mb-3 flex-1 overflow-hidden rounded-[22px] bg-cream-soft">
        <Map3D
          listings={filtered}
          pois={POIS}
          mapRef={mapRef}
          onSelect={flyToListing}
          onMapClick={handleMapClick}
          pickMode={addStage === "picking"}
          draftCoords={addStage === "form" ? draftCoords : null}
        />

        {/* overlay chrome */}
        <div className="pointer-events-none absolute inset-0 z-10 p-3.5">
          <div className="absolute bottom-3.5 left-3.5 top-3.5">
            <FilterSidebar
              filters={filters}
              onChange={setFilters}
              allListings={listings}
            />
          </div>

          <div className="pointer-events-auto absolute right-3.5 top-3.5 flex items-center gap-2.5">
            <button
              onClick={() =>
                addStage === "idle" ? setAddStage("picking") : cancelAdd()
              }
              className={`glass rounded-full px-4 py-2.5 text-[13px] font-bold transition-colors ${
                addStage === "idle"
                  ? "text-plum hover:bg-white/70"
                  : "bg-plum/90! text-cream"
              }`}
            >
              {addStage === "idle" ? "+ Add property" : "Cancel"}
            </button>
            <SearchBar onSearch={searchPlace} />
          </div>

          {addStage === "picking" && (
            <div className="glass absolute left-1/2 top-3.5 -translate-x-1/2 rounded-full px-5 py-2.5 text-[13px] font-semibold text-plum">
              Click a spot on the map to place the property
            </div>
          )}

          {addStage === "form" && draftCoords && (
            <div className="absolute bottom-3.5 right-3.5 top-[68px] z-20 flex items-start">
              <AddPropertyForm
                key={editingId ?? "new"}
                coords={draftCoords}
                editing={editing}
                initialAddress={geoAddress}
                initialCity={geoCity}
                geocoding={geocoding}
                saving={saving}
                onSave={saveProperty}
                onCancel={cancelAdd}
              />
            </div>
          )}

          {addStage === "idle" && selected && (
            <div className="absolute bottom-3.5 right-3.5 top-[68px] z-20 flex items-start">
              <PropertyDetailPanel
                listing={selected}
                onClose={() => setSelectedId(null)}
                onEdit={() => openEdit(selected)}
                onDelete={() => deleteProperty(selected.id)}
                deleting={deleting}
              />
            </div>
          )}

          <div className="pointer-events-auto absolute right-3.5 top-[38%]">
            <MapControls
              is3D={is3D}
              onZoomIn={() => mapRef.current?.zoomIn()}
              onZoomOut={() => mapRef.current?.zoomOut()}
              onToggleDimension={toggleDimension}
            />
          </div>

          <div className="absolute bottom-3.5 left-[268px] right-3.5">
            <PropertyCarousel
              listings={filtered}
              onSelect={flyToListing}
              hasAny={listings.length > 0}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
