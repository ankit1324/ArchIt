#!/usr/bin/env node
/**
 * Source of truth for the ArchIt template library.
 *
 *   node scripts/gen-templates.mjs          # write lib/template-catalog.ts + lib/template-geometry.ts
 *   node scripts/gen-templates.mjs --check  # validate + fail if the emitted files are stale
 *
 * Why a generator: `lib/template-geometry.ts` holds the floor plans customers pay
 * for. A hand-typed coordinate silently deforms a paid plan (a room lands 20 cm
 * into its neighbour, a door opens into a wall) and nothing in the app complains.
 * So plans are authored here as WORLD RECTANGLES with doors placed at WORLD
 * COORDINATES, and this script:
 *
 *   1. converts each rectangle to the engine's (cx, cz, w, len, rot) form —
 *      remember footprint() is [len, w] on X/Z at rot 0 and [w, len] at rot 1/3;
 *   2. converts every door/window from a world side + world position into the
 *      engine's local (wall, t) pair, solving t exactly for the room's rotation;
 *   3. validates the whole library (see checks below) and REFUSES to emit if
 *      anything fails, so a broken plan can never reach a paying customer;
 *   4. emits the v2 payload defined in plans/02-template-v2-contract.md.
 *
 * Validation performed here (also re-checked independently by
 * scripts/check-templates.mjs against the *generated* module):
 *   - room type / paint / floorCol / door type / furniture keys exist in C
 *   - 1.2 m <= w, len <= 8.0 m (C.roomMin / C.roomMax)
 *   - rot is an integer 0-3, every door/window t lands in 0..1
 *   - no two rooms in a template overlap (same AABB test as overlaps())
 *   - every non-open room has at least one door
 *   - `ext_*` doors sit on a wall with no enclosed neighbour (open rooms such as
 *     verandas are allowed on the far side); `int_*` doors sit on a wall shared
 *     with another room, and the whole door leaf fits inside the shared segment
 *   - windows sit on fully exterior walls (designIssues() flags the rest)
 *   - furniture fits inside its room (clampFurn would otherwise move it silently)
 */

import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHECK = process.argv.includes("--check");

/* ===================== mirror of builder.html C (read-only) ===================== */

const ROOMS = {
  bedroom: { w: 3.0, len: 3.6 },
  hall: { w: 3.6, len: 4.8 },
  hallway: { w: 1.4, len: 3.6 },
  kitchen: { w: 2.4, len: 3.0 },
  bath: { w: 1.8, len: 2.4 },
  balcony: { w: 1.5, len: 3.0, open: true },
  veranda: { w: 2.4, len: 3.6, open: true },
  stairs: { w: 1.2, len: 3.0 },
};
const PAINT = ["white", "cream", "beige", "gray", "greige", "mint", "sage", "blush", "terra", "lavender"];
const FLOOR = ["oak", "honey", "walnut", "ash", "wtile", "gtile", "terra", "slate"];
const DOOR_TYPES = [
  "ext_hard", "ext_metal", "ext_plastic", "ext_glass",
  "int_hard", "int_mdf", "int_pvc", "int_panel",
];
const FURN = {
  bed: [1.6, 2.0], wardrobe: [1.8, 0.6], nightstand: [0.45, 0.4], sofa: [2.0, 0.9],
  coffee: [0.9, 0.55], tv: [1.4, 0.4], table: [1.4, 0.8], chair: [0.45, 0.45],
  desk: [1.2, 0.6], fridge: [0.7, 0.7], kunit: [1.8, 0.6], toilet: [0.4, 0.65],
  basin: [0.5, 0.4], shower: [0.9, 0.9], bath: [1.7, 0.75], plant: [0.45, 0.45],
  walllamp: [0.16, 0.16],
};
const ROOM_MIN = 1.2, ROOM_MAX = 8;
const WIN_W = { std: 1.3, pano: 2.2 };

/* ===================== authoring helpers ===================== */

// world side letters -> the engine's world wall index (0=+z, 1=+x, 2=-z, 3=-x)
const SIDE = { N: 0, E: 1, S: 2, W: 3 };

/** a room: world rect [x0,z0,x1,z1] + options */
const R = (type, x0, z0, x1, z1, o = {}) => ({ type, rect: [x0, z0, x1, z1], ...o });
/** a door at world position `at` on world side `side` (at = x for N/S, z for E/W) */
const d = (side, at, type = "int_hard", w = 0.85, h = 2.05) => ({ side, at, type, w, h });
/** a window at world position `at` on world side `side` */
const win = (side, at, kind = "std") => ({ side, at, kind });

const r3 = (n) => Math.round(n * 1000) / 1000;

/** rows of desks with a chair behind each — room-local metres (lx along len, lz along w) */
function desks(nx, nz, { sx = 1.9, sz = 2.2, ox = 0, oz = 0 } = {}) {
  const out = [];
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const lx = r3(ox + (i - (nx - 1) / 2) * sx);
      const lz = r3(oz + (j - (nz - 1) / 2) * sz);
      out.push(["desk", lx, lz, 0], ["chair", lx, r3(lz + 0.78), 2]);
    }
  }
  return out;
}
/** a long meeting table: `n` chairs per long side */
function boardroom(n, { sx = 1.0, oz = 0, ox = 0 } = {}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const lx = r3(ox + (i - (n - 1) / 2) * sx);
    out.push(["table", lx, oz, 0], ["chair", lx, r3(oz - 0.95), 0], ["chair", lx, r3(oz + 0.95), 2]);
  }
  return out;
}
/** rows of seats facing +len (lecture / waiting) */
function seating(nx, nz, { sx = 0.7, sz = 0.95, ox = 0, oz = 0 } = {}) {
  const out = [];
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++)
      out.push(["chair", r3(ox + (i - (nx - 1) / 2) * sx), r3(oz + (j - (nz - 1) / 2) * sz), 2]);
  return out;
}
/** café / dining: `n` two-seat tables in a row */
function cafeTables(n, { sx = 2.0, oz = 0, ox = 0 } = {}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const lx = r3(ox + (i - (n - 1) / 2) * sx);
    out.push(["table", lx, oz, 0], ["chair", r3(lx - 0.95), oz, 1], ["chair", r3(lx + 0.95), oz, 3]);
  }
  return out;
}

/* ===================== catalog metadata (all 31 keys, order preserved) ===================== */

const CATALOG = [
  ["in_1bhk", "1BHK Compact Indian House", "indian", "Veranda, living room, kitchen, bedroom and bath", false],
  ["in_2bhk", "2BHK Indian Family Home", "indian", "Family hall, kitchen, two bedrooms and two baths", false],
  ["in_3bhk", "3BHK Modern Indian Home", "indian", "Living hall, kitchen, three bedrooms, bath and balcony", false],
  ["in_vastu", "Vastu 2BHK Home", "indian", "Living, kitchen and bedrooms arranged in vastu zones", false],
  ["in_villa", "South Indian Courtyard Villa", "indian", "Front and rear verandas with three bedrooms", false],
  ["in_kothi", "North Indian Kothi (4BHK)", "indian", "Foyer, living, kitchen, four bedrooms and balconies", false],
  ["in_row", "Builder Floor / Row House", "indian", "Long home with porch, living, kitchen and two bedrooms", false],
  ["in_village", "1KTH Village House", "indian", "Front veranda, large hall, kitchen and bathroom", false],
  ["in_courtyard", "Traditional Courtyard House", "indian", "Perimeter rooms around a central family hall", false],
  ["in_bungalow", "Luxury 5BHK Indian Villa", "indian", "Grand hall, kitchen, five bedrooms, baths and balconies", false],
  ["off_startup", "Startup Open-Plan Office", "office", "Reception, open desk bays, meeting room, pantry and washroom", true],
  ["off_exec", "Corporate Executive Suite", "office", "Reception, boardroom, executive cabins, pantry and washroom", true],
  ["off_tech", "Tech Agency Agile Hub", "office", "Two agile work bays, huddle room, coffee bar and washroom", true],
  ["off_cowork", "Co-Working Space", "office", "Reception, hot desks, private booths, café and meeting room", true],
  ["off_studio", "Design & Creative Studio", "office", "Gallery entry, drafting bay, client pitch room and library", true],
  ["off_clinic", "Medical / Clinic Suite", "office", "Waiting room, reception, three consultation rooms and washroom", true],
  ["off_law", "Law Firm & Partners Office", "office", "Reception, conference room, library and four partner cabins", true],
  ["off_finance", "Financial & Accounting Firm", "office", "Client lounge, accountant work bay, archive and washroom", true],
  ["off_retail", "Retail Showroom & Back Office", "office", "Showroom, counter, back office, inventory room and washroom", true],
  ["off_bpo", "Call Center / BPO Floor", "office", "Large agent bays, manager cabin, cafeteria and washroom", true],
  ["off_realestate", "Real Estate Sales Suite", "office", "Model foyer, presentation lounge, closing rooms and pantry", true],
  ["off_satellite", "Satellite Hub Workspace", "office", "Coffee lounge, four private offices and shared meeting room", true],
  ["oth_japandi", "Japandi Minimalist Villa", "other", "Open veranda, minimalist living, kitchen and master suite", true],
  ["oth_cabin", "Nordic Timber Cabin", "other", "Deck, great room, kitchenette and compact bath", true],
  ["oth_loft", "Contemporary Open Loft", "other", "Double-height style living, kitchen, bedroom and luxury bath", true],
  ["oth_wellness", "Yoga & Wellness Studio", "other", "Reception lounge, practice hall, changing room and bath", true],
  ["oth_training", "Education & Training Hub", "other", "Lecture hall, seminar rooms, administration office and bath", true],
  ["oth_cafe", "Boutique Cafe & Kitchen", "other", "Dining lounge, coffee bar, kitchen and guest washroom", true],
  ["oth_tiny", "Micro Tiny House", "other", "Living/kitchen room, wet bath and front deck", true],
  ["oth_townhouse", "Multi-Level Townhouse", "other", "Living, kitchen, stairs, bedroom and bath starter layout", true],
  ["empty", "Empty — single hall", "other", "Start from a single blank room", false],
].map(([key, name, cat, desc, paid]) => ({ key, name, cat, desc, paid }));

