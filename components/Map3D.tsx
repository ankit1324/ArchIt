"use client";

import { useEffect, useRef, type RefObject } from "react";
// maplibre-gl 6 is ESM-only with no default export
import * as maplibregl from "maplibre-gl";
import type { StyleSpecification } from "maplibre-gl";
// maplibre's own css first so the overrides in map.css win the cascade. Both
// ride this lazy (ssr:false) chunk, so only /find pays for them.
import "maplibre-gl/dist/maplibre-gl.css";
import "./map.css";
import type { Listing, Poi } from "@/lib/types";
import { formatPrice } from "@/lib/types";
import { safeImageUrl, sizedImageUrl } from "@/lib/url";

// maplibre-gl 6 finds its worker via import.meta.url, which the Next.js bundler
// doesn't emit; serve the copy scripts/copy-maplibre-worker.mjs puts in public/.
// Absolute URL: this chunk only loads in the browser (ssr: false).
if (typeof window !== "undefined") {
  maplibregl.setWorkerUrl(
    new URL(`/vendor/maplibre/maplibre-gl-worker-${maplibregl.getVersion()}.mjs`, window.location.origin).href,
  );
}

const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
const CENTER: [number, number] = [76.7794, 30.741];

const SATELLITE_SOURCE: maplibregl.RasterSourceSpecification = {
  type: "raster",
  tiles: [
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  ],
  tileSize: 256,
  maxzoom: 19,
  attribution: "Imagery &copy; Esri",
};

/**
 * The satellite raster is opaque, so every fill/line layer of the vector
 * style underneath it would be fetched, tessellated and drawn for nothing.
 * Keep only `background` (so there is never a transparent canvas before
 * imagery arrives) and the symbol layers (place/road labels), slot the
 * imagery directly above `background`, and drop the low-zoom shaded-relief
 * source that is invisible at city zoom but delays first paint.
 */
const transformStyle: maplibregl.TransformStyleFunction = (_prev, next) => {
  const sources: StyleSpecification["sources"] = { ...next.sources, satellite: SATELLITE_SOURCE };
  delete sources.ne2_shaded;
  const layers: maplibregl.LayerSpecification[] = [];
  for (const layer of next.layers) {
    if (layer.id === "background") {
      layers.push(layer, { id: "satellite", type: "raster", source: "satellite" });
    } else if (layer.type === "symbol") {
      layers.push(layer);
    }
  }
  // a style without a `background` layer still needs the imagery
  if (!layers.some((l) => l.id === "satellite")) {
    layers.unshift({ id: "satellite", type: "raster", source: "satellite" });
  }
  return { ...next, sources, layers };
};

/** small stable hash so a listing's thumbnail choice survives re-sorting */
function hashOf(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

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
        // Featured listings get a glowing amber prism; regular by sale/rent
        color: l.featured ? "#f59e0b" : PRISM_COLORS[l.type],
        height: 30 + (l.floors ?? 5) * 3.2,
      },
      geometry: { type: "Polygon", coordinates: squareAround(l.coords, 46) },
    })),
  };
}

// ── Listing markers ─────────────────────────────────────────────────────────
// Markers are a clustered GeoJSON source drawn by symbol layers on the GPU, not
// DOM overlays maplibre has to project() and restyle every frame. Each pill is
// painted once into a canvas the first time a feature needs it (maplibre's
// `styleimagemissing`), keyed by everything it shows, so a changed price or
// selection simply asks for a new key.

// Contrast (WCAG AA, 12.5px bold text needs 4.5:1): white on #c8322a is 5.3:1,
// plum (#3d1830) on the featured amber is 7.1:1 at #f59e0b and 4.8:1 at the
// #d97706 end of its gradient. The old white-on-amber pill was 2.15:1.
const PIN = {
  fill: "#c8322a",
  text: "#ffffff",
  featuredFrom: "#f59e0b",
  featuredTo: "#d97706",
  featuredText: "#3d1830",
  featuredRing: "rgba(251, 191, 36, 0.6)",
  selectedRing: "#e2ef6a",
  plum: "#3d1830",
  cream: "#f5f1ea",
};
const PIN_H = 30;
const PIN_MARGIN = 7; // room for the shadow / rings around the pill
const THUMB = 20;
const PIN_FONT_SIZE = 12.5;

