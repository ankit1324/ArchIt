"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { Filters, Listing, PublishedDesign } from "@/lib/types";
import { POIS } from "@/lib/listings";
import {
  DEFAULT_FILTERS,
  countFilters,
  findListings,
  matchesDesignQuery,
  type ListingSort,
  type MapLayer,
} from "@/lib/find";
import styles from "./find.module.css";
import Navbar from "@/components/Navbar";
import FilterSidebar from "@/components/FilterSidebar";
import SearchBar from "@/components/SearchBar";
import MapControls from "@/components/MapControls";
import PropertyCarousel from "@/components/PropertyCarousel";
import PropertyDetailPanel from "@/components/PropertyDetailPanel";
import DesignPinCard from "@/components/DesignPinCard";
import DesignViewer from "@/components/DesignViewer";
import AddPropertyForm, {
  type PropertyDraft,
} from "@/components/AddPropertyForm";
// [PAYWALL DISABLED — free for now]
// import { payFee } from "@/lib/checkout";
import { celebrate } from "@/components/Celebration";

const Map3D = dynamic(() => import("@/components/Map3D"), { ssr: false });

type AddStage = "idle" | "picking" | "form";

// stable empties for the hidden layer: a fresh [] each render would make
// Map3D rebuild every marker (and drop pin focus) on every keystroke
const NO_LISTINGS: Listing[] = [];
const NO_DESIGNS: PublishedDesign[] = [];

