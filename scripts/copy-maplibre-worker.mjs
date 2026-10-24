#!/usr/bin/env node
/**
 * Serves maplibre-gl's worker from public/. maplibre-gl 6 is ESM-only and
 * locates its worker with `new URL(..., import.meta.url)`, which the Next.js
 * bundler does not emit, so the default worker URL 404s (as HTML) and the map
 * never renders tiles. components/Map3D.tsx points setWorkerUrl() at the copy
 * made here. The file name carries the installed version so a dependency bump
 * can never pair a new main bundle with a cached old worker.
 *
 * Generated output (gitignored); `npm run dev` and `npm run build` run this.
 */
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "vendor", "maplibre");
const pkgDir = join(ROOT, "node_modules", "maplibre-gl");
const { version } = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));

mkdirSync(OUT, { recursive: true });
// drop workers from previous versions
for (const f of readdirSync(OUT)) rmSync(join(OUT, f));
copyFileSync(join(pkgDir, "dist", "maplibre-gl-worker.mjs"), join(OUT, `maplibre-gl-worker-${version}.mjs`));
console.log(`maplibre-gl worker ${version} → public/vendor/maplibre/`);