const LISTING_SOURCE = "listings";
const LAYER_CLUSTERS = "listing-clusters";
const LAYER_PINS = "listing-pins";
const LAYER_POIS = "pois";

/**
 * whether a listing's pill carries a photo bubble (stable across re-sorts).
 * Only when a small version exists: decoding a multi-MB original for a 20px
 * bubble is exactly the cost the stored thumbnails remove.
 */
function hasPinThumb(l: Listing): boolean {
  const sized = sizedImageUrl(l.photo, 64);
  return !!sized && sized !== safeImageUrl(l.photo) && (!!l.featured || hashOf(l.id) % 3 === 0);
}

/** image key for a listing pill: changes whenever what it draws changes */
function pinKey(l: Listing, selected: boolean): string {
  const sig = `${formatPrice(l)}|${l.featured ? 1 : 0}|${hasPinThumb(l) ? l.photo : ""}`;
  return `pin|${l.id}|${hashOf(sig).toString(36)}|${selected ? 1 : 0}`;
}

function listingGeoJSON(listings: Listing[], selectedId: string | null): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: listings.map((l) => ({
      type: "Feature",
      properties: {
        id: l.id,
        icon: pinKey(l, l.id === selectedId),
        // later-sorted symbols draw on top: selected > featured > the rest
        rank: l.id === selectedId ? 2 : l.featured ? 1 : 0,
      },
      geometry: { type: "Point", coordinates: l.coords },
    })),
  };
}

let fontFamily = "";
function pinFont(size: number): string {
  fontFamily ||= getComputedStyle(document.body).fontFamily || "sans-serif";
  return `700 ${size}px ${fontFamily}`;
}

