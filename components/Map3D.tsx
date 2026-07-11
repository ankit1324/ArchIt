"use client";

import { useEffect, useRef, type RefObject } from "react";
import maplibregl from "maplibre-gl";
import type { Listing, Poi } from "@/lib/types";
import { formatPrice } from "@/lib/types";

const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
const CENTER: [number, number] = [76.7794, 30.741];

const PRISM_COLORS: Record<Listing["type"], string> = {
  rent: "#a06ae8",
  sale: "#ccdb2a",
};

const POI_SVGS: Record<Poi["icon"], string> = {
  building:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="6" y="3" width="12" height="18" rx="1"/><path d="M9 7h1M13 7h1M9 11h1M13 11h1M9 15h1M13 15h1M11 21v-3h2v3"/></svg>',
  park: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 21v-5M12 16c-4 0-6-2.5-6-6 0-3 2.5-6 6-6s6 3 6 6c0 3.5-2 6-6 6z"/></svg>',
  coffee:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 9h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V9zM16 10h2a2 2 0 0 1 0 4h-2M7 5.5v1M10.5 5v1.5M14 5.5v1"/></svg>',
  bank: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 9l9-5 9 5H3zM5 9v8M9.5 9v8M14.5 9v8M19 9v8M3 20h18"/></svg>',
  scissors:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M8.2 7.5L20 18M8.2 16.5L20 6"/></svg>',
  compare:
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M8 3L4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4"/></svg>',
};

/** square polygon of `size` meters around a lng/lat point */
function squareAround(coords: [number, number], size: number) {
  const [lng, lat] = coords;
  const dLat = size / 2 / 111_320;
  const dLng = size / 2 / (111_320 * Math.cos((lat * Math.PI) / 180));
  return [
    [
      [lng - dLng, lat - dLat],
      [lng + dLng, lat - dLat],
      [lng + dLng, lat + dLat],
      [lng - dLng, lat + dLat],
      [lng - dLng, lat - dLat],
    ],
  ];
}

function prismGeoJSON(listings: Listing[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: listings.map((l) => ({
      type: "Feature",
      properties: {
        color: PRISM_COLORS[l.type],
        height: 30 + (l.floors ?? 5) * 3.2,
      },
      geometry: { type: "Polygon", coordinates: squareAround(l.coords, 46) },
    })),
  };
}

function priceMarkerEl(l: Listing, withThumb: boolean): HTMLElement {
  const el = document.createElement("div");
  const showThumb = withThumb && !!l.photo;
  el.className = `price-marker${showThumb ? "" : " no-thumb"}`;
  if (showThumb && l.photo) {
    const img = document.createElement("img");
    img.className = "thumb";
    img.src = l.photo;
    img.alt = "";
    el.appendChild(img);
  }
  el.appendChild(document.createTextNode(formatPrice(l)));
  return el;
}

function poiMarkerEl(p: Poi): HTMLElement {
  const el = document.createElement("div");
  el.className = "poi-marker";
  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.innerHTML = POI_SVGS[p.icon];
  el.appendChild(bubble);
  if (p.label) {
    const label = document.createElement("div");
    label.className = "poi-label";
    label.textContent = p.label;
    el.appendChild(label);
  }
  return el;
}

interface Map3DProps {
  listings: Listing[];
  pois: Poi[];
  mapRef: RefObject<maplibregl.Map | null>;
  onSelect?: (id: string) => void;
  onMapClick?: (coords: [number, number]) => void;
  pickMode?: boolean;
  draftCoords?: [number, number] | null;
}