/* ===================== the 20 paid plans =====================
 * Coordinates are world metres. Entry is normally from the south (-z).
 * Every internal door is placed on a wall the generator verifies is shared with
 * the room it is supposed to connect to, so circulation is machine-checked.
 */

const PLANS = {
  /* ---------------- offices ---------------- */

  off_startup: {
    profile: "office",
    rooms: [
      R("hall", 0, 0, 5.6, 4.8, {
        name: "Reception", paint: "white", floorCol: "gtile",
        doors: [d("S", 4.3, "ext_glass", 1.8, 2.3), d("N", 4.7)],
        wins: [win("S", 1.5, "pano"), win("W", 2.4, "pano")],
        furniture: [["desk", -1.4, -1.0, 0], ["chair", -1.4, -0.1, 2], ["sofa", 1.4, -1.2, 0],
          ["coffee", 1.4, -0.2, 0], ["plant", 2.3, 1.6, 0], ["plant", -2.3, 1.6, 0]],
      }),
      R("hall", 5.6, 0, 9.4, 4.8, {
        name: "Meeting room", paint: "greige", floorCol: "ash",
        doors: [d("N", 7.5)], wins: [win("S", 7.5, "pano")],
        furniture: boardroom(3, { sx: 0.95, oz: -0.2 }).concat([["plant", 1.4, 1.4, 0]]),
      }),
      R("hallway", 0, 4.8, 6.5, 6.2, {
        name: "Corridor", paint: "white", floorCol: "gtile", doors: [d("E", 5.5)],
      }),
      R("hallway", 6.5, 4.8, 13.0, 6.2, {
        name: "Corridor", paint: "white", floorCol: "gtile", doors: [d("W", 5.5)],
      }),
      R("kitchen", 9.4, 2.8, 13.0, 4.8, {
        name: "Pantry", paint: "mint", floorCol: "wtile",
        doors: [d("N", 11.2)], wins: [win("S", 11.2)],
      }),
      R("bath", 11.0, 6.2, 13.0, 8.6, {
        name: "Washroom", paint: "mint", floorCol: "wtile", doors: [d("S", 12.0, "int_pvc", 0.8)],
      }),
      R("hall", 0, 6.2, 7.0, 11.4, {
        name: "Open desk bay", paint: "white", floorCol: "oak",
        doors: [d("S", 3.5, "int_hard", 0.9)],
        wins: [win("N", 3.5, "pano"), win("W", 8.8, "pano")],
        furniture: desks(3, 2, { sx: 2.1, sz: 2.3 }).concat([["plant", 2.9, -2.0, 0]]),
      }),
      R("hall", 7.0, 6.2, 11.0, 11.4, {
        name: "Open desk bay", paint: "white", floorCol: "oak",
        doors: [d("S", 9.0, "int_hard", 0.9)], wins: [win("N", 9.0, "pano")],
        furniture: desks(2, 2, { sx: 1.9, sz: 2.3 }).concat([["plant", -1.5, -2.0, 0]]),
      }),
      R("bedroom", 11.0, 8.6, 13.0, 11.4, {
        name: "Server / store", paint: "gray", floorCol: "slate", doors: [d("W", 10.0)],
      }),
    ],
  },

  off_exec: {
    profile: "office",
    rooms: [
      R("hall", 0, 0, 6.0, 5.0, {
        name: "Reception", paint: "greige", floorCol: "gtile",
        doors: [d("S", 4.4, "ext_glass", 2.0, 2.4), d("N", 5.2)],
        wins: [win("S", 1.4, "pano"), win("W", 2.5, "pano")],
        furniture: [["desk", -1.8, -1.2, 0], ["chair", -1.8, -0.3, 2], ["sofa", 1.6, -1.4, 0],
          ["coffee", 1.6, -0.3, 0], ["plant", 2.5, 1.8, 0]],
      }),
      R("hall", 6.0, 0, 12.0, 5.0, {
        name: "Boardroom", paint: "beige", floorCol: "walnut",
        doors: [d("N", 9.0, "int_panel", 0.9, 2.1)],
        wins: [win("S", 9.0, "pano")],
        furniture: boardroom(5, { sx: 1.05 }).concat([["plant", -2.3, 1.4, 0], ["tv", 2.1, 1.5, 0]]),
      }),
      R("hall", 12.0, 0, 15.0, 5.0, {
        name: "Visitor lounge", paint: "cream", floorCol: "oak",
        doors: [d("N", 13.5)], wins: [win("E", 2.5, "pano")],
        furniture: [["sofa", 0, -1.0, 0], ["coffee", 0, 0.1, 0], ["chair", -1.0, 0.9, 1],
          ["chair", 1.0, 0.9, 3], ["plant", 1.1, -1.8, 0]],
      }),
      R("hallway", 0, 5.0, 7.5, 6.4, {
        name: "Corridor", paint: "white", floorCol: "gtile", doors: [d("E", 5.7)],
      }),
      R("hallway", 7.5, 5.0, 15.0, 6.4, {
        name: "Corridor", paint: "white", floorCol: "gtile", doors: [d("W", 5.7)],
      }),
      R("bedroom", 0, 6.4, 3.8, 10.6, {
        name: "Executive cabin", paint: "beige", floorCol: "walnut",
        doors: [d("S", 1.9, "int_panel")], wins: [win("N", 1.9, "pano"), win("W", 8.5)],
      }),
      R("bedroom", 3.8, 6.4, 7.4, 10.6, {
        name: "Executive cabin", paint: "beige", floorCol: "walnut",
        doors: [d("S", 5.6, "int_panel")], wins: [win("N", 5.6, "pano")],
      }),
      R("bedroom", 7.4, 6.4, 11.0, 10.6, {
        name: "Executive cabin", paint: "beige", floorCol: "walnut",
        doors: [d("S", 9.2, "int_panel")], wins: [win("N", 9.2, "pano")],
      }),
      R("hallway", 11.0, 6.4, 12.4, 10.6, {
        rot: 1, name: "Service corridor", paint: "white", floorCol: "gtile", doors: [d("S", 11.7)],
      }),
      R("kitchen", 12.4, 6.4, 15.0, 8.6, {
        name: "Pantry", paint: "mint", floorCol: "wtile", doors: [d("W", 7.5)], wins: [win("E", 7.5)],
      }),
      R("bath", 12.4, 8.6, 15.0, 10.6, {
        name: "Washroom", paint: "mint", floorCol: "wtile", doors: [d("W", 9.6, "int_pvc", 0.8)],
        wins: [win("N", 13.7)],
      }),
    ],
  },

  off_tech: {
    profile: "office",
    rooms: [
      R("hallway", 6.0, 0, 7.4, 7.0, {
        rot: 1, name: "Entry spine", paint: "white", floorCol: "slate",
        doors: [d("S", 6.7, "ext_glass", 1.1, 2.3)],
      }),
      R("hall", 0, 0, 6.0, 7.0, {
        name: "Agile bay A", paint: "gray", floorCol: "oak",
        doors: [d("E", 3.5, "int_hard", 0.9)],
        wins: [win("W", 3.5, "pano"), win("S", 2.4, "pano")],
        furniture: desks(2, 3, { sx: 2.3, sz: 2.1 }).concat([["plant", -2.4, 2.4, 0]]),
      }),
      R("hall", 7.4, 0, 13.4, 7.0, {
        name: "Agile bay B", paint: "gray", floorCol: "oak",
        doors: [d("W", 3.5, "int_hard", 0.9)],
        wins: [win("E", 3.5, "pano"), win("S", 11.0, "pano")],
        furniture: desks(2, 3, { sx: 2.3, sz: 2.1 }).concat([["plant", 2.4, 2.4, 0]]),
      }),
      R("hall", 0, 7.0, 4.0, 10.4, {
        name: "Huddle room", paint: "sage", floorCol: "ash",
        doors: [d("S", 2.0)], wins: [win("N", 2.0, "pano")],
        furniture: boardroom(3, { sx: 0.9 }),
      }),
      R("kitchen", 4.0, 7.0, 7.6, 10.4, {
        name: "Coffee bar", paint: "terra", floorCol: "terra",
        doors: [d("S", 5.0)], wins: [win("N", 5.8)],
        furniture: [["kunit", 0, -1.2, 0], ["kunit", -1.3, 0, 1], ["fridge", 1.3, -1.0, 0],
          ["table", -0.5, 0.8, 0], ["chair", -0.5, 0.1, 0], ["chair", -0.5, 1.3, 2]],
      }),
      R("bath", 7.6, 7.0, 9.8, 9.4, {
        name: "Washroom", paint: "mint", floorCol: "wtile", doors: [d("S", 8.7, "int_pvc", 0.8)],
        wins: [win("E", 8.2)],
      }),
    ],
  },

  off_cowork: {
    profile: "office",
    rooms: [
      R("hall", 0, 0, 5.0, 4.4, {
        name: "Reception", paint: "white", floorCol: "gtile",
        doors: [d("S", 3.7, "ext_glass", 1.9, 2.3), d("N", 4.2)],
        wins: [win("S", 1.3, "pano"), win("W", 2.2, "pano")],
        furniture: [["desk", -1.1, -0.9, 0], ["chair", -1.1, 0.0, 2], ["sofa", 1.2, -1.1, 0],
          ["plant", 1.9, 1.4, 0]],
      }),
      R("kitchen", 5.0, 0, 9.0, 4.4, {
        name: "Café", paint: "terra", floorCol: "terra",
        doors: [d("N", 6.2)], wins: [win("S", 7.0, "pano")],
        furniture: [["kunit", -0.9, -1.5, 0], ["fridge", 1.4, -1.5, 0]]
          .concat(cafeTables(2, { sx: 1.2, oz: 0.7 })),
      }),
      R("hall", 9.0, 0, 14.6, 4.4, {
        name: "Meeting room", paint: "greige", floorCol: "ash",
        doors: [d("N", 11.5)], wins: [win("E", 2.2, "pano"), win("S", 12.6, "pano")],
        furniture: boardroom(4, { sx: 1.05 }).concat([["tv", -1.9, 1.8, 0]]),
      }),
      R("hallway", 0, 4.4, 7.0, 5.8, {
        name: "Corridor", paint: "white", floorCol: "gtile", doors: [d("E", 5.1)],
      }),
      R("hallway", 7.0, 4.4, 14.6, 5.8, {
        name: "Corridor", paint: "white", floorCol: "gtile", doors: [d("W", 5.1)],
      }),
      R("hall", 0, 5.8, 7.6, 11.6, {
        name: "Hot desks", paint: "white", floorCol: "oak",
        doors: [d("S", 3.5, "int_hard", 0.9)],
        wins: [win("N", 3.8, "pano"), win("W", 8.7, "pano")],
        furniture: desks(3, 2, { sx: 2.2, sz: 2.6 }).concat([["plant", 3.2, -2.3, 0]]),
      }),
      R("bedroom", 7.6, 5.8, 10.0, 8.6, {
        name: "Private booth", paint: "lavender", floorCol: "ash", doors: [d("S", 8.8)],
      }),
      R("bedroom", 10.0, 5.8, 12.4, 8.6, {
        name: "Private booth", paint: "lavender", floorCol: "ash", doors: [d("S", 11.2)],
      }),
      R("bedroom", 12.4, 5.8, 14.6, 8.6, {
        name: "Private booth", paint: "lavender", floorCol: "ash",
        doors: [d("S", 13.5)], wins: [win("E", 7.2)],
      }),
      R("bath", 7.6, 8.6, 9.6, 11.0, {
        name: "Washroom", paint: "mint", floorCol: "wtile", doors: [d("W", 9.8, "int_pvc", 0.8)],
      }),
    ],
  },

  off_studio: {
    profile: "office",
    rooms: [
      R("hall", 0, 0, 8.0, 3.2, {
        name: "Gallery entry", paint: "white", floorCol: "slate",
        doors: [d("S", 4.0, "ext_glass", 2.2, 2.4), d("N", 2.0, "int_hard", 1.0)],
        wins: [win("S", 1.4, "pano"), win("S", 6.6, "pano")],
        furniture: [["plant", -3.2, 0.9, 0], ["plant", 3.2, 0.9, 0], ["sofa", 0, 0.9, 0]],
      }),
      R("hall", 0, 3.2, 7.6, 9.6, {
        name: "Drafting bay", paint: "white", floorCol: "oak",
        doors: [d("S", 2.0, "int_hard", 1.0)],
        wins: [win("W", 6.4, "pano"), win("N", 3.8, "pano")],
        furniture: desks(3, 2, { sx: 2.3, sz: 2.8 }).concat([["plant", 3.2, -2.5, 0]]),
      }),
      R("hall", 8.0, 0, 12.6, 4.6, {
        name: "Client pitch room", paint: "greige", floorCol: "walnut",
        doors: [d("W", 1.6, "int_panel", 0.9)],
        wins: [win("E", 2.3, "pano"), win("S", 10.3, "pano")],
        furniture: boardroom(3, { sx: 1.0 }).concat([["tv", -1.4, 1.9, 0]]),
      }),
      R("bedroom", 7.6, 4.6, 11.0, 8.2, {
        name: "Material library", paint: "sage", floorCol: "walnut",
        doors: [d("W", 6.4)], wins: [win("E", 6.4)],
      }),
      R("bath", 7.6, 8.2, 9.4, 10.6, {
        name: "Washroom", paint: "mint", floorCol: "wtile",
        doors: [d("W", 8.9, "int_pvc", 0.8)], wins: [win("N", 8.5)],
      }),
    ],
  },

  off_clinic: {
    profile: "office",
    rooms: [
      R("hall", 0, 0, 6.4, 4.6, {
        name: "Waiting room", paint: "mint", floorCol: "wtile",
        doors: [d("S", 4.6, "ext_glass", 1.8, 2.3), d("N", 1.6)],
        wins: [win("S", 1.4, "pano"), win("W", 2.3, "pano")],
        furniture: seating(4, 2, { sx: 0.85, sz: 1.5, oz: -0.4 })
          .concat([["plant", 2.6, 1.5, 0], ["coffee", -1.6, 1.5, 0]]),
      }),
      R("hall", 6.4, 0, 9.4, 4.6, {
        name: "Reception & records", paint: "white", floorCol: "wtile",
        doors: [d("W", 3.6)], wins: [win("S", 7.9)],
        furniture: [["desk", -0.7, -1.2, 0], ["chair", -0.7, -0.3, 2], ["wardrobe", 1.0, 0.8, 1]],
      }),
      R("hallway", 0, 4.6, 6.5, 6.0, {
        name: "Corridor", paint: "white", floorCol: "wtile", doors: [d("E", 5.3)],
      }),
      R("hallway", 6.5, 4.6, 11.4, 6.0, {
        name: "Corridor", paint: "white", floorCol: "wtile", doors: [d("W", 5.3)],
      }),
      R("bedroom", 0, 6.0, 3.6, 9.6, {
        name: "Consultation 1", paint: "mint", floorCol: "wtile",
        doors: [d("S", 1.8, "int_mdf")], wins: [win("N", 1.8), win("W", 7.8)],
      }),
      R("bedroom", 3.6, 6.0, 7.2, 9.6, {
        name: "Consultation 2", paint: "mint", floorCol: "wtile",
        doors: [d("S", 5.4, "int_mdf")], wins: [win("N", 5.4)],
      }),
      R("bedroom", 7.2, 6.0, 10.8, 9.6, {
        name: "Consultation 3", paint: "mint", floorCol: "wtile",
        doors: [d("S", 9.0, "int_mdf")], wins: [win("N", 9.0), win("E", 7.8)],
      }),
      R("bath", 9.4, 2.2, 11.4, 4.6, {
        name: "Washroom", paint: "white", floorCol: "wtile",
        doors: [d("N", 10.4, "int_pvc", 0.8)], wins: [win("S", 10.4)],
      }),
    ],
  },

  off_law: {
    profile: "office",
    rooms: [
      R("hall", 0, 0, 5.6, 5.0, {
        name: "Reception", paint: "beige", floorCol: "walnut",
        doors: [d("S", 4.3, "ext_glass", 1.8, 2.3), d("N", 4.6)],
        wins: [win("S", 1.5, "pano"), win("W", 2.5, "pano")],
        furniture: [["desk", -1.5, -1.1, 0], ["chair", -1.5, -0.2, 2], ["sofa", 1.3, -1.3, 0],
          ["coffee", 1.3, -0.2, 0], ["plant", 2.2, 1.6, 0]],
      }),
      R("hall", 5.6, 0, 12.0, 5.0, {
        name: "Conference room", paint: "greige", floorCol: "walnut",
        doors: [d("N", 8.6, "int_panel", 0.9, 2.1)], wins: [win("S", 8.8, "pano")],
        furniture: boardroom(5, { sx: 1.1 }).concat([["plant", -2.6, 1.4, 0]]),
      }),
      R("hall", 12.0, 0, 15.4, 5.0, {
        name: "Law library", paint: "sage", floorCol: "walnut",
        doors: [d("N", 13.7)], wins: [win("E", 2.5)],
        furniture: [["wardrobe", -1.2, -0.8, 1], ["wardrobe", -1.2, 0.8, 1], ["table", 0.5, 0, 0],
          ["chair", 0.5, -0.9, 0], ["chair", 0.5, 0.9, 2]],
      }),
      R("hallway", 0, 5.0, 7.7, 6.4, {
        name: "Corridor", paint: "white", floorCol: "ash", doors: [d("E", 5.7)],
      }),
      R("hallway", 7.7, 5.0, 15.4, 6.4, {
        name: "Corridor", paint: "white", floorCol: "ash", doors: [d("W", 5.7)],
      }),
      R("bedroom", 0, 6.4, 3.4, 10.4, {
        name: "Partner cabin", paint: "beige", floorCol: "walnut",
        doors: [d("S", 1.7, "int_panel")], wins: [win("N", 1.7), win("W", 8.4)],
      }),
      R("bedroom", 3.4, 6.4, 6.8, 10.4, {
        name: "Partner cabin", paint: "beige", floorCol: "walnut",
        doors: [d("S", 5.1, "int_panel")], wins: [win("N", 5.1)],
      }),
      R("bedroom", 6.8, 6.4, 10.2, 10.4, {
        name: "Partner cabin", paint: "beige", floorCol: "walnut",
        doors: [d("S", 8.5, "int_panel")], wins: [win("N", 8.5)],
      }),
      R("bedroom", 10.2, 6.4, 13.6, 10.4, {
        name: "Partner cabin", paint: "beige", floorCol: "walnut",
        doors: [d("S", 11.9, "int_panel")], wins: [win("N", 11.9)],
      }),
      R("bath", 13.6, 6.4, 15.4, 8.8, {
        name: "Washroom", paint: "white", floorCol: "wtile",
        doors: [d("S", 14.5, "int_pvc", 0.8)], wins: [win("E", 7.6)],
      }),
    ],
  },

  off_finance: {
    profile: "office",
    rooms: [
      R("hall", 0, 0, 6.0, 4.8, {
        name: "Client lounge", paint: "cream", floorCol: "oak",
        doors: [d("S", 4.4, "ext_glass", 1.8, 2.3), d("N", 4.9)],
        wins: [win("S", 1.4, "pano"), win("W", 2.4, "pano")],
        furniture: [["sofa", -1.5, -1.3, 0], ["coffee", -1.5, -0.2, 0], ["desk", 1.6, -1.1, 0],
          ["chair", 1.6, -0.2, 2], ["plant", 2.3, 1.6, 0]],
      }),
      R("bedroom", 6.0, 0, 9.6, 4.8, {
        name: "Partner cabin", paint: "beige", floorCol: "walnut",
        doors: [d("N", 7.8, "int_panel")], wins: [win("S", 7.8, "pano")],
      }),
      R("hallway", 0, 4.8, 6.2, 6.2, {
        name: "Corridor", paint: "white", floorCol: "gtile", doors: [d("E", 5.5)],
      }),
      R("hallway", 6.2, 4.8, 11.6, 6.2, {
        name: "Corridor", paint: "white", floorCol: "gtile", doors: [d("W", 5.5)],
      }),
      R("hall", 0, 6.2, 7.4, 11.4, {
        name: "Accounts work bay", paint: "white", floorCol: "gtile",
        doors: [d("S", 3.0, "int_hard", 0.9)],
        wins: [win("N", 3.7, "pano"), win("W", 8.8, "pano")],
        furniture: desks(3, 2, { sx: 2.2, sz: 2.3 }).concat([["plant", 3.0, -2.0, 0]]),
      }),
      R("bedroom", 7.4, 6.2, 9.8, 9.4, {
        name: "Archive", paint: "gray", floorCol: "slate", doors: [d("S", 8.6)],
        furniture: [["wardrobe", -0.7, -0.5, 1], ["wardrobe", -0.7, 0.5, 1], ["wardrobe", 0.7, -0.5, 1]],
      }),
      R("bath", 9.8, 6.2, 11.6, 8.6, {
        name: "Washroom", paint: "mint", floorCol: "wtile",
        doors: [d("S", 10.7, "int_pvc", 0.8)], wins: [win("E", 7.4)],
      }),
      R("kitchen", 9.6, 2.4, 11.6, 4.8, {
        name: "Pantry", paint: "mint", floorCol: "wtile",
        doors: [d("N", 10.6)], wins: [win("S", 10.6)],
      }),
    ],
  },

  off_retail: {
    profile: "office",
    rooms: [
      R("hall", 0, 0, 7.8, 7.6, {
        name: "Showroom", paint: "white", floorCol: "gtile",
        doors: [d("S", 3.9, "ext_glass", 2.4, 2.4)],
        wins: [win("S", 1.2, "pano"), win("S", 6.6, "pano"), win("W", 3.8, "pano")],
        furniture: [["wardrobe", -2.8, -3.0, 0], ["wardrobe", -0.9, -3.0, 0], ["wardrobe", 1.0, -3.0, 0],
          ["table", -2.0, 0.4, 0], ["table", 1.2, 0.4, 0], ["sofa", -2.0, 2.6, 0],
          ["plant", 3.2, 2.8, 0], ["plant", 3.2, -3.0, 0]],
      }),
      R("hall", 7.8, 0, 11.4, 2.4, {
        name: "Sales counter", paint: "greige", floorCol: "gtile",
        doors: [d("W", 1.2, "int_hard", 1.0)], wins: [win("E", 1.2, "pano")],
        furniture: [["desk", -0.9, -0.5, 0], ["chair", -0.9, 0.3, 2], ["desk", 0.7, -0.5, 0]],
      }),
      R("hallway", 7.8, 2.4, 9.4, 8.8, {
        rot: 1, name: "Service corridor", paint: "white", floorCol: "slate",
        doors: [d("W", 7.0, "int_hard", 0.9)],
      }),
      R("bedroom", 9.4, 2.4, 12.6, 5.4, {
        name: "Back office", paint: "gray", floorCol: "ash",
        doors: [d("W", 3.9)], wins: [win("E", 3.9)],
      }),
      R("bedroom", 9.4, 5.4, 12.6, 8.8, {
        name: "Inventory", paint: "gray", floorCol: "slate",
        doors: [d("W", 7.1, "int_hard", 0.9)], wins: [win("E", 7.1)],
        furniture: [["wardrobe", -1.1, -0.6, 1], ["wardrobe", 1.1, -0.6, 1], ["wardrobe", -1.1, 0.6, 1],
          ["wardrobe", 1.1, 0.6, 1]],
      }),
      R("bath", 7.8, 8.8, 9.6, 11.2, {
        name: "Staff washroom", paint: "mint", floorCol: "wtile",
        doors: [d("S", 8.6, "int_pvc", 0.8)], wins: [win("N", 8.7)],
      }),
    ],
  },

  off_bpo: {
    profile: "office",
    rooms: [
      R("hallway", 6.8, 0, 9.2, 2.6, {
        rot: 1, name: "Lobby", paint: "white", floorCol: "slate",
        doors: [d("S", 8.0, "ext_glass", 1.8, 2.3)],
      }),
      R("hall", 0, 0, 6.8, 7.4, {
        name: "Agent bay A", paint: "gray", floorCol: "gtile",
        doors: [d("E", 1.3, "int_hard", 0.9)],
        wins: [win("W", 3.7, "pano"), win("S", 3.4, "pano")],
        furniture: desks(3, 3, { sx: 2.0, sz: 2.2 }),
      }),
      R("hall", 9.2, 0, 16.0, 7.4, {
        name: "Agent bay B", paint: "gray", floorCol: "gtile",
        doors: [d("W", 1.3, "int_hard", 0.9)],
        wins: [win("E", 3.7, "pano"), win("S", 12.6, "pano")],
        furniture: desks(3, 3, { sx: 2.0, sz: 2.2 }),
      }),
      R("hallway", 6.8, 2.6, 9.2, 7.4, {
        rot: 1, name: "Spine", paint: "white", floorCol: "slate", doors: [d("S", 8.0, "int_hard", 1.0)],
      }),
      R("bedroom", 0, 7.4, 3.6, 11.0, {
        name: "Manager cabin", paint: "beige", floorCol: "ash",
        doors: [d("S", 1.8, "int_panel")], wins: [win("N", 1.8), win("W", 9.2)],
      }),
      R("bedroom", 3.6, 7.4, 7.2, 11.0, {
        name: "Training room", paint: "sage", floorCol: "ash",
        doors: [d("S", 5.4)], wins: [win("N", 5.4)],
      }),
      R("kitchen", 7.2, 7.4, 12.0, 11.4, {
        name: "Cafeteria", paint: "terra", floorCol: "terra",
        doors: [d("S", 10.0, "int_hard", 0.9)], wins: [win("N", 9.6, "pano")],
        furniture: [["kunit", -1.3, -1.5, 0], ["fridge", 1.9, -1.5, 0]]
          .concat(cafeTables(2, { sx: 2.1, oz: 0.8 })),
      }),
      R("bath", 12.0, 7.4, 14.2, 9.8, {
        name: "Washroom", paint: "mint", floorCol: "wtile", doors: [d("S", 13.1, "int_pvc", 0.8)],
      }),
      R("bath", 14.2, 7.4, 16.0, 9.8, {
        name: "Washroom", paint: "mint", floorCol: "wtile",
        doors: [d("S", 15.1, "int_pvc", 0.8)], wins: [win("E", 8.6)],
      }),
    ],
  },

  off_realestate: {
    profile: "office",
    rooms: [
      R("hall", 0, 0, 5.0, 4.6, {
        name: "Model foyer", paint: "white", floorCol: "gtile",
        doors: [d("S", 3.6, "ext_glass", 2.0, 2.4), d("N", 2.5), d("E", 2.0, "int_hard", 1.0)],
        wins: [win("S", 1.2, "pano"), win("W", 2.3, "pano")],
        furniture: [["table", -0.9, 0, 0], ["desk", 1.4, -1.2, 0], ["chair", 1.4, -0.4, 2],
          ["plant", 1.9, 1.5, 0]],
      }),
      R("hall", 5.0, 0, 12.0, 4.6, {
        name: "Presentation lounge", paint: "greige", floorCol: "walnut",
        doors: [d("N", 8.0)], wins: [win("S", 8.5, "pano"), win("E", 2.3, "pano")],
        furniture: [["sofa", -2.2, -1.3, 0], ["sofa", 0.2, -1.3, 0], ["coffee", -1.0, -0.2, 0],
          ["tv", -1.0, 1.5, 0]].concat(boardroom(2, { sx: 1.0, ox: 2.0, oz: 0.2 })),
      }),
      R("hallway", 0, 4.6, 6.2, 6.0, {
        name: "Corridor", paint: "white", floorCol: "ash", doors: [d("E", 5.3)],
      }),
      R("hallway", 6.2, 4.6, 12.0, 6.0, {
        name: "Corridor", paint: "white", floorCol: "ash", doors: [d("W", 5.3)],
      }),
      R("bedroom", 0, 6.0, 3.2, 9.6, {
        name: "Closing room", paint: "cream", floorCol: "oak",
        doors: [d("S", 1.6, "int_panel")], wins: [win("N", 1.6), win("W", 7.8)],
      }),
      R("bedroom", 3.2, 6.0, 6.4, 9.6, {
        name: "Closing room", paint: "cream", floorCol: "oak",
        doors: [d("S", 4.8, "int_panel")], wins: [win("N", 4.8)],
      }),
      R("bedroom", 6.4, 6.0, 9.6, 9.6, {
        name: "Closing room", paint: "cream", floorCol: "oak",
        doors: [d("S", 8.0, "int_panel")], wins: [win("N", 8.0)],
      }),
      R("kitchen", 9.6, 6.0, 12.0, 8.2, {
        name: "Pantry", paint: "mint", floorCol: "wtile",
        doors: [d("S", 10.8)], wins: [win("E", 7.1)],
      }),
    ],
  },

  off_satellite: {
    profile: "office",
    rooms: [
      R("hall", 0, 0, 5.4, 4.2, {
        name: "Coffee lounge", paint: "cream", floorCol: "oak",
        doors: [d("S", 4.2, "ext_glass", 1.8, 2.3), d("E", 2.0, "int_hard", 0.9)],
        wins: [win("S", 1.4, "pano"), win("W", 2.1, "pano")],
        furniture: [["sofa", -1.2, -1.1, 0], ["coffee", -1.2, -0.1, 0], ["kunit", 1.4, -1.2, 0],
          ["table", 1.0, 1.0, 0], ["chair", 1.0, 0.3, 0], ["plant", 2.1, 1.3, 0]],
      }),
      R("hallway", 5.4, 0, 6.8, 5.6, {
        rot: 1, name: "Corridor", paint: "white", floorCol: "ash", doors: [d("N", 6.1)],
      }),
      R("hallway", 5.4, 5.6, 6.8, 11.0, {
        rot: 1, name: "Corridor", paint: "white", floorCol: "ash", doors: [d("S", 6.1)],
      }),
      R("bedroom", 6.8, 0, 10.2, 3.2, {
        name: "Private office", paint: "beige", floorCol: "ash",
        doors: [d("W", 1.6, "int_mdf")], wins: [win("E", 1.6), win("S", 8.5)],
      }),
      R("bedroom", 6.8, 3.2, 10.2, 6.4, {
        name: "Private office", paint: "beige", floorCol: "ash",
        doors: [d("W", 4.6, "int_mdf")], wins: [win("E", 4.8)],
      }),
      R("bedroom", 2.0, 4.2, 5.4, 7.6, {
        name: "Private office", paint: "beige", floorCol: "ash",
        doors: [d("E", 6.2, "int_mdf")], wins: [win("W", 5.9)],
      }),
      R("bedroom", 2.0, 7.6, 5.4, 11.0, {
        name: "Private office", paint: "beige", floorCol: "ash",
        doors: [d("E", 9.3, "int_mdf")], wins: [win("W", 9.3), win("N", 3.7)],
      }),
      R("hall", 6.8, 6.4, 10.8, 10.4, {
        name: "Shared meeting room", paint: "greige", floorCol: "walnut",
        doors: [d("W", 7.1, "int_panel", 0.9)], wins: [win("E", 8.4, "pano"), win("N", 8.8, "pano")],
        furniture: boardroom(3, { sx: 1.0 }).concat([["tv", -1.1, 1.5, 0]]),
      }),
      R("bath", 5.4, 11.0, 7.4, 13.4, {
        name: "Washroom", paint: "mint", floorCol: "wtile",
        doors: [d("S", 6.1, "int_pvc", 0.8)], wins: [win("N", 6.4)],
      }),
    ],
  },

  /* ---------------- other / residential ---------------- */

  oth_japandi: {
    profile: "home",
    rooms: [
      R("veranda", 0, 0, 6.0, 2.6, { name: "Engawa veranda", floorCol: "oak" }),
      R("hall", 0, 2.6, 7.4, 8.0, {
        name: "Living", paint: "cream", floorCol: "oak",
        doors: [d("S", 3.0, "ext_glass", 2.2, 2.3)],
        wins: [win("W", 4.0, "pano"), win("W", 6.6, "pano"), win("E", 7.0)],
        furniture: [["sofa", -1.9, -1.2, 0], ["coffee", -1.9, -0.1, 0], ["tv", -1.9, 1.4, 0],
          ["table", 1.9, 0.4, 0], ["chair", 1.2, 0.4, 1], ["chair", 2.6, 0.4, 3],
          ["plant", 3.2, -1.9, 0]],
      }),
      R("kitchen", 7.4, 2.6, 10.4, 6.0, {
        name: "Kitchen", paint: "greige", floorCol: "honey",
        doors: [d("W", 4.0, "int_hard", 0.9)], wins: [win("E", 4.3), win("S", 8.9)],
      }),
      R("bedroom", 0, 8.0, 4.6, 12.0, {
        name: "Master bedroom", paint: "beige", floorCol: "oak",
        doors: [d("S", 2.3, "int_panel")], wins: [win("N", 2.3, "pano"), win("W", 10.0)],
      }),
      R("bath", 4.6, 8.0, 7.0, 10.6, {
        name: "Master bath", paint: "mint", floorCol: "wtile",
        doors: [d("W", 9.3, "int_pvc", 0.8)], wins: [win("E", 9.3)],
        furniture: [["bath", -0.2, 0.6, 0], ["toilet", -0.7, -0.6, 0], ["basin", 0.6, -0.6, 0]],
      }),
    ],
  },

  oth_cabin: {
    profile: "home",
    rooms: [
      R("veranda", 0, 0, 5.4, 2.4, { name: "Deck", floorCol: "walnut" }),
      R("hall", 0, 2.4, 6.6, 8.4, {
        name: "Great room", paint: "white", floorCol: "walnut",
        doors: [d("S", 2.7, "ext_hard", 1.0, 2.1)],
        wins: [win("W", 5.4, "pano"), win("N", 3.3, "pano")],
        furniture: [["sofa", -1.6, -1.6, 0], ["coffee", -1.6, -0.5, 0], ["tv", -1.6, 1.4, 0],
          ["table", 1.7, -0.6, 0], ["chair", 1.0, -0.6, 1], ["chair", 2.4, -0.6, 3],
          ["plant", 2.5, 2.2, 0]],
      }),
      R("kitchen", 6.6, 2.4, 9.2, 5.2, {
        name: "Kitchenette", paint: "greige", floorCol: "honey",
        doors: [d("W", 3.8, "int_hard", 0.9)], wins: [win("E", 3.8), win("S", 7.9)],
      }),
      R("bath", 6.6, 5.2, 8.6, 7.4, {
        name: "Compact bath", paint: "mint", floorCol: "wtile",
        doors: [d("W", 6.3, "int_pvc", 0.8)], wins: [win("E", 6.3)],
      }),
    ],
  },

  oth_loft: {
    profile: "home",
    rooms: [
      R("hall", 0, 0, 7.8, 6.4, {
        name: "Living", paint: "gray", floorCol: "slate",
        doors: [d("S", 3.9, "ext_glass", 2.4, 2.4)],
        wins: [win("S", 1.4, "pano"), win("W", 3.2, "pano"), win("S", 6.4, "pano")],
        furniture: [["sofa", -2.2, -1.9, 0], ["sofa", 0.4, -1.9, 0], ["coffee", -0.9, -0.7, 0],
          ["tv", -0.9, 1.6, 0], ["table", 2.4, 1.6, 0], ["chair", 1.7, 1.6, 1],
          ["chair", 3.1, 1.6, 3], ["plant", 3.2, -2.4, 0]],
      }),
      R("kitchen", 7.8, 0, 11.4, 3.6, {
        name: "Kitchen", paint: "white", floorCol: "slate",
        doors: [d("W", 1.8, "int_hard", 0.9)], wins: [win("E", 1.8, "pano"), win("S", 9.6)],
      }),
      R("balcony", 7.8, 3.6, 11.4, 6.0, { name: "Terrace", floorCol: "slate" }),
      R("bedroom", 0, 6.4, 4.8, 10.4, {
        name: "Bedroom", paint: "greige", floorCol: "walnut",
        doors: [d("S", 2.4, "int_panel")], wins: [win("N", 2.4, "pano"), win("W", 8.4)],
      }),
      R("bath", 4.8, 6.4, 7.8, 9.8, {
        name: "Luxury bath", paint: "mint", floorCol: "wtile",
        doors: [d("W", 8.1, "int_pvc", 0.8)], wins: [win("E", 8.1), win("N", 6.3)],
        furniture: [["bath", 0.4, 0.9, 0], ["shower", -0.9, 0.9, 0], ["toilet", -0.9, -0.9, 0],
          ["basin", 0.6, -1.0, 0]],
      }),
    ],
  },

  oth_wellness: {
    profile: "office",
    rooms: [
      R("hall", 0, 0, 5.6, 4.4, {
        name: "Reception lounge", paint: "sage", floorCol: "oak",
        doors: [d("S", 4.3, "ext_glass", 1.8, 2.3), d("N", 2.0, "int_hard", 0.9), d("E", 1.5, "int_hard", 0.9),
          d("E", 3.7, "int_pvc", 0.8)],
        wins: [win("S", 1.4, "pano"), win("W", 2.2, "pano")],
        furniture: [["sofa", -1.4, -1.2, 0], ["coffee", -1.4, -0.2, 0], ["desk", 1.4, -1.2, 0],
          ["chair", 1.4, -0.3, 2], ["plant", 2.2, 1.4, 0]],
      }),
      R("hall", 0, 4.4, 8.0, 11.4, {
        name: "Practice hall", paint: "white", floorCol: "oak",
        doors: [d("S", 2.0, "int_hard", 0.9), d("E", 6.0, "int_hard", 0.9)],
        wins: [win("N", 4.0, "pano"), win("W", 7.9, "pano"), win("N", 6.6, "pano")],
        furniture: [["plant", -3.4, -3.0, 0], ["plant", 3.4, -3.0, 0], ["plant", -3.4, 3.0, 0],
          ["walllamp", 0, 3.2, 0]],
      }),
      R("bedroom", 5.6, 0, 8.6, 3.0, {
        name: "Changing room", paint: "lavender", floorCol: "wtile",
        doors: [d("W", 1.5, "int_hard", 0.9)], wins: [win("E", 1.5), win("S", 7.1)],
        furniture: [["wardrobe", -0.9, -0.4, 1], ["wardrobe", 0.9, -0.4, 1], ["chair", 0, 0.7, 0]],
      }),
      R("bath", 5.6, 3.0, 7.8, 4.4, {
        name: "Washroom", paint: "mint", floorCol: "wtile",
        doors: [d("W", 3.7, "int_pvc", 0.8)],
        furniture: [["toilet", -0.6, -0.2, 0], ["basin", 0.6, -0.3, 0]],
      }),
      R("bedroom", 8.0, 4.4, 11.2, 7.6, {
        name: "Treatment room", paint: "mint", floorCol: "oak",
        doors: [d("W", 6.0, "int_mdf")], wins: [win("E", 6.0), win("S", 9.6)],
      }),
    ],
  },

  oth_training: {
    profile: "office",
    rooms: [
      R("hall", 0, 0, 5.0, 3.6, {
        name: "Entrance foyer", paint: "white", floorCol: "gtile",
        doors: [d("S", 1.6, "ext_glass", 2.0, 2.4), d("N", 2.5, "int_hard", 0.9),
          d("E", 1.8, "int_hard", 1.0)],
        wins: [win("S", 3.8, "pano")],
        furniture: [["desk", -1.2, -0.8, 0], ["chair", -1.2, 0.0, 2], ["plant", 1.9, 1.1, 0],
          ["sofa", 0.6, -1.1, 0]],
      }),
      R("hall", 5.0, 0, 12.8, 7.0, {
        name: "Lecture hall", paint: "greige", floorCol: "gtile",
        doors: [d("W", 1.8, "int_hard", 1.0)],
        wins: [win("S", 8.8, "pano"), win("E", 3.5, "pano"), win("N", 10.5, "pano")],
        furniture: seating(6, 4, { sx: 0.8, sz: 1.0, oz: 0.6 }).concat([["desk", 0, -2.6, 0],
          ["tv", -2.4, -2.9, 0]]),
      }),
      R("hallway", 0, 3.6, 5.0, 5.0, {
        name: "Corridor", paint: "white", floorCol: "gtile",
        doors: [d("S", 2.5, "int_hard", 0.9), d("E", 4.3, "int_hard", 0.9)],
      }),
      R("hallway", 3.6, 5.0, 5.0, 10.0, {
        rot: 1, name: "Corridor", paint: "white", floorCol: "gtile", doors: [d("S", 4.3, "int_hard", 0.9)],
      }),
      R("bedroom", 0, 5.0, 3.6, 8.4, {
        name: "Seminar room", paint: "sage", floorCol: "ash",
        doors: [d("E", 6.7, "int_mdf")], wins: [win("W", 6.7)],
      }),
      R("bedroom", 0, 8.4, 3.6, 11.8, {
        name: "Seminar room", paint: "sage", floorCol: "ash",
        doors: [d("E", 9.5, "int_mdf")], wins: [win("W", 10.1), win("N", 1.8)],
      }),
      R("bedroom", 5.0, 7.0, 8.4, 9.8, {
        name: "Administration", paint: "beige", floorCol: "ash",
        doors: [d("W", 8.4, "int_mdf")], wins: [win("E", 8.4), win("N", 6.7)],
      }),
      R("bath", 3.6, 10.0, 5.2, 12.4, {
        name: "Washroom", paint: "mint", floorCol: "wtile",
        doors: [d("S", 4.2, "int_pvc", 0.8)], wins: [win("E", 11.2)],
      }),
    ],
  },

  oth_cafe: {
    profile: "home",
    rooms: [
      R("hall", 0, 0, 7.6, 5.6, {
        name: "Dining lounge", paint: "cream", floorCol: "honey",
        doors: [d("S", 3.6, "ext_glass", 2.0, 2.3), d("E", 4.0, "int_hard", 1.0),
          d("N", 2.2, "int_hard", 0.9), d("N", 6.9, "int_pvc", 0.8)],
        wins: [win("S", 1.2, "pano"), win("S", 6.2, "pano"), win("W", 2.8, "pano")],
        furniture: cafeTables(3, { sx: 2.2, oz: -1.3 })
          .concat(cafeTables(3, { sx: 2.2, oz: 1.3 })),
      }),
      R("veranda", 7.6, 0, 11.0, 2.4, { name: "Terrace seating", floorCol: "terra" }),
      R("hall", 7.6, 2.4, 11.0, 5.6, {
        name: "Coffee bar", paint: "terra", floorCol: "terra",
        doors: [d("W", 4.0, "int_hard", 1.0)], wins: [win("E", 4.0, "pano")],
        furniture: [["kunit", 0, -1.1, 0], ["kunit", -1.2, 0, 1], ["fridge", 1.2, 1.0, 0],
          ["chair", -0.2, 0.9, 0], ["chair", 0.8, 0.9, 0]],
      }),
      R("kitchen", 0, 5.6, 4.0, 9.0, {
        name: "Kitchen", paint: "white", floorCol: "wtile",
        doors: [d("S", 2.2, "int_hard", 0.9), d("E", 6.9, "int_hard", 0.9)],
        wins: [win("N", 2.0), win("W", 7.3)],
        furniture: [["kunit", -0.9, -1.1, 0], ["kunit", 0.6, -1.1, 0], ["fridge", 1.5, 1.1, 0],
          ["table", -0.8, 0.9, 0]],
      }),
      R("kitchen", 4.0, 5.6, 6.0, 8.2, {
        name: "Prep & store", paint: "white", floorCol: "wtile",
        doors: [d("W", 6.9, "int_hard", 0.9)], wins: [win("N", 5.0)],
      }),
      R("bath", 6.0, 5.6, 7.8, 8.0, {
        name: "Guest washroom", paint: "mint", floorCol: "wtile",
        doors: [d("S", 6.9, "int_pvc", 0.8)], wins: [win("E", 6.8)],
      }),
    ],
  },

  oth_tiny: {
    profile: "home",
    rooms: [
      R("veranda", 0, 0, 4.0, 1.8, { name: "Front deck", floorCol: "walnut" }),
      R("hall", 0, 1.8, 4.6, 7.0, {
        name: "Living & kitchen", paint: "white", floorCol: "oak",
        doors: [d("S", 2.0, "ext_hard", 0.9, 2.05)],
        wins: [win("W", 4.4, "pano"), win("N", 2.3, "pano")],
        furniture: [["sofa", -1.1, -1.6, 0], ["coffee", -1.1, -0.6, 0], ["kunit", 1.1, -1.7, 0],
          ["fridge", 1.7, -0.6, 0], ["table", 0.4, 1.4, 0], ["chair", -0.3, 1.4, 1],
          ["chair", 1.1, 1.4, 3]],
      }),
      R("bath", 4.6, 1.8, 6.4, 4.0, {
        name: "Wet bath", paint: "mint", floorCol: "wtile",
        doors: [d("W", 2.9, "int_pvc", 0.8)], wins: [win("E", 2.9)],
      }),
      R("stairs", 4.6, 4.0, 6.0, 7.0, {
        rot: 1, name: "Loft stair", paint: "white", floorCol: "walnut",
        doors: [d("W", 5.5, "int_hard", 0.8)],
      }),
    ],
  },

  oth_townhouse: {
    profile: "home",
    rooms: [
      R("hallway", 0, 0, 1.6, 4.6, {
        rot: 1, name: "Entry hall", paint: "white", floorCol: "slate",
        doors: [d("S", 0.8, "ext_hard", 0.9, 2.1)],
      }),
      R("hall", 1.6, 0, 6.8, 5.0, {
        name: "Living", paint: "cream", floorCol: "oak",
        doors: [d("W", 1.6, "int_hard", 0.9), d("N", 3.0, "int_hard", 0.9), d("N", 6.0, "int_pvc", 0.8)],
        wins: [win("S", 4.2, "pano"), win("E", 2.5, "pano")],
        furniture: [["sofa", -1.3, -1.4, 0], ["coffee", -1.3, -0.3, 0], ["tv", -1.3, 1.5, 0],
          ["table", 1.5, 0.2, 0], ["chair", 0.8, 0.2, 1], ["chair", 2.2, 0.2, 3]],
      }),
      R("kitchen", 1.6, 5.0, 5.2, 7.6, {
        name: "Kitchen", paint: "white", floorCol: "wtile",
        doors: [d("S", 3.0, "int_hard", 0.9)], wins: [win("N", 4.4)],
      }),
      R("stairs", 0, 4.6, 1.6, 7.6, {
        rot: 1, name: "Stairs", paint: "white", floorCol: "slate",
        doors: [d("S", 0.8, "int_hard", 0.8)],
      }),
      R("bath", 5.2, 5.0, 7.0, 7.4, {
        name: "Bathroom", paint: "mint", floorCol: "wtile",
        doors: [d("S", 6.0, "int_pvc", 0.8)], wins: [win("E", 6.2)],
      }),
      R("bedroom", 0, 7.6, 3.6, 11.2, {
        name: "Bedroom", paint: "greige", floorCol: "oak",
        doors: [d("S", 0.8, "int_panel")], wins: [win("N", 1.8, "pano"), win("W", 9.4)],
      }),
    ],
  },
};

