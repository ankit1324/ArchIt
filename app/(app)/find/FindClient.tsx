"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { Filters, Listing } from "@/lib/types";
import { POIS } from "@/lib/listings";
import { DEFAULT_FILTERS, countFilters, findListings, type ListingSort } from "@/lib/find";
import type { BBox } from "@/lib/listing-query";
import styles from "./find.module.css";
import Navbar from "@/components/Navbar";
import FilterSidebar from "@/components/FilterSidebar";
import SearchBar from "@/components/SearchBar";
import MapControls from "@/components/MapControls";
import PropertyCarousel from "@/components/PropertyCarousel";
import PropertyDetailPanel, { invalidateListing } from "@/components/PropertyDetailPanel";
import AddPropertyForm, {
  type PropertyDraft,
} from "@/components/AddPropertyForm";
import { payFee } from "@/lib/checkout";
import { celebrate, notify } from "@/components/Celebration";
import BottomSheet from "@/components/BottomSheet";

// maplibre (~1MB) stays out of the page chunk; the listings it shows arrive
// with the HTML, so the map is the only thing still loading after hydration
const Map3D = dynamic(() => import("@/components/Map3D"), { ssr: false });

type AddStage = "idle" | "picking" | "form";

export interface ListingPage {
  listings: Listing[];
  nextCursor: string | null;
}

/** One GET /api/properties page; the next page's cursor is in a header. */
async function fetchListingPage(params: URLSearchParams, signal: AbortSignal): Promise<ListingPage> {
  const qs = params.toString();
  const response = await fetch(`/api/properties${qs ? `?${qs}` : ""}`, { signal });
  if (!response.ok) throw new Error("Could not load properties");
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error("Invalid properties response");
  return { listings: data, nextCursor: response.headers.get("X-Next-Cursor") };
}

/**
 * Toast text for a failed listing write. The API's own messages are fine for
 * validation errors ("price must be …"), but an expired session or a rate
 * limit answer with bare "unauthorized" / "too many requests".
 */
function writeErrorMessage(action: "save" | "delete", status: number, msg: string | null): string {
  if (status === 401) return `Your session has expired. Sign in again to ${action} the listing.`;
  if (status === 403) return `You can only ${action} listings you added.`;
  if (status === 429) return "Too many changes in a short time. Please wait a minute and try again.";
  return `Could not ${action} the listing${msg ? `: ${msg}` : ""}. Please try again.`;
}

/** append `more` to `prev`, skipping ids already present (local edits win) */
function appendNew(prev: Listing[], more: Listing[]): Listing[] {
  const seen = new Set(prev.map((l) => l.id));
  return [...prev, ...more.filter((l) => !seen.has(l.id))];
}

