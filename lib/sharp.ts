import "server-only";
import sharpUntyped from "sharp";
// type-only, erased at build time: points the checker at the typings the
// package's "exports" map hides (see types/sharp.d.ts)
import type SharpTypes from "../node_modules/sharp/lib/index";

const sharp = sharpUntyped as typeof SharpTypes;
export default sharp;