/* ===================== compile + validate ===================== */

const errors = [];
const err = (key, msg) => errors.push(`${key}: ${msg}`);

/** engine's localToWorld */
function localToWorld(room, x, z) {
  const a = (room.rot * Math.PI) / 2;
  return [
    room.cx + x * Math.cos(a) + z * Math.sin(a),
    room.cz - x * Math.sin(a) + z * Math.cos(a),
  ];
}
const wallLen = (room, wall) => (wall % 2 ? room.w : room.len);
/** engine's wallPoint (local) */
function wallPoint(room, wall, t) {
  const L = wallLen(room, wall), o = (t - 0.5) * L;
  if (wall === 0) return [o, room.w / 2];
  if (wall === 2) return [-o, -room.w / 2];
  if (wall === 1) return [room.len / 2, -o];
  return [-room.len / 2, o];
}
const worldWallPoint = (room, wall, t) => localToWorld(room, ...wallPoint(room, wall, t));

/** rect of a compiled room: world AABB */
function aabb(room) {
  const [fx, fz] = room.rot % 2 ? [room.w, room.len] : [room.len, room.w];
  return { x0: room.cx - fx / 2, x1: room.cx + fx / 2, z0: room.cz - fz / 2, z1: room.cz + fz / 2, fx, fz };
}