export default function Home() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ListingSort>("recommended");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const activeFilters = countFilters(filters);
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
  const [designs, setDesigns] = useState<PublishedDesign[]>([]);
  const [layer, setLayer] = useState<MapLayer>("both");
  const [selectedDesignId, setSelectedDesignId] = useState<string | null>(null);
  const [viewerDesignId, setViewerDesignId] = useState<string | null>(null);
  const geocodeSeq = useRef(0);
  const mapRef = useRef<MapLibreMap | null>(null);
  // `?design=<id>` deep link: flown to once both the map and designs are ready
  const mapLoadedRef = useRef(false);
  const pendingDesignRef = useRef<PublishedDesign | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/properties", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load properties");
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error("Invalid properties response");
        if (!controller.signal.aborted) {
          setListings(data);
          setLoadState("ready");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadState("error");
      });
    return () => controller.abort();
  }, [loadAttempt]);

  // published designs with a map spot; a failure just leaves the layer empty
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/showcase?limit=200&located=1", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : []))
      .then((data: unknown) => {
        if (controller.signal.aborted || !Array.isArray(data)) return;
        const located = (data as PublishedDesign[]).filter((d) => d.plotCenter);
        setDesigns(located);
        const wanted = new URLSearchParams(window.location.search).get("design");
        const target = wanted ? located.find((d) => d.id === wanted) : undefined;
        if (!target) return;
        setLayer((l) => (l === "listings" ? "both" : l));
        setSelectedId(null);
        setSelectedDesignId(target.id);
        if (mapLoadedRef.current) flyToDesign(target);
        else pendingDesignRef.current = target;
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const filtered = useMemo(
    () => findListings(listings, filters, query, sort),
    [filters, listings, query, sort],
  );
  const matchingDesigns = useMemo(
    () => designs.filter((d) => matchesDesignQuery(d, query)),
    [designs, query],
  );

  const resetSearch = () => {
    setFilters(DEFAULT_FILTERS);
    setQuery("");
  };

  const showResults = () => {
    const map = mapRef.current;
    if (!map || !filtered.length) return;
    const height = map.getContainer().clientHeight;
    const lngs = filtered.map((l) => l.coords[0]);
    const lats = filtered.map((l) => l.coords[1]);
    map.fitBounds(
      [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      { padding: { top: Math.min(140, height * 0.2), bottom: Math.min(260, height * 0.4), left: window.innerWidth >= 1024 ? 300 : 40, right: 60 }, maxZoom: 16, duration: 1000 },
    );
  };

  const selected = filtered.find((l) => l.id === selectedId) ?? null;
  const editing = listings.find((l) => l.id === editingId) ?? null;
  const selectedDesign =
    layer !== "listings"
      ? (matchingDesigns.find((d) => d.id === selectedDesignId) ?? null)
      : null;

  const flyToListing = (id: string) => {
    const l = listings.find((x) => x.id === id);
    if (!l) return;
    setFiltersOpen(false);
    setSelectedDesignId(null);
    setSelectedId(id);
    mapRef.current?.flyTo({ center: l.coords, zoom: 16.4, duration: 1600 });
  };

  function flyToDesign(d: PublishedDesign) {
    if (!d.plotCenter) return;
    mapRef.current?.flyTo({ center: d.plotCenter, zoom: 16.4, duration: 1600 });
  }

  const selectDesign = (id: string) => {
    const d = designs.find((x) => x.id === id);
    if (!d) return;
    setFiltersOpen(false);
    setSelectedId(null);
    setSelectedDesignId(id);
    flyToDesign(d);
  };

  const handleMapLoad = () => {
    mapLoadedRef.current = true;
    const pending = pendingDesignRef.current;
    pendingDesignRef.current = null;
    if (pending) flyToDesign(pending);
  };

  const searchPlace = async (query: string, signal: AbortSignal): Promise<boolean> => {
    const map = mapRef.current;
    if (!map) throw new Error("Map is still loading");
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=jsonv2&limit=1`,
        { signal },
      );
      if (!res.ok) throw new Error("Place search unavailable");
      const results = (await res.json()) as Array<{
        lat: string;
        lon: string;
        boundingbox: [string, string, string, string];
      }>;
      const hit = results[0];
      if (!hit || signal.aborted) return false;

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
        essential: false,
      });
      return true;
    } catch (error) {
      if (signal.aborted) return false;
      throw error;
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
        // sent explicitly on edit too: null detaches, the stored id keeps it
        designId: d.designId,
        defaultView: d.defaultView,
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

      // [PAYWALL DISABLED — free for now] featuring a listing is free; the
      // server persists `featured` straight from the POST/PUT request body,
      // so no Razorpay checkout or follow-up flip is needed.
      // Featured boost is a paid add-on; the server only persists it after
      // verifying a purchase tied to this listing's id (see properties/[id]).
      // if (!editing && d.featured && !saved.featured) {
      //   const paid = await payFee(
      //     "featured_property",
      //     "Featured listing boost",
      //     saved.id,
      //   );
      //   if (paid) {
      //     const flip = await fetch(`/api/properties/${saved.id}`, {
      //       method: "PUT",
      //       headers: { "Content-Type": "application/json" },
      //       body: JSON.stringify({ ...saved, featured: true }),
      //     });
      //     if (flip.ok) Object.assign(saved, await flip.json());
      //   }
      // }

      setListings((prev) =>
        editing
          ? prev.map((l) => (l.id === saved.id ? saved : l))
          : [...prev, saved],
      );
      resetSearch();
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

      <main className={`${styles.canvas} relative mx-2 mb-2 min-h-0 flex-1 overflow-hidden rounded-[22px] bg-cream-soft sm:mx-3 sm:mb-3`}>
        <Map3D
          listings={layer === "designs" ? NO_LISTINGS : filtered}
          designs={layer === "listings" ? NO_DESIGNS : matchingDesigns}
          pois={POIS}
          mapRef={mapRef}
          onSelect={flyToListing}
          onSelectDesign={selectDesign}
          onLoad={handleMapLoad}
          onMapClick={handleMapClick}
          pickMode={addStage === "picking"}
          draftCoords={addStage === "form" ? draftCoords : null}
        />

        {/* overlay chrome */}
        <div className="pointer-events-none absolute inset-0 z-10 p-3.5">
          <div id="find-filters" onKeyDown={(event) => { if (event.key === "Escape") setFiltersOpen(false); }} className={`${styles.filters} ${filtersOpen ? styles.filtersOpen : ""}`}>
            <div className={styles.filterHeading}><div><span className={styles.eyebrow}>MAKE IT YOURS</span><h1>Find a property</h1></div><button onClick={() => setFiltersOpen(false)} className={styles.closeFilters} aria-label="Close filters">✕</button></div>
            <FilterSidebar
              filters={filters}
              onChange={setFilters}
              allListings={filters.type ? listings.filter((l) => l.type === filters.type) : listings}
              onReset={resetSearch}
              activeCount={activeFilters}
            />
          </div>

          <div className={styles.toolbar}>
            <SearchBar value={query} onChange={setQuery} onSearch={searchPlace} onShowResults={showResults} resultCount={filtered.length} />
            <button className={styles.filterToggle} aria-expanded={filtersOpen} aria-controls="find-filters" onClick={() => setFiltersOpen(!filtersOpen)}>Filters{activeFilters ? ` (${activeFilters})` : ""}</button>
            <button
              onClick={() => {
                setFiltersOpen(false);
                if (addStage === "idle") setAddStage("picking");
                else cancelAdd();
              }}
              className={`glass rounded-full px-4 py-2.5 text-[13px] font-bold transition-colors ${
                addStage === "idle"
                  ? "text-plum hover:bg-white/70"
                  : "bg-plum/90! text-cream"
              }`}
            >
              {addStage === "idle" ? "+ Add property" : "Cancel"}
            </button>

          </div>

          {addStage === "picking" && (
            <div className={`${styles.pickHint} glass rounded-full px-5 py-2.5 text-[13px] font-semibold text-plum`}>
              Click a spot on the map to place the property
            </div>
          )}

          <div className={styles.mapControls}>
            <MapControls
              is3D={is3D}
              onZoomIn={() => mapRef.current?.zoomIn()}
              onZoomOut={() => mapRef.current?.zoomOut()}
              onToggleDimension={toggleDimension}
              layer={layer}
              onLayerChange={setLayer}
            />
          </div>

          <div className={styles.results}>
            <div className={styles.resultBar}>
              <div aria-live="polite"><strong>{loadState === "ready" ? `${filtered.length} ${filtered.length === 1 ? "property" : "properties"}` : "Explore properties"}</strong><span>{query ? `Matching “${query}”` : "Find your next place"}</span></div>
              <div className={styles.resultActions}>
                <button onClick={showResults} disabled={!filtered.length}>Show on map ↗</button>
                <select aria-label="Sort properties" value={sort} onChange={(e) => setSort(e.target.value as ListingSort)}>
                  <option value="recommended">Featured first</option>
                  <option value="price-asc">Price: low to high</option>
                  <option value="price-desc">Price: high to low</option>
                  <option value="area-desc">Largest area</option>
                </select>
              </div>
            </div>
            <PropertyCarousel
              listings={filtered}
              onSelect={flyToListing}
              hasAny={listings.length > 0}
              status={loadState}
              selectedId={selectedId}
              onReset={resetSearch}
              onRetry={() => { setLoadState("loading"); setLoadAttempt((n) => n + 1); }}
            />
          </div>

          {/* panels render last so they paint above the carousel strip and
              map controls without needing a z-index scheme */}
          {addStage === "form" && draftCoords && (
            <div className={styles.detailPanel}>
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
            <div className={styles.detailPanel}>
              <PropertyDetailPanel
                listing={selected}
                onClose={() => setSelectedId(null)}
                onEdit={() => openEdit(selected)}
                onDelete={() => deleteProperty(selected.id)}
                deleting={deleting}
                onOpen3D={setViewerDesignId}
              />
            </div>
          )}

          {addStage === "idle" && !selected && selectedDesign && (
            <div className={styles.detailPanel}>
              <DesignPinCard
                design={selectedDesign}
                onClose={() => setSelectedDesignId(null)}
                onOpen3D={() => setViewerDesignId(selectedDesign.id)}
              />
            </div>
          )}
        </div>
      </main>

      {/* outside <main>: its overflow and the glass panels' backdrop-filter
          would otherwise clip this fixed, full-screen overlay */}
      {viewerDesignId && (
        <DesignViewer designId={viewerDesignId} onClose={() => setViewerDesignId(null)} />
      )}
    </div>
  );
}
