#!/usr/bin/env node
/**
 * Bundles the 3D house builder (builder/src/*.js, entry main.js) with three.js
 * vendored in, into public/builder/js/. public/builder/builder.html loads
 * js/builder.js as its only script, so the /builder CSP needs no inline or CDN
 * script sources. The output is generated (gitignored): `npm run build` and
 * `npm run dev` run this first.
 *
 *   node scripts/build-builder.mjs           one-off production build (minified)
 *   node scripts/build-builder.mjs --watch   rebuild on change, unminified
 */
import { build, context } from "esbuild";
import { rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public", "builder", "js");
const watch = process.argv.includes("--watch");

const options = {
  entryPoints: { builder: join(ROOT, "builder", "src", "main.js") },
  outdir: OUT,
  bundle: true,
  format: "esm",
  // the dormant GLB loader (loadModel) is a dynamic import: keep it out of the
  // main bundle as a lazily fetched chunk
  splitting: true,
  chunkNames: "chunks/[name]-[hash]",
  target: ["es2020"],
  minify: !watch,
  sourcemap: true,
  legalComments: "linked",
  logLevel: "info",
};

rmSync(OUT, { recursive: true, force: true });
if (watch) {
  const ctx = await context(options);
  await ctx.watch();
} else {
  await build(options);
}