function compileRoom(key, i, src) {
  const [x0, z0, x1, z1] = src.rect;
  const rot = src.rot ?? 0;
  const ex = r3(x1 - x0), ez = r3(z1 - z0);
  const room = {
    type: src.type,
    cx: r3((x0 + x1) / 2),
    cz: r3((z0 + z1) / 2),
    rot,
    w: rot % 2 ? ex : ez,
    len: rot % 2 ? ez : ex,
    name: src.name,
    paint: src.paint,
    floorCol: src.floorCol,
  };
  const label = `room ${i} "${src.name ?? src.type}"`;

  if (!ROOMS[src.type]) err(key, `${label}: unknown room type "${src.type}"`);
  if (!Number.isInteger(rot) || rot < 0 || rot > 3) err(key, `${label}: bad rot ${rot}`);
  for (const [n, v] of [["w", room.w], ["len", room.len]])
    if (!(v >= ROOM_MIN && v <= ROOM_MAX)) err(key, `${label}: ${n}=${v} outside ${ROOM_MIN}..${ROOM_MAX}`);
  if (src.paint && !PAINT.includes(src.paint)) err(key, `${label}: unknown paint "${src.paint}"`);
  if (src.floorCol && !FLOOR.includes(src.floorCol)) err(key, `${label}: unknown floorCol "${src.floorCol}"`);

  room.__src = src;
  room.__label = label;
  return room;
}

