"use client";

import { useEffect, useRef, useState } from "react";
// maplibre-gl 6 is ESM-only with no default export
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// same worker setup as components/Map3D.tsx: the bundler doesn't emit
// maplibre's import.meta.url worker, so serve the copy in public/vendor
if (typeof window !== "undefined") {
  maplibregl.setWorkerUrl(
    new URL(`/vendor/maplibre/maplibre-gl-worker-${maplibregl.getVersion()}.mjs`, window.location.origin).href,
  );
}

// same basemap as components/Map3D.tsx
const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";

/** drop the low-zoom shaded relief: invisible at street zoom, slows first paint */
const transformStyle: maplibregl.TransformStyleFunction = (_prev, next) => {
  const sources = { ...next.sources };
  delete sources.ne2_shaded;
  return {
    ...next,
    sources,
    layers: next.layers.filter((l) => !("source" in l) || l.source !== "ne2_shaded"),
  };
};
const DEFAULT_CENTER: [number, number] = [76.7794, 30.741]; // Chandigarh, as Map3D
// a style that has not loaded by then is treated as a failure (retry offered)
const LOAD_TIMEOUT_MS = 15_000;

export interface FlyTarget {
  center: [number, number];
  bbox?: [[number, number], [number, number]];
}

/**
 * Small 2D map for picking a design's spot: a click drops or moves the pin,
 * and the pin can be dragged. `flyTo` moves the camera (a new object each time
 * flies again). Load it with next/dynamic `ssr: false` — maplibre needs the DOM.
 * If the basemap fails to load, it says so and offers a retry; the caller's
 * search and "publish without pin" paths keep working without it.
 */
export default function PinPickerMap({
  value,
  onChange,
  flyTo,
}: {
  value: [number, number] | null;
  onChange: (coords: [number, number]) => void;
  flyTo: FlyTarget | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  // Refreshed after every commit; maplibre callbacks read them at event time.
  useEffect(() => {
    valueRef.current = value;
    onChangeRef.current = onChange;
  });

  const placeMarker = (map: maplibregl.Map, coords: [number, number] | null) => {
    if (!coords) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (markerRef.current) {
      markerRef.current.setLngLat(coords);
      return;
    }
    // planner accent (paper/ink markers would vanish into the positron basemap)
    const marker = new maplibregl.Marker({ color: "#ad4a31", draggable: true })
      .setLngLat(coords)
      .addTo(map);
    marker.on("dragend", () => {
      const p = marker.getLngLat().wrap();
      onChangeRef.current([p.lng, p.lat]);
    });
    markerRef.current = marker;
  };

  // init (and re-init on retry)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fail = (why: unknown) => {
      if (cancelled) return;
      console.warn("[PinPickerMap] basemap failed to load", why);
      setFailed(true);
    };

    const init = () => {
      const start = valueRef.current;
      let map: maplibregl.Map;
      try {
        map = new maplibregl.Map({
          container,
          center: start ?? DEFAULT_CENTER,
          zoom: start ? 15 : 11,
          pitch: 0,
          maxPitch: 0,
          dragRotate: false,
          attributionControl: { compact: true },
        });
      } catch (e) {
        // e.g. WebGL unavailable
        return fail(e);
      }
      // a failed style fetch surfaces as an `error` before `load` (below)
      map.setStyle(STYLE_URL, { transformStyle });
      mapRef.current = map;
      map.touchZoomRotate.disableRotation();
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map.getCanvas().style.cursor = "crosshair";

      let loaded = false;
      timer = setTimeout(() => {
        if (!loaded) fail("timeout");
      }, LOAD_TIMEOUT_MS);
      map.on("load", () => {
        loaded = true;
        clearTimeout(timer);
        // a late load (slow hidden tab, a timeout that fired first) means the
        // map works after all
        if (!cancelled) setFailed(false);
      });
      // errors before load (style/TileJSON fetch) leave the map blank for good;
      // a single failed tile (the event carries `tile`) does not
      map.on("error", (e) => {
        if (!loaded && !(e as { tile?: unknown }).tile) fail(e.error);
      });
      map.on("click", (e) => {
        // wrap: on a world-copy past the antimeridian lng can leave [-180, 180]
        const p = e.lngLat.wrap();
        onChangeRef.current([p.lng, p.lat]);
      });

      placeMarker(map, start);
    };
    init();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      markerRef.current?.remove();
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [attempt]);

  // keep the pin in sync with the value (search results set it too)
  useEffect(() => {
    const map = mapRef.current;
    if (map) placeMarker(map, value);
  }, [value]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyTo) return;
    const [[w, s], [e, n]] = flyTo.bbox ?? [flyTo.center, flyTo.center];
    if (w !== e || s !== n) {
      map.fitBounds(
        [
          [w, s],
          [e, n],
        ],
        { padding: 40, maxZoom: 16, duration: 1200 },
      );
    } else {
      map.flyTo({ center: flyTo.center, zoom: 15, duration: 1200 });
    }
  }, [flyTo]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-md border border-line bg-paper-soft">
      {/* maplibre forces position:relative on its container, so size it with
          h/w-full inside the positioned wrapper (as Map3D does) */}
      <div ref={containerRef} className="h-full w-full" />
      {failed && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-paper/95 p-4 text-center">
          <p className="font-display text-[17px] font-medium tracking-[-0.01em] text-ink">
            The map didn’t load.
          </p>
          <p className="max-w-[34ch] text-[14px] leading-relaxed text-ink-soft">
            Search for a place above to drop the pin there, or publish without a
            map pin.
          </p>
          <button
            type="button"
            onClick={() => {
              setFailed(false);
              setAttempt((a) => a + 1);
            }}
            className="mt-1 min-h-11 rounded-[5px] border border-line-strong bg-paper px-5 py-2.5 text-[13px] font-semibold text-ink transition-colors hover:border-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
