import type { Map as MapLibreMap } from "maplibre-gl";
import type { Design, DesignBlock, Listing } from "./types";

// Builder-local frame: +x = east, +z = SOUTH, meters, origin at plot center.
// Equirectangular approximation is fine at city scale.
const M_PER_DEG_LAT = 111_320;

function mPerDegLng(lat: number): number {
  return M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

export function llToLocal(
  center: [number, number],
  coords: [number, number],
): { x: number; z: number } {
  const [lng0, lat0] = center;
  return {
    x: (coords[0] - lng0) * mPerDegLng(lat0),
    z: -(coords[1] - lat0) * M_PER_DEG_LAT,
  };
}

export function localToLl(
  center: [number, number],
  x: number,
  z: number,
): [number, number] {
  const [lng0, lat0] = center;
  return [lng0 + x / mPerDegLng(lat0), lat0 - z / M_PER_DEG_LAT];
}

export function distanceM(
  a: [number, number],
  b: [number, number],
): number {
  const { x, z } = llToLocal(a, b);
  return Math.hypot(x, z);
}

/** floor slab pitch in the builder (C.H + slab) */
export const FLOOR_H = 2.87;

/** context box sent to the embedded builder; builder-local meters */
export interface NeighborBox {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  color?: string;
}

/** real building footprint as a builder-local polygon */
export interface NeighborPoly {
  poly: [number, number][]; // [x, z] ring, builder-local meters
  h: number;
  color?: string;
}

export type Neighbor = NeighborBox | NeighborPoly;

const NEIGHBOR_COLORS: Record<Listing["type"], string> = {
  rent: "#a06ae8",
  sale: "#ccdb2a",
};
const DESIGN_COLOR = "#ff7a59";
const DESIGN_NEIGHBOR_COLOR = "#7a8699";

function designFloors(d: Design): { blocks: DesignBlock[] }[] {
  // state.blocks is an alias of the active floor pre-serialization; after a
  // JSON round-trip it is a duplicate — floors[] is the source of truth
  return d.design.state.floors ?? [{ blocks: d.design.state.blocks }];
}

/** x/z extents of a block honouring quarter-turn rotation */
function blockExtent(b: DesignBlock): [number, number] {
  return b.rot % 2 ? [b.w, b.len] : [b.len, b.w];
}

export function neighborBoxes(
  listings: Listing[],
  designs: Design[],
  center: [number, number],
  excludeDesignId?: string,
  radius = 150,
): NeighborBox[] {
  const boxes: NeighborBox[] = [];
  for (const l of listings) {
    if (distanceM(center, l.coords) > radius) continue;
    const { x, z } = llToLocal(center, l.coords);
    boxes.push({
      x,
      z,
      w: 46,
      d: 46,
      h: 30 + (l.floors ?? 5) * 3.2,
      color: NEIGHBOR_COLORS[l.type],
    });
  }
  for (const d of designs) {
    if (d.id === excludeDesignId) continue;
    if (distanceM(center, d.plotCenter) > radius) continue;
    const floors = designFloors(d);
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const f of floors) {
      for (const b of f.blocks) {
        const [ex, ez] = blockExtent(b);
        minX = Math.min(minX, b.cx - ex / 2);
        maxX = Math.max(maxX, b.cx + ex / 2);
        minZ = Math.min(minZ, b.cz - ez / 2);
        maxZ = Math.max(maxZ, b.cz + ez / 2);
      }
    }
    if (minX > maxX) continue; // empty design
    const off = llToLocal(center, d.plotCenter);
    boxes.push({
      x: off.x + (minX + maxX) / 2,
      z: off.z + (minZ + maxZ) / 2,
      w: maxX - minX,
      d: maxZ - minZ,
      h: floors.length * FLOOR_H,
      color: DESIGN_NEIGHBOR_COLOR,
    });
  }
  return boxes;
}

/**
 * Real building footprints around the plot, read from the openmaptiles
 * vector tiles already loaded by the map. Returns builder-local polygons.
 * Buildings overlapping the plot itself are skipped so they don't sit on
 * top of the design space.
 */
export function realBuildingNeighbors(
  map: MapLibreMap,
  center: [number, number],
  plotW: number,
  plotD: number,
  radius = 150,
  maxCount = 80,
): NeighborPoly[] {
  let feats: GeoJSON.Feature[] = [];
  try {
    feats = map.querySourceFeatures("openmaptiles", {
      sourceLayer: "building",
    }) as unknown as GeoJSON.Feature[];
  } catch {
    return [];
  }

  const seen = new Set<string>();
  const out: Array<NeighborPoly & { dist: number }> = [];

  for (const f of feats) {
    const g = f.geometry;
    const rings =
      g.type === "Polygon"
        ? [g.coordinates[0]]
        : g.type === "MultiPolygon"
          ? g.coordinates.map((p) => p[0])
          : [];
    for (const ring of rings) {
      if (!ring || ring.length < 4) continue;
      const pts = ring.map((c) =>
        llToLocal(center, [c[0], c[1]] as [number, number]),
      );
      let cx = 0,
        cz = 0;
      for (const p of pts) {
        cx += p.x;
        cz += p.z;
      }
      cx /= pts.length;
      cz /= pts.length;

      // tiles overlap — dedupe by rounded centroid
      const key = `${Math.round(cx)}:${Math.round(cz)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const dist = Math.hypot(cx, cz);
      if (dist > radius) continue;
      // skip anything sitting on the plot
      if (Math.abs(cx) < plotW / 2 + 3 && Math.abs(cz) < plotD / 2 + 3)
        continue;

      const props = (f.properties ?? {}) as Record<string, unknown>;
      const h =
        typeof props.render_height === "number" && props.render_height > 0
          ? Math.min(props.render_height, 60)
          : 6;

      out.push({
        poly: pts.map((p) => [
          +p.x.toFixed(2),
          +p.z.toFixed(2),
        ]) as [number, number][],
        h,
        dist,
      });
    }
  }

  out.sort((a, b) => a.dist - b.dist);
  return out.slice(0, maxCount).map(({ poly, h, color }) => ({ poly, h, color }));
}

/** every room block of every design as a fill-extrusion feature */
export function designBlocksGeoJSON(
  designs: Design[],
): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const d of designs) {
    designFloors(d).forEach((floor, fi) => {
      for (const b of floor.blocks) {
        const [ex, ez] = blockExtent(b);
        const ring = [
          localToLl(d.plotCenter, b.cx - ex / 2, b.cz - ez / 2),
          localToLl(d.plotCenter, b.cx + ex / 2, b.cz - ez / 2),
          localToLl(d.plotCenter, b.cx + ex / 2, b.cz + ez / 2),
          localToLl(d.plotCenter, b.cx - ex / 2, b.cz + ez / 2),
          localToLl(d.plotCenter, b.cx - ex / 2, b.cz - ez / 2),
        ];
        features.push({
          type: "Feature",
          properties: {
            designId: d.id,
            color: DESIGN_COLOR,
            base: fi * FLOOR_H,
            height: (fi + 1) * FLOOR_H,
          },
          geometry: { type: "Polygon", coordinates: [ring] },
        });
      }
    });
  }
  return { type: "FeatureCollection", features };
}