/** solve the engine's t for a desired world point on a given world side */
function solveT(room, side, at) {
  const worldWall = SIDE[side];
  const local = (worldWall - room.rot + 4) % 4;
  const box = aabb(room);
  const P = side === "N" ? [at, box.z1]
    : side === "S" ? [at, box.z0]
      : side === "E" ? [box.x1, at]
        : [box.x0, at];
  const p0 = worldWallPoint(room, local, 0);
  const p1 = worldWallPoint(room, local, 1);
  const dx = p1[0] - p0[0], dz = p1[1] - p0[1];
  const t = ((P[0] - p0[0]) * dx + (P[1] - p0[1]) * dz) / (dx * dx + dz * dz);
  return { wall: local, t: r3(t), L: wallLen(room, local), P };
}

/** does another room sit across this wall anywhere under an opening of `width`? */
function neighbourAt(rooms, self, side, P, width = 0) {
  const eps = 0.02;
  const along = side === "N" || side === "S" ? 0 : 1;   // openings run along x on N/S
  const samples = width > 0 ? [-0.48, -0.24, 0, 0.24, 0.48].map((f) => f * width) : [0];
  for (const o of rooms) {
    if (o === self) continue;
    const b = aabb(o);
    for (const off of samples) {
      const px = along === 0 ? P[0] + off : P[0];
      const pz = along === 1 ? P[1] + off : P[1];
      if (side === "N" && Math.abs(b.z0 - pz) < eps && px > b.x0 + eps && px < b.x1 - eps) return o;
      if (side === "S" && Math.abs(b.z1 - pz) < eps && px > b.x0 + eps && px < b.x1 - eps) return o;
      if (side === "E" && Math.abs(b.x0 - px) < eps && pz > b.z0 + eps && pz < b.z1 - eps) return o;
      if (side === "W" && Math.abs(b.x1 - px) < eps && pz > b.z0 + eps && pz < b.z1 - eps) return o;
    }
  }
  return null;
}

