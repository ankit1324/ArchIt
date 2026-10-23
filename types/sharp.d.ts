// sharp 0.35 ships its typings at lib/index.d.ts, but its package.json
// "exports" map has no "types" condition, so `moduleResolution: bundler`
// can't find them. Declare the bare module here; lib/sharp.ts re-types it.
declare module "sharp";