export default function Map3D({
  listings,
  pois,
  mapRef,
  onSelect,
  onMapClick,
  pickMode = false,
  draftCoords = null,
}: Map3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const draftMarkerRef = useRef<maplibregl.Marker | null>(null);
  const loadedRef = useRef(false);
  const listingsRef = useRef(listings);
  listingsRef.current = listings;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;
  const refreshRef = useRef<((m: maplibregl.Map) => void) | null>(null);

  // init once
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;

    const refreshMarkers = (m: maplibregl.Map) => {
      markersRef.current.forEach((mk) => mk.remove());
      markersRef.current = [];

      listingsRef.current.forEach((l, i) => {
        const el = priceMarkerEl(l, i % 3 === 0);
        el.addEventListener("click", () => onSelectRef.current?.(l.id));
        markersRef.current.push(
          new maplibregl.Marker({ element: el, anchor: "bottom", offset: [0, -18] })
            .setLngLat(l.coords)
            .addTo(m),
        );
      });
      pois.forEach((p) => {
        markersRef.current.push(
          new maplibregl.Marker({ element: poiMarkerEl(p), anchor: "center" })
            .setLngLat(p.coords)
            .addTo(m),
        );
      });
    };
    refreshRef.current = refreshMarkers;

    const init = async () => {
      // fetch the style ourselves so we can drop the low-zoom shaded-relief
      // raster source: it is invisible at city zoom but delays first paint
      let style: string | maplibregl.StyleSpecification = STYLE_URL;
      try {
        const res = await fetch(STYLE_URL);
        const json = (await res.json()) as maplibregl.StyleSpecification;
        delete json.sources.ne2_shaded;
        json.layers = json.layers.filter(
          (l) => !("source" in l) || l.source !== "ne2_shaded",
        );
        style = json;
      } catch {
        // fall back to the style URL; maplibre will fetch it itself
      }
      if (cancelled) return;

      const map = new maplibregl.Map({
        container,
        style,
        center: CENTER,
        zoom: 16.6,
        pitch: 63,
        bearing: -32,
        maxPitch: 70,
        attributionControl: { compact: true },
      });
      mapRef.current = map;
      if (process.env.NODE_ENV !== "production") {
        (window as unknown as { __map?: maplibregl.Map }).__map = map;
        map.on("error", (e) => console.error("[Map3D]", e.error));
      }

      // markers are DOM overlays — show them immediately, before tiles arrive
      refreshMarkers(map);

      map.on("click", (e) => {
        onMapClickRef.current?.([e.lngLat.lng, e.lngLat.lat]);
      });

      map.on("load", () => {
        // satellite imagery basemap, inserted below the first symbol layer
        // so place/road labels stay readable on top of it
        const firstSymbolId = map
          .getStyle()
          .layers.find((l) => l.type === "symbol")?.id;
        map.addSource("satellite", {
          type: "raster",
          tiles: [
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
          ],
          tileSize: 256,
          maxzoom: 19,
          attribution: "Imagery &copy; Esri",
        });
        map.addLayer(
          { id: "satellite", type: "raster", source: "satellite" },
          firstSymbolId,
        );

        // translucent listing prisms
        map.addSource("listing-prisms", {
          type: "geojson",
          data: prismGeoJSON(listingsRef.current),
        });
        map.addLayer({
          id: "listing-prisms",
          type: "fill-extrusion",
          source: "listing-prisms",
          paint: {
            "fill-extrusion-color": ["get", "color"],
            "fill-extrusion-height": ["get", "height"],
            "fill-extrusion-opacity": 0.55,
            "fill-extrusion-vertical-gradient": false,
          },
        });

        loadedRef.current = true;

        // cinematic settle, mirroring the video intro
        map.flyTo({
          center: CENTER,
          zoom: 15.35,
          pitch: 58,
          bearing: -17,
          duration: 4200,
          essential: false,
        });
      });
    };
    init();

    return () => {
      cancelled = true;
      markersRef.current.forEach((mk) => mk.remove());
      markersRef.current = [];
      draftMarkerRef.current?.remove();
      draftMarkerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // react to filtered listings
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const src = map.getSource("listing-prisms") as maplibregl.GeoJSONSource | undefined;
    src?.setData(prismGeoJSON(listings));
    refreshRef.current?.(map);
  }, [listings, mapRef]);

  // crosshair while picking a location
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = pickMode ? "crosshair" : "";
  }, [pickMode, mapRef]);

  // draft pin for the property being added
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    draftMarkerRef.current?.remove();
    draftMarkerRef.current = null;
    if (draftCoords) {
      draftMarkerRef.current = new maplibregl.Marker({ color: "#3d1830" })
        .setLngLat(draftCoords)
        .addTo(map);
    }
  }, [draftCoords, mapRef]);

  return (
    <div className="absolute inset-0">
      {/* maplibre's own css forces position:relative on the container, so
          size it with h/w-full inside an absolutely-positioned wrapper */}
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