function compileTemplate(key, plan) {
  const rooms = plan.rooms.map((src, i) => compileRoom(key, i, src));

  // overlap: same test the engine uses in overlaps()
  for (let i = 0; i < rooms.length; i++)
    for (let j = i + 1; j < rooms.length; j++) {
      const a = aabb(rooms[i]), b = aabb(rooms[j]);
      if (Math.abs(rooms[i].cx - rooms[j].cx) < (a.fx + b.fx) / 2 - 0.05 &&
        Math.abs(rooms[i].cz - rooms[j].cz) < (a.fz + b.fz) / 2 - 0.05)
        err(key, `${rooms[i].__label} overlaps ${rooms[j].__label}`);
    }

  const out = [];
  for (const room of rooms) {
    const src = room.__src;
    const spec = ROOMS[src.type] ?? {};
    const doors = [], wins = [];
    // openings claimed per world side, to catch a window cutting through a door
    const claimed = { N: [], E: [], S: [], W: [] };
    const claim = (side, at, width, what) => {
      for (const c of claimed[side])
        if (Math.abs(c.at - at) < (c.width + width) / 2 + 0.08)
          err(key, `${room.__label}: ${what} on ${side} at ${at} collides with ${c.what} at ${c.at}`);
      claimed[side].push({ at, width, what });
    };

    for (const door of src.doors ?? []) {
      const type = door.type;
      if (!DOOR_TYPES.includes(type)) { err(key, `${room.__label}: unknown door type "${type}"`); continue; }
      const { wall, t, L, P } = solveT(room, door.side, door.at);
      if (!(t > 0 && t < 1)) { err(key, `${room.__label}: door on ${door.side} at ${door.at} → t=${t}`); continue; }
      const half = door.w / 2;
      if (t * L - half < 0.08 || t * L + half > L - 0.08)
        err(key, `${room.__label}: ${door.w} m door on ${door.side} does not fit in ${r3(L)} m wall (t=${t})`);
      claim(door.side, door.at, door.w, `door`);
      const nb = neighbourAt(rooms, room, door.side, P, door.w);
      if (type.startsWith("ext_")) {
        if (nb && !ROOMS[nb.type].open)
          err(key, `${room.__label}: exterior door on ${door.side} opens into ${nb.__label}`);
      } else {
        if (!nb) err(key, `${room.__label}: interior door on ${door.side} at ${door.at} opens into nothing`);
        else {
          // the whole leaf must sit inside the shared segment
          const b = aabb(nb);
          const lo = door.side === "N" || door.side === "S" ? b.x0 : b.z0;
          const hi = door.side === "N" || door.side === "S" ? b.x1 : b.z1;
          if (door.at - half < lo + 0.05 || door.at + half > hi - 0.05)
            err(key, `${room.__label}: door leaf on ${door.side} at ${door.at} runs past the shared wall with ${nb.__label}`);
        }
      }
      doors.push([wall, t, type, door.w, door.h]);
    }

    for (const w of src.wins ?? []) {
      const kind = w.kind ?? "std";
      if (!WIN_W[kind]) { err(key, `${room.__label}: unknown window kind "${kind}"`); continue; }
      const { wall, t, L, P } = solveT(room, w.side, w.at);
      if (!(t > 0 && t < 1)) { err(key, `${room.__label}: window on ${w.side} at ${w.at} → t=${t}`); continue; }
      const half = WIN_W[kind] / 2;
      if (t * L - half < 0.06 || t * L + half > L - 0.06)
        err(key, `${room.__label}: ${kind} window (${WIN_W[kind]} m) does not fit in ${r3(L)} m wall (t=${t})`);
      claim(w.side, w.at, WIN_W[kind], `${kind} window`);
      const nb = neighbourAt(rooms, room, w.side, P, WIN_W[kind]);
      if (nb) err(key, `${room.__label}: window on ${w.side} at ${w.at} faces ${nb.__label} (shared wall)`);
      wins.push(kind === "std" ? [wall, t] : [wall, t, kind]);
    }

    if (!spec.open && doors.length === 0) err(key, `${room.__label}: no door`);

    const furniture = [];
    for (const f of src.furniture ?? []) {
      const [fkey, lx, lz, frot = 0] = f;
      if (!FURN[fkey]) { err(key, `${room.__label}: unknown furniture "${fkey}"`); continue; }
      const [fw, fd] = frot % 2 ? [FURN[fkey][1], FURN[fkey][0]] : FURN[fkey];
      const mx = room.len / 2 - 0.14 - fw / 2, mz = room.w / 2 - 0.14 - fd / 2;
      if (mx < 0 || mz < 0 || Math.abs(lx) > mx + 1e-6 || Math.abs(lz) > mz + 1e-6)
        err(key, `${room.__label}: furniture ${fkey} at (${lx},${lz}) falls outside the room (limits ±${r3(mx)}, ±${r3(mz)})`);
      furniture.push(frot ? [fkey, lx, lz, frot] : [fkey, lx, lz]);
    }

    const spec2 = { type: room.type, cx: room.cx, cz: room.cz };
    if (room.rot) spec2.rot = room.rot;
    spec2.w = room.w;
    spec2.len = room.len;
    if (room.name) spec2.name = room.name;
    if (room.paint) spec2.paint = room.paint;
    if (room.floorCol) spec2.floorCol = room.floorCol;
    if (doors.length) spec2.doors = doors;
    if (wins.length) spec2.wins = wins;
    if (furniture.length) spec2.furniture = furniture;
    out.push(spec2);
  }

  return { v: 2, profile: plan.profile, rooms: out };
}

