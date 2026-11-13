/** Units a plot can be typed in. Everything is stored in metres. */
export type LengthUnit = "m" | "ft";

const M_PER_FT = 0.3048; // exact, by definition

/** Feet per metre, derived from the exact foot rather than a rounded 3.28084. */
export const FT_PER_M = 1 / M_PER_FT;

/** A typed length in metres. */
export function toMeters(value: number, unit: LengthUnit): number {
  return unit === "ft" ? value * M_PER_FT : value;
}

/**
 * A plot side as it is stored: metres, to the millimetre. Rounding to the
 * centimetre turned a 30 × 40 ft plot into 9.14 × 12.19 m, which reads back as
 * 1,199 sq ft instead of 1,200.
 */
export function plotSideMeters(value: number, unit: LengthUnit): number {
  return Math.round(toMeters(value, unit) * 1000) / 1000;
}

/** Square metres as square feet. */
export function sqFt(squareMeters: number): number {
  return squareMeters * FT_PER_M * FT_PER_M;
}