function pixelRatio(): number {
  return Math.min(2, Math.max(1, window.devicePixelRatio || 1));
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

type ThumbSource = HTMLImageElement | ImageBitmap;

/** px between a pin's bottom edge and its listing point (see drawPin) */
const PIN_LIFT = 12;

/** Paint one listing pill. `thumb` is null until its 64px photo has loaded. */
function drawPin(l: Listing, selected: boolean, thumb: ThumbSource | null): ImageData {
  const pr = pixelRatio();
  const scale = selected ? 1.12 : 1;
  const label = `${l.featured ? "\u2605 " : ""}${formatPrice(l)}`;
  const withThumb = hasPinThumb(l);

  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = pinFont(PIN_FONT_SIZE);
  const textW = Math.ceil(measure.measureText(label).width);
  const padL = withThumb ? 5 + THUMB + 6 : 12;
  const pillW = padL + textW + 12;
  const w = Math.ceil((pillW + PIN_MARGIN * 2) * scale);
  const h = Math.ceil((PIN_H + PIN_MARGIN * 2) * scale);

  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(w * pr);
  // PIN_LIFT of transparent space under the pill lifts it off its prism (the
  // layer anchors icons at the bottom). This used to be icon-offset, but
  // maplibre 6 stops perspective-scaling icons that carry an offset, which
  // drew distant pins too large in the tilted view.
  canvas.height = Math.ceil((h + PIN_LIFT) * pr);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(pr * scale, pr * scale);
  const x = PIN_MARGIN;
  const y = PIN_MARGIN;
  const r = PIN_H / 2;

  // soft drop shadow under the pill
  ctx.save();
  ctx.shadowColor = l.featured ? "rgba(217, 119, 6, 0.5)" : "rgba(120, 30, 25, 0.4)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  roundRect(ctx, x, y, pillW, PIN_H, r);
  if (l.featured) {
    const g = ctx.createLinearGradient(x, y, x + pillW, y + PIN_H);
    g.addColorStop(0, PIN.featuredFrom);
    g.addColorStop(1, PIN.featuredTo);
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = PIN.fill;
  }
  ctx.fill();
  ctx.restore();

  if (l.featured || selected) {
    roundRect(ctx, x - 1.5, y - 1.5, pillW + 3, PIN_H + 3, r + 1.5);
    ctx.lineWidth = selected ? 3 : 2;
    ctx.strokeStyle = selected ? PIN.selectedRing : PIN.featuredRing;
    ctx.stroke();
  }

  if (withThumb) {
    const cx = x + 5 + THUMB / 2;
    const cy = y + PIN_H / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, THUMB / 2, 0, Math.PI * 2);
    ctx.clip();
    if (thumb) {
      // object-fit: cover
      const sw = "naturalWidth" in thumb ? thumb.naturalWidth : thumb.width;
      const sh = "naturalHeight" in thumb ? thumb.naturalHeight : thumb.height;
      const side = Math.min(sw, sh);
      ctx.drawImage(thumb, (sw - side) / 2, (sh - side) / 2, side, side, cx - THUMB / 2, cy - THUMB / 2, THUMB, THUMB);
    } else {
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
      ctx.fillRect(cx - THUMB / 2, cy - THUMB / 2, THUMB, THUMB);
    }
    ctx.restore();
    ctx.beginPath();
    ctx.arc(cx, cy, THUMB / 2, 0, Math.PI * 2);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
    ctx.stroke();
  }

  ctx.font = pinFont(PIN_FONT_SIZE);
  ctx.textBaseline = "middle";
  ctx.fillStyle = l.featured ? PIN.featuredText : PIN.text;
  ctx.fillText(label, x + padL, y + PIN_H / 2 + 0.5);

  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/** cluster bubble with its (abbreviated) count */
function drawCluster(label: string): ImageData {
  const pr = pixelRatio();
  const d = label.length <= 1 ? 34 : label.length <= 3 ? 40 : 48;
  const size = d + 12;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = Math.ceil(size * pr);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(pr, pr);
  const c = size / 2;
  ctx.save();
  ctx.shadowColor = "rgba(61, 24, 48, 0.35)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  ctx.beginPath();
  ctx.arc(c, c, d / 2, 0, Math.PI * 2);
  ctx.fillStyle = PIN.plum;
  ctx.fill();
  ctx.restore();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(245, 241, 234, 0.85)";
  ctx.stroke();
  ctx.font = pinFont(13);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = PIN.cream;
  ctx.fillText(label, c, c + 0.5);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

/** POI bubble (icon tile + white label), rasterised once per POI */
async function drawPoi(p: Poi): Promise<ImageData> {
  const pr = pixelRatio();
  // an <img>-loaded svg needs its namespace
  const svg = (POI_SVGS[p.icon] ?? "")
    .replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ')
    .replace(/currentColor/g, PIN.plum);
  const icon = new Image();
  icon.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await icon.decode().catch(() => {});

  const font = `600 11px ${pinFont(11).split("px ")[1]}`;
  const measure = document.createElement("canvas").getContext("2d")!;
  measure.font = font;
  const labelW = p.label ? Math.min(110, Math.ceil(measure.measureText(p.label).width)) + 8 : 0;
  const w = 4 + 34 + labelW + 4;
  const h = 34 + 10;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(w * pr);
  canvas.height = Math.ceil(h * pr);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(pr, pr);
  ctx.save();
  ctx.shadowColor = "rgba(61, 24, 48, 0.18)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 3;
  roundRect(ctx, 4, 4, 34, 34, 12);
  ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
  ctx.fill();
  ctx.restore();
  if (icon.complete && icon.naturalWidth) ctx.drawImage(icon, 4 + 9, 4 + 9, 16, 16);
  if (p.label) {
    ctx.font = font;
    ctx.textBaseline = "middle";
    ctx.shadowColor = "rgba(61, 24, 48, 0.7)";
    ctx.shadowBlur = 6;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(p.label, 4 + 34 + 7, 4 + 17, 110);
  }
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function poiGeoJSON(pois: Poi[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: pois.map((p) => ({
      type: "Feature",
      properties: { icon: `poi|${p.id}` },
      geometry: { type: "Point", coordinates: p.coords },
    })),
  };
}

/** Minimal style used when the OpenFreeMap style itself can't be fetched. */
const FALLBACK_STYLE: StyleSpecification = {
  version: 8,
  sources: { satellite: SATELLITE_SOURCE },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#efe9df" } },
    { id: "satellite", type: "raster", source: "satellite" },
  ],
};

interface Map3DProps {
  listings: Listing[];
  pois: Poi[];
  mapRef: RefObject<maplibregl.Map | null>;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onMapClick?: (coords: [number, number]) => void;
  /** fired after every pan/zoom settles, with the visible [w, s, e, n] */
  onMoveEnd?: (bbox: [number, number, number, number]) => void;
  pickMode?: boolean;
  draftCoords?: [number, number] | null;
}

export default function Map3D({
  listings,
  pois,
  mapRef,
  selectedId = null,
  onSelect,
  onMapClick,
  onMoveEnd,
  pickMode = false,
  draftCoords = null,
}: Map3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const draftMarkerRef = useRef<maplibregl.Marker | null>(null);
  // pill images added so far, so ones no feature uses any more can be dropped
  const pinImagesRef = useRef<Set<string>>(new Set());
  const listingsRef = useRef(listings);
  const selectedIdRef = useRef(selectedId);
  const onSelectRef = useRef(onSelect);
  const onMapClickRef = useRef(onMapClick);
  const onMoveEndRef = useRef(onMoveEnd);

  // Refreshed after every commit, not during render. The init effect below runs
  // once and reads these from maplibre callbacks, which always fire post-commit.
  useEffect(() => {
    listingsRef.current = listings;
    selectedIdRef.current = selectedId;
    onSelectRef.current = onSelect;
    onMapClickRef.current = onMapClick;
    onMoveEndRef.current = onMoveEnd;
  });

  // init once
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const map = new maplibregl.Map({
      container,
      center: CENTER,
      zoom: 16.6,
      pitch: 63,
      bearing: -32,
      maxPitch: 70,
      // maplibre 6 overscales by 4 zoom levels by default, which re-places
      // some basemap labels; keep v5's label placement
      zoomLevelsToOverscale: undefined,
      attributionControl: { compact: true },
    });
    // `transformStyle` is a setStyle option (not a MapOptions one in this
    // maplibre version), so the style is attached right after construction
    map.setStyle(STYLE_URL, { transformStyle });
    mapRef.current = map;
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as { __map?: maplibregl.Map }).__map = map;
    }

    // If the OpenFreeMap style document itself fails, nothing would ever load
    // (no `style.load`, so no markers either). Fall back to bare imagery so
    // listings still show; labels are the only loss.
    let fellBack = false;
    map.on("error", (e) => {
      if (process.env.NODE_ENV !== "production") console.error("[Map3D]", e.error);
      const url = (e.error as { url?: string } | undefined)?.url;
      if (!fellBack && url === STYLE_URL && !map.isStyleLoaded()) {
        fellBack = true;
        map.setStyle(FALLBACK_STYLE, { diff: false });
      }
    });

    // 64px photos for pill bubbles, shared by the selected/unselected variants.
    // Loaded as <img crossorigin> (img-src) rather than map.loadImage's fetch
    // (connect-src); both photo hosts send CORS headers, so the canvas the
    // photo is drawn into stays readable.
    const thumbs = new Map<string, Promise<ThumbSource | null>>();
    const loadThumb = (url: string) => {
      let p = thumbs.get(url);
      if (!p) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.decoding = "async";
        img.src = url;
        p = img.decode().then(() => img, () => null);
        thumbs.set(url, p);
      }
      return p;
    };

    // Paint marker images on demand: only features actually on screen ask.
    // (maplibre 6: images are supplied through the resolver; the
    // `styleimagemissing` event is notify-only and can no longer provide one.)
    map.setMissingStyleImageResolver((id) => {
      if (map.hasImage(id)) return;
      if (id.startsWith("cluster|")) {
        map.addImage(id, drawCluster(id.slice(8)), { pixelRatio: pixelRatio() });
        return;
      }
      if (!id.startsWith("pin|")) return;
      const [, listingId, , sel] = id.split("|");
      const l = listingsRef.current.find((x) => x.id === listingId);
      if (!l) return;
      const selected = sel === "1";
      map.addImage(id, drawPin(l, selected, null), { pixelRatio: pixelRatio() });
      pinImagesRef.current.add(id);
      const url = hasPinThumb(l) ? sizedImageUrl(l.photo, 64) : null;
      if (url) {
        void loadThumb(url).then((img) => {
          if (!img || !map.hasImage(id)) return;
          try {
            map.updateImage(id, drawPin(l, selected, img));
          } catch {
            // canvas tainted (photo host without CORS): keep the placeholder
          }
        });
      }
    });

    const markerLayers = () =>
      [LAYER_PINS, LAYER_CLUSTERS].filter((id) => map.getLayer(id));

    map.on("click", (e) => {
      // while placing a new property every click places the pin: a click that
      // lands on an existing pill must not select (and fly to) that listing
      const picking = !!map.getCanvas().dataset.pick;
      const hit = !picking && markerLayers().length
        ? map.queryRenderedFeatures(e.point, { layers: markerLayers() })[0]
        : undefined;
      if (hit?.layer.id === LAYER_CLUSTERS) {
        const src = map.getSource(LISTING_SOURCE) as maplibregl.GeoJSONSource;
        void src.getClusterExpansionZoom(hit.properties.cluster_id as number).then((zoom) => {
          map.easeTo({
            center: (hit.geometry as GeoJSON.Point).coordinates as [number, number],
            zoom: zoom + 0.3,
            duration: 700,
          });
        });
        return;
      }
      if (hit?.layer.id === LAYER_PINS) {
        onSelectRef.current?.(hit.properties.id as string);
        return;
      }
      onMapClickRef.current?.([e.lngLat.lng, e.lngLat.lat]);
    });
    for (const layer of [LAYER_PINS, LAYER_CLUSTERS]) {
      map.on("mouseenter", layer, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", layer, () => {
        map.getCanvas().style.cursor = map.getCanvas().dataset.pick ? "crosshair" : "";
      });
    }

    map.on("moveend", () => {
      const b = map.getBounds();
      onMoveEndRef.current?.([b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]);
    });

    // (Re)attach our sources and layers whenever a style finishes loading —
    // the first one, or the fallback after a failed style fetch.
    map.on("style.load", () => {
      if (map.getSource(LISTING_SOURCE)) return;
      const current = listingsRef.current;
      map.addSource("listing-prisms", { type: "geojson", data: prismGeoJSON(current) });
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

      map.addSource("pois", { type: "geojson", data: poiGeoJSON(pois) });
      map.addLayer({
        id: LAYER_POIS,
        type: "symbol",
        source: "pois",
        // neighbourhood landmarks; zoomed out they only crowd the clusters
        minzoom: 13.5,
        layout: {
          "icon-image": ["get", "icon"],
          "icon-anchor": "left",
          "icon-allow-overlap": true,
          "icon-ignore-placement": true,
        },
      });
      // POI art is static; draw it once the label font is ready
      void document.fonts.ready.then(() =>
        Promise.all(
          pois.map(async (p) => {
            const img = await drawPoi(p);
            if (!map.hasImage(`poi|${p.id}`)) map.addImage(`poi|${p.id}`, img, { pixelRatio: pixelRatio() });
          }),
        ),
      );

      map.addSource(LISTING_SOURCE, {
        type: "geojson",
        data: listingGeoJSON(current, selectedIdRef.current),
        cluster: true,
        clusterRadius: 48,
        // past this zoom every listing shows as its own pill
        clusterMaxZoom: 14,
      });
      map.addLayer({
        id: LAYER_CLUSTERS,
        type: "symbol",
        source: LISTING_SOURCE,
        filter: ["has", "point_count"],
        layout: {
          "icon-image": ["concat", "cluster|", ["get", "point_count_abbreviated"]],
          "icon-allow-overlap": true,
        },
      });
      map.addLayer({
        id: LAYER_PINS,
        type: "symbol",
        source: LISTING_SOURCE,
        filter: ["!", ["has", "point_count"]],
        layout: {
          "icon-image": ["get", "icon"],
          "icon-anchor": "bottom",
          "icon-allow-overlap": true,
          "symbol-sort-key": ["coalesce", ["get", "rank"], 0],
        },
      });
    });

    map.on("load", () => {
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

    return () => {
      draftMarkerRef.current?.remove();
      draftMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // react to filtered listings / selection
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource(LISTING_SOURCE) as maplibregl.GeoJSONSource | undefined;
    if (!src) return;
    const data = listingGeoJSON(listings, selectedId);
    src.setData(data);
    // evict pills for old selections / edited prices so canvases don't pile up
    const live = new Set(data.features.map((f) => f.properties!.icon as string));
    for (const id of pinImagesRef.current) {
      if (live.has(id)) continue;
      if (map.hasImage(id)) map.removeImage(id);
      pinImagesRef.current.delete(id);
    }
  }, [listings, selectedId, mapRef]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    (map.getSource("listing-prisms") as maplibregl.GeoJSONSource | undefined)?.setData(
      prismGeoJSON(listings),
    );
  }, [listings, mapRef]);

  // crosshair while picking a location
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const canvas = map.getCanvas();
    canvas.style.cursor = pickMode ? "crosshair" : "";
    if (pickMode) canvas.dataset.pick = "1";
    else delete canvas.dataset.pick;
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