/* ===================== emit ===================== */

const paidKeys = CATALOG.filter((t) => t.paid).map((t) => t.key);
const planKeys = Object.keys(PLANS);
for (const k of paidKeys) if (!planKeys.includes(k)) err(k, "paid template has no plan");
for (const k of planKeys) if (!paidKeys.includes(k)) err(k, "plan for a key that is not paid");

const compiled = {};
for (const k of paidKeys) if (PLANS[k]) compiled[k] = compileTemplate(k, PLANS[k]);

if (errors.length) {
  console.error(`gen-templates: ${errors.length} problem(s) — nothing written\n`);
  for (const e of errors) console.error("  " + e);
  process.exit(1);
}

/** JSON with number/string tuples kept on one line */
function fmt(value, indent = 0) {
  const pad = " ".repeat(indent);
  if (Array.isArray(value)) {
    const flat = value.every((v) => typeof v === "number" || typeof v === "string");
    if (flat) return JSON.stringify(value);
    return "[\n" + value.map((v) => pad + "  " + fmt(v, indent + 2)).join(",\n") + "\n" + pad + "]";
  }
  if (value && typeof value === "object") {
    const keys = Object.keys(value);
    if (!keys.length) return "{}";
    return "{\n" + keys.map((k) => `${pad}  ${JSON.stringify(k)}: ${fmt(value[k], indent + 2)}`).join(",\n") +
      "\n" + pad + "}";
  }
  return JSON.stringify(value);
}

