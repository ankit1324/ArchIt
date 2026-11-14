/**
 * The instruction sent with the builder's 3D picture. The picture fixes the
 * shape; this text says what it is made of, where it stands and how it is lit,
 * and — most of all — what the model must leave alone.
 *
 * Keys mirror builder/src/catalog.js. tests/ai-render.test.mjs fails when the
 * builder gains a choice that has no words here.
 */

export const FACADE_COLOURS: Record<string, string> = {
  white: "clean white",
  ivory: "warm ivory",
  sand: "soft sand beige",
  clay: "muted clay pink",
  terracotta: "terracotta orange",
  brickred: "deep brick red",
  darkbrick: "dark brown",
  sage: "pale sage green",
  olive: "olive green",
  sky: "pale sky blue",
  steel: "steel blue-grey",
  graphite: "graphite grey",
  charcoal: "dark charcoal",
  black: "matte black",
};

export const FACADE_MATERIALS: Record<string, string> = {
  paint: "smooth painted plaster",
  wood: "vertical wood slat cladding",
  brick: "exposed brickwork",
  concrete: "exposed board-formed concrete",
  fluted_wood: "fluted timber cladding",
  stone_cladding: "natural stone cladding",
  metal_panel: "standing-seam metal panels",
  stucco_matte: "matte textured stucco",
};

export const ROOF_STYLES: Record<string, string> = {
  flat: "flat roof with a slim edge",
  overhang: "flat roof with deep overhanging eaves",
  parapet: "flat roof behind a parapet wall",
  gable: "low-pitched gable roof",
  gabled: "gable roof with skylights",
  monoslope: "single-slope mono-pitch roof",
  butterfly: "butterfly roof",
  cantilever_flat: "flat roof with a bold cantilevered edge",
  green_roof: "planted green roof",
};

export const ROOF_COLOURS: Record<string, string> = {
  light: "light grey",
  zinc: "zinc grey",
  slate: "slate grey",
  graphite: "graphite",
  charcoal: "charcoal",
  black: "black",
  clay: "clay-tile red",
  copper: "weathered copper brown",
};

const TIMES = {
  day: "bright, clear morning daylight with soft natural shadows",
  evening: "warm golden-hour light just before sunset, with a few interior lights glowing",
} as const;

const STOREYS = ["single-storey", "two-storey", "three-storey"] as const;
const COMPASS = { N: "north", E: "east", S: "south", W: "west" } as const;

export type RenderTime = keyof typeof TIMES;
export type RenderFacing = keyof typeof COMPASS;

export interface RenderStyle {
  facade: string;
  facadeMat: string;
  roofStyle: string;
  roofCol: string;
}

export interface RenderBrief {
  style: RenderStyle;
  floors: number;
  facing?: RenderFacing;
  place?: string;
  time: RenderTime;
}

/**
 * A place label is the one free-text field that reaches the prompt. Keep
 * letters, digits, spaces and the punctuation a place name really uses, so it
 * can name a locality but cannot open a quote, start a new line or add an
 * instruction of its own.
 */
export function sanitizePlace(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/[^\p{L}\p{N} ,.'\-/()]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
    .trim();
}

export function buildRenderPrompt(brief: RenderBrief): string {
  const { style, time } = brief;
  const floors = Math.min(3, Math.max(1, Math.round(brief.floors) || 1));
  const place = sanitizePlace(brief.place);
  const setting = place
    ? `The house stands in ${place}, India. Give it the street, plants, ground and sky that belong to that place`
    : "The house stands on an Indian residential street. Give it the street, plants, ground and sky typical of one";
  const facing = brief.facing ? ` The front of the plot faces ${COMPASS[brief.facing]}.` : "";

  return [
    "Turn the attached 3D model view of a house into a photorealistic exterior photograph of the finished home.",
    "",
    `Keep the design exactly as modelled: the building's shape and proportions, its ${STOREYS[floors - 1]} height, the roof form, and the position, size and number of every window, door, balcony, railing, porch and column. Keep the same camera angle and framing. Do not add or remove storeys, windows or doors, and do not restyle the architecture.`,
    "",
    "Finish it as a real, newly built home:",
    `- Walls: ${FACADE_COLOURS[style.facade]} ${FACADE_MATERIALS[style.facadeMat]}.`,
    `- Roof: ${ROOF_STYLES[style.roofStyle]} in ${ROOF_COLOURS[style.roofCol]}.`,
    "- Windows and doors: real glass with natural reflections, slim frames, believable depth and shadow.",
    "",
    `${setting}: neighbouring homes of a similar height kept soft and secondary, local trees and planting, a paved approach to the entrance.${facing}`,
    "",
    `Light: ${TIMES[time]}.`,
    "",
    "Style: professional architectural photography, natural colour, realistic materials and shadows. No people, no vehicles blocking the house, no text, no labels, no logos.",
  ].join("\n");
}