export default function FindClient({
  initialPage,
  initialSelectedId = null,
}: {
  initialPage: ListingPage | null;
  initialSelectedId?: string | null;
}) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<ListingSort>("recommended");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">(
    initialPage ? "ready" : "loading",
  );
  const [loadAttempt, setLoadAttempt] = useState(0);
  const activeFilters = countFilters(filters);
  const [is3D, setIs3D] = useState(true);
  const [listings, setListings] = useState<Listing[]>(() => initialPage?.listings ?? []);
  // "Search as I move": the viewport's listings, fetched by bbox, replace the
  // full set while on. null until the first viewport fetch lands.
  const [searchArea, setSearchArea] = useState(false);
  const [areaListings, setAreaListings] = useState<Listing[] | null>(null);
  const [areaTruncated, setAreaTruncated] = useState(false);
  // the last viewport fetch failed: the bar must not claim "In this map area"
  // while it is really showing the full set (or a stale area)
  const [areaFailed, setAreaFailed] = useState(false);
  const areaTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const areaAbort = useRef<AbortController | null>(null);
  // seeded from ?property=<id> (a public /property/:id page links here); the
  // panel opens once that listing has loaded, possibly from a later page
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId);
  const [addStage, setAddStage] = useState<AddStage>("idle");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftCoords, setDraftCoords] = useState<[number, number] | null>(null);
  const [geoAddress, setGeoAddress] = useState("");
  const [geoCity, setGeoCity] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geocodeAbort = useRef<AbortController | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  // The server rendered the first page. Page through the rest in the
  // background (each page lands as it arrives); a retry starts from scratch.
  useEffect(() => {
    const resume = loadAttempt === 0 ? initialPage : null;
    if (resume && !resume.nextCursor) return;
    const controller = new AbortController();
    (async () => {
      let cursor = resume ? resume.nextCursor : null;
      do {
        const params = new URLSearchParams(cursor ? { cursor } : {});
        const page = await fetchListingPage(params, controller.signal);
        if (controller.signal.aborted) return;
        // merge, never replace: a listing saved while pages load must stay
        setListings((prev) => appendNew(prev, page.listings));
        setLoadState("ready");
        cursor = page.nextCursor;
      } while (cursor);
    })().catch(() => {
      // a failed later page keeps what already loaded
      if (!controller.signal.aborted && !resume) setLoadState("error");
    });
    return () => controller.abort();
  }, [loadAttempt, initialPage]);

  const fetchArea = useCallback((bbox: BBox) => {
    areaAbort.current?.abort();
    const controller = new AbortController();
    areaAbort.current = controller;
    fetchListingPage(new URLSearchParams({ bbox: bbox.map((n) => n.toFixed(5)).join(",") }), controller.signal)
      .then((page) => {
        if (controller.signal.aborted) return;
        setAreaListings(page.listings);
        setAreaFailed(false);
        // more rows than one page in view: ask the user to zoom in
        setAreaTruncated(page.nextCursor !== null);
      })
      .catch(() => {
        // keep the previous area results; the next move retries
        if (!controller.signal.aborted) setAreaFailed(true);
      });
  }, []);

  // 350ms debounce so a fling or a flyTo settles before we query
  const handleMoveEnd = useCallback((bbox: BBox) => {
    if (!searchArea) return;
    if (areaTimer.current) clearTimeout(areaTimer.current);
    areaTimer.current = setTimeout(() => fetchArea(bbox), 350);
  }, [fetchArea, searchArea]);

  useEffect(() => () => {
    if (areaTimer.current) clearTimeout(areaTimer.current);
    areaAbort.current?.abort();
  }, []);

  const toggleSearchArea = () => {
    const next = !searchArea;
    setSearchArea(next);
    if (areaTimer.current) clearTimeout(areaTimer.current);
    areaAbort.current?.abort();
    setAreaListings(null);
    setAreaTruncated(false);
    setAreaFailed(false);
    const map = mapRef.current;
    if (next && map) {
      const b = map.getBounds();
      fetchArea([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
    }
  };

  // writes (save / delete) land in both the full set and the area view
  const updateListings = useCallback((fn: (prev: Listing[]) => Listing[]) => {
    // an area response read before this write would undo it when it lands
    areaAbort.current?.abort();
    setListings(fn);
    setAreaListings((prev) => (prev ? fn(prev) : prev));
  }, []);

  const source = searchArea && areaListings ? areaListings : listings;
  const filtered = useMemo(
    () => findListings(source, filters, query, sort),
    [filters, source, query, sort],
  );
  // The map (marker diff + prism geojson) and the card strip are the heavy
  // consumers; feeding them a deferred copy keeps slider drags and typing
  // responsive — the inputs commit at high priority, these catch up after.
  const deferredFiltered = useDeferredValue(filtered);
  // histogram distribution: all listings of the chosen type, independent of
  // the other filters; memoised so FilterSidebar/PriceHistogram don't recompute
  // their bars on every unrelated render
  const histogramListings = useMemo(
    () => (filters.type ? source.filter((l) => l.type === filters.type) : source),
    [filters.type, source],
  );

  const resetSearch = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setQuery("");
  }, []);

  const showResults = useCallback(() => {
    const map = mapRef.current;
    if (!map || !filtered.length) return;
    const height = map.getContainer().clientHeight;
    const lngs = filtered.map((l) => l.coords[0]);
    const lats = filtered.map((l) => l.coords[1]);
    map.fitBounds(
      [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      { padding: { top: Math.min(140, height * 0.2), bottom: Math.min(260, height * 0.4), left: window.innerWidth >= 1024 ? 300 : 40, right: 60 }, maxZoom: 16, duration: 1000 },
    );
  }, [filtered]);

  const selected = filtered.find((l) => l.id === selectedId) ?? null;
  const editing = source.find((l) => l.id === editingId) ?? null;
  // the detail panel or the add/edit form is showing
  const panelOpen = (addStage === "idle" && !!selected) || addStage === "form";

  // stable per `listings` so memoised cards don't re-render on every keystroke
  const flyToListing = useCallback((id: string) => {
    const l = source.find((x) => x.id === id);
    if (!l) return;
    setFiltersOpen(false);
    setSelectedId(id);
    const map = mapRef.current;
    if (!map) return;
    // below lg the detail panel is a bottom sheet over the lower ~60% of the
    // map: land the pin in the strip above it instead of dead centre
    const sheet = window.innerWidth < 1024;
    const offsetY = sheet ? -map.getContainer().clientHeight * 0.28 : 0;
    map.flyTo({ center: l.coords, zoom: 16.4, duration: 1600, offset: [0, offsetY] });
  }, [source]);

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

  // Drops any pending/in-flight Nominatim lookup. Called on the next click,
  // on cancel and on unmount so a late response never fills a stale form.
  const stopGeocode = useCallback(() => {
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    geocodeTimer.current = null;
    geocodeAbort.current?.abort();
    geocodeAbort.current = null;
  }, []);
  useEffect(() => stopGeocode, [stopGeocode]);

  // 400ms debounce: rapid re-clicks while placing the pin only hit Nominatim
  // (rate-limited to ~1 req/s) for the spot the user settles on
  const reverseGeocode = useCallback((coords: [number, number]) => {
    stopGeocode();
    setGeocoding(true);
    geocodeTimer.current = setTimeout(async () => {
      geocodeTimer.current = null;
      const controller = new AbortController();
      geocodeAbort.current = controller;
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${coords[1]}&lon=${coords[0]}&format=jsonv2&zoom=18`,
          { signal: controller.signal },
        );
        if (res.ok) {
          const j = (await res.json()) as {
            display_name?: string;
            address?: Record<string, string>;
          };
          if (controller.signal.aborted) return;
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
        // aborted, or leave fields blank — user types the address
      }
      if (!controller.signal.aborted) {
        geocodeAbort.current = null;
        setGeocoding(false);
      }
    }, 400);
  }, [stopGeocode]);

  const handleMapClick = useCallback((coords: [number, number]) => {
    if (addStage === "idle") return;
    setDraftCoords(coords);
    setAddStage("form");
    if (!editingId) {
      setGeoAddress("");
      setGeoCity("");
      reverseGeocode(coords);
    }
  }, [addStage, editingId, reverseGeocode]);

  const cancelAdd = useCallback(() => {
    stopGeocode();
    setGeocoding(false);
    setAddStage("idle");
    setEditingId(null);
    setDraftCoords(null);
  }, [stopGeocode]);

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
        notify(
          `${failedUploads} photo${failedUploads > 1 ? "s" : ""} failed to upload — saving the listing with the rest.`,
          { kind: "error" },
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
        notify(writeErrorMessage("save", res.status, msg ?? null), { kind: "error" });
        return;
      }
      const saved = (await res.json()) as Listing;

      // Featured boost is a paid add-on (₹250). The listing is saved first so
      // the purchase can be tied to its id; on a verified payment the server
      // flips `featured` itself (lib/purchases.ts applyEntitlement), so we only
      // need to re-read the listing. Cancelling leaves a normal, unfeatured
      // listing — nothing is lost. The listing already exists server-side at
      // this point, so a checkout failure must not lose it from the UI either.
      if (!editing && d.featured && !saved.featured) {
        try {
          const paid = await payFee(
            "featured_property",
            "Featured listing boost",
            saved.id,
          );
          if (paid) {
            const fresh = await fetch(`/api/properties/${saved.id}`);
            if (fresh.ok) Object.assign(saved, await fresh.json());
          }
        } catch {
          notify(
            "The listing was saved, but the featured boost payment didn\u2019t go through. You can retry it later.",
            { kind: "error" },
          );
        }
      }

      invalidateListing(saved.id);
      updateListings((prev) =>
        editing
          ? prev.map((l) => (l.id === saved.id ? saved : l))
          : [...prev, saved],
      );
      resetSearch();
      cancelAdd();
      setSelectedId(saved.id);
      mapRef.current?.flyTo({ center: saved.coords, zoom: 16.4, duration: 1600 });
      // new listings, and edits to an approved listing's text/photos/contact,
      // wait for review (the server says so via `status`)
      celebrate(
        saved.status !== "pending"
          ? "Listing updated!"
          : editing
            ? "Listing updated — it\u2019s back in review before it shows on the map."
            : "Listing submitted — it\u2019ll appear on the map once it\u2019s reviewed.",
      );
    } catch {
      // network failure / aborted upload / JSON parse error
      notify("Could not save the listing. Check your connection and try again.", {
        kind: "error",
      });
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
        invalidateListing(id);
        updateListings((prev) => prev.filter((l) => l.id !== id));
        setSelectedId(null);
      } else {
        const msg = await res
          .json()
          .then((j: { error?: string }) => j.error)
          .catch(() => null);
        notify(writeErrorMessage("delete", res.status, msg ?? null), { kind: "error" });
      }
    } catch {
      notify("Could not delete the listing. Check your connection and try again.", {
        kind: "error",
      });
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
    <div className="flex h-full flex-col bg-cream pt-[env(safe-area-inset-top)]">
      <Navbar />

      <main className={`${styles.canvas} relative mx-[max(0.5rem,env(safe-area-inset-left))] mb-[max(0.5rem,env(safe-area-inset-bottom))] min-h-0 flex-1 overflow-hidden rounded-[22px] bg-cream-soft sm:mx-3 sm:mb-[max(0.75rem,env(safe-area-inset-bottom))]`}>
        <Map3D
          listings={deferredFiltered}
          pois={POIS}
          mapRef={mapRef}
          selectedId={selectedId}
          onSelect={flyToListing}
          onMoveEnd={handleMoveEnd}
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
              allListings={histogramListings}
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

          <div className={`${styles.mapControls} ${panelOpen ? styles.mapControlsShifted : ""}`}>
            <MapControls
              is3D={is3D}
              onZoomIn={() => mapRef.current?.zoomIn()}
              onZoomOut={() => mapRef.current?.zoomOut()}
              onToggleDimension={toggleDimension}
            />
          </div>

          <div className={`${styles.results} ${panelOpen ? styles.resultsUnderSheet : ""}`}>
            <div className={styles.resultBar}>
              <div aria-live="polite"><strong>{loadState === "ready" ? `${filtered.length} ${filtered.length === 1 ? "property" : "properties"}` : "Explore properties"}</strong><span>{searchArea && areaFailed ? (areaListings ? "Couldn’t refresh this map area" : "Couldn’t load this map area — showing all") : searchArea && areaTruncated ? "Zoom in to see every listing here" : query ? `Matching “${query}”` : searchArea ? "In this map area" : "Find your next place"}</span></div>
              <div className={styles.resultActions}>
                <label className={styles.areaToggle}>
                  <input type="checkbox" checked={searchArea} onChange={toggleSearchArea} />
                  <span className={styles.areaLong}>Search as I move</span>
                  <span className={styles.areaShort}>Map area</span>
                </label>
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
              listings={deferredFiltered}
              onSelect={flyToListing}
              hasAny={listings.length > 0}
              emptyMessage={
                // nothing in view with no filters set: clearing won't help, moving will
                searchArea && areaListings && !activeFilters && !query.trim()
                  ? "No properties in this map area. Zoom out or move the map to see more."
                  : undefined
              }
              status={loadState}
              selectedId={selectedId}
              onReset={resetSearch}
              onRetry={() => { setLoadState("loading"); setLoadAttempt((n) => n + 1); }}
            />
          </div>

          {/* panels render last so they paint above the carousel strip and
              map controls without needing a z-index scheme */}
          {addStage === "form" && draftCoords && (
            <div className={`${styles.detailPanel} ${styles.formPanel}`}>
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
            <BottomSheet className={styles.detailPanel} onDismiss={() => setSelectedId(null)}>
              <PropertyDetailPanel
                listing={selected}
                onClose={() => setSelectedId(null)}
                onEdit={() => openEdit(selected)}
                onDelete={() => deleteProperty(selected.id)}
                deleting={deleting}
              />
            </BottomSheet>
          )}
        </div>
      </main>
    </div>
  );
}