const GEN_NOTE = `// GENERATED by scripts/gen-templates.mjs — do not hand-edit.
// Re-run: node scripts/gen-templates.mjs   (verify: node scripts/gen-templates.mjs --check)`;

const catalogTs = `${GEN_NOTE}
// Metadata only: safe to serve to anyone. Geometry for paid templates lives in
// lib/template-geometry.ts (server-only) and is never bundled or served unpaid.

export type TemplateCategory = "indian" | "office" | "other";

export interface TemplateCatalogEntry {
  key: string;
  name: string;
  cat: TemplateCategory;
  desc: string;
  /** paid templates: geometry withheld until a template_unlock purchase exists */
  paid: boolean;
}

export const TEMPLATE_CATALOG: TemplateCatalogEntry[] = ${fmt(CATALOG)};

export const TEMPLATE_KEYS = new Set(TEMPLATE_CATALOG.map((t) => t.key));

export function isPaidTemplate(key: string): boolean {
  return TEMPLATE_CATALOG.some((t) => t.key === key && t.paid);
}
`;

const geometryTs = `import "server-only";

${GEN_NOTE}
// Geometry for the 20 PAID templates. This module must never be imported from a
// client component: it is the thing customers pay for. Free templates keep their
// geometry inline in builder.html.
//
// Payload shape: plans/02-template-v2-contract.md. Every template below is v2.
// The v1 tuple form is still part of the exported type so a not-yet-migrated
// template could be served unchanged, and so the reader contract stays honest.

/** v1 room: [roomType, centerX, centerZ, opts] where opts has only doors/wins. */
export type LegacyRoomSpec = [string, number, number, Record<string, unknown>?];

/** \`[wall, t, type?, width?, height?]\` — wall 0=+z 1=+x 2=-z 3=-x, t in 0..1 */
export type DoorTuple = [number, number, string?, number?, number?];
/** \`[wall, t, kind?]\` — kind "std" (default) | "pano" (floor-to-ceiling) */
export type WindowTuple = [number, number, ("std" | "pano")?];
/** \`[key, lx, lz, rot?]\` — room-local metres; lx along len, lz along w */
export type FurnitureTuple = [string, number, number, number?];

/** v2 room. Presence of \`furniture\` REPLACES auto-furnish for that room. */
export interface RoomSpecV2 {
  /** key in C.rooms */
  type: string;
  /** metres, world X of the room centre */
  cx: number;
  /** metres, world Z of the room centre */
  cz: number;
  /** quarter turns, int 0-3 (default 0) */
  rot?: number;
  /** metres (default C.rooms[type].w) — extent across the room */
  w?: number;
  /** metres (default C.rooms[type].len) — extent along the room */
  len?: number;
  name?: string;
  /** key in C.paint */
  paint?: string;
  /** key in C.floorCol */
  floorCol?: string;
  doors?: DoorTuple[];
  wins?: WindowTuple[];
  furniture?: FurnitureTuple[];
}

export type RoomSpec = LegacyRoomSpec | RoomSpecV2;

export type TemplateProfile = "home" | "office";

/** legacy payload: no \`v\` (or v:1) and v1 tuple rooms */
export interface TemplateGeometryV1 {
  v?: 1;
  profile: TemplateProfile;
  rooms: LegacyRoomSpec[];
}

/** v2 payload — see plans/02-template-v2-contract.md §1 */
export interface TemplateGeometryV2 {
  v: 2;
  profile: TemplateProfile;
  rooms: RoomSpecV2[];
}

export type TemplateGeometry = TemplateGeometryV1 | TemplateGeometryV2;

const PAID_TEMPLATE_GEOMETRY: Record<string, TemplateGeometry> = ${fmt(compiled)};

export function getTemplateGeometry(key: string): TemplateGeometry | null {
  return Object.hasOwn(PAID_TEMPLATE_GEOMETRY, key)
    ? PAID_TEMPLATE_GEOMETRY[key]
    : null;
}
`;

const targets = [
  [join(ROOT, "lib", "template-catalog.ts"), catalogTs],
  [join(ROOT, "lib", "template-geometry.ts"), geometryTs],
];

if (CHECK) {
  let stale = 0;
  for (const [path, content] of targets) {
    const cur = existsSync(path) ? readFileSync(path, "utf8") : "";
    if (cur !== content) { stale++; console.error(`stale: ${path}`); }
  }
  if (stale) { console.error("run: node scripts/gen-templates.mjs"); process.exit(1); }
  console.log(`gen-templates --check: ${paidKeys.length} paid templates OK, generated files up to date`);
} else {
  for (const [path, content] of targets) writeFileSync(path, content);
  const roomTotal = Object.values(compiled).reduce((n, t) => n + t.rooms.length, 0);
  console.log(`gen-templates: wrote lib/template-catalog.ts (${CATALOG.length} entries) and ` +
    `lib/template-geometry.ts (${paidKeys.length} paid templates, ${roomTotal} rooms)`);
}
