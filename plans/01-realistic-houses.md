# Plan 01 — Realistic houses in the ArchIt builder

**Goal:** move the builder from "stacked grey boxes" to believable houses.
**Target file:** `public/builder/builder.html` (3344 lines, 169 KB, self-contained)
**Server side:** `lib/template-geometry.ts` (20 paid), `lib/template-catalog.ts`, `app/api/templates/[key]/route.ts`

---

## Phase 0 — Discovery findings (COMPLETE — read before any phase)

Three read-only audits established the following. **These are verified facts, not assumptions.**
Every later phase cites them. Do not re-derive; do not contradict without re-reading the file.

### 0.1 Runtime — verified against the actual bundle

`builder.html:436-444` importmap pins **three r160 exactly**:
```
"three": "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js"
"three/addons/": "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/"
```
Only `OrbitControls` is imported. The r160 bundle was downloaded and grepped (`REVISION = '160'`).

**Confirmed available in r160:** `MeshPhysicalMaterial`, `MeshStandardMaterial`, `PMREMGenerator`
(`fromScene(scene, sigma=0, near=0.1, far=100)`), `ACESFilmicToneMapping`, `AgXToneMapping`,
`InstancedMesh`, `BatchedMesh`, `ExtrudeGeometry`, `Shape`, `Path`, `ShapeGeometry`, `TextureLoader`,
`LightProbe`, `PCFSoftShadowMap`/`VSMShadowMap`.
**Addon, confirmed reachable:** `three/addons/environments/RoomEnvironment.js` → `class RoomEnvironment extends Scene`.
**Unverified — treat as gaps:** `examples/jsm/csm/CSM.js`, `LightProbeGenerator`, `RGBELoader`, `GLTFLoader`.

### 0.2 Current render state — `builder.html:746-786`

```js
new THREE.WebGLRenderer({canvas, antialias:true, preserveDrawingBuffer:true});
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
```
- **No `toneMapping` set anywhere** → `NoToneMapping`.
- **No `outputColorSpace` set** → r160 default `SRGBColorSpace` (already correct).
- Lighting is **exactly two lights**: `HemisphereLight(#ffffff,#d8deea,1.15)` + `DirectionalLight(#ffffff,1.6)`.
- **No `scene.environment`, no envMap, no PMREM, no IBL** — zero hits.
- **Zero `TextureLoader`.** Only two `.map` assignments exist in the entire file:
  `:1008` (procedural canvas facade) and `:805` (compass sprite).
  No normalMap / roughnessMap / aoMap / metalnessMap anywhere.
- Every material is `MeshStandardMaterial` with flat colour + scalar roughness.

### 0.3 Geometry model — the five structural reasons it looks fake

| # | Fact | Evidence |
|---|---|---|
| 1 | **Walls are solid boxes. Openings are never cut.** Doors/windows are separate meshes placed *in front of* an unbroken wall. You cannot see through a doorway in 3D. No CSG library exists (`CSG\|Brush\|clipping\|BufferGeometryUtils` → zero hits). | `:1013-1027` walls, `:1202-1259` door/window meshes |
| 2 | **Roofs are per-room, not per-building.** Every block gets its own roof. A 6-room house renders 6 separate roofs. | `:1044-1164`, `rebuild3D` `:1297` |
| 3 | **No ceilings.** Only a floor slab (`:1170-1173`). Ground floor of a 2-storey looks up into nothing. | grep `ceiling` → 0 |
| 4 | **Adjacent rooms produce two coincident 9 cm walls**, never a shared party wall. `wt = 0.09` is hardcoded, identical for interior and exterior (real exterior ≈ 0.23 m). `sharedWall()` exists but only affects door *type* and a warning — never the mesh. | `:996`, `:711-735` |
| 5 | **Everything is an axis-aligned rectangle.** `rot` is quarter-turns only; collision is AABB; 2D is `<rect>`. No L-shapes, no angles, no curves. The only polygon extrusion in the file is for *neighbour context buildings* (`:826-843`) — unavailable to user blocks. | `:618-622`, `:697-735` |

### 0.4 The template data model is the reason templates feel same-y

`tRoom(profile, type, cx, cz, opts)` — **the entire body is 8 lines** (`:3016-3023`):
```js
const b = newRoom(type, cx, cz, 0);          // rot HARDCODED 0
(opts.doors||[]).forEach(...)                 // w:0.8 h:2.0 HARDCODED
(opts.wins ||[]).forEach(...)
furnishRoom(b, profile); state.blocks.push(b);
```
`opts` supports **exactly two keys: `doors` and `wins`.** Therefore a template **cannot** express:
room size (always the catalog default), rotation (always 0), wall paint, floor colour, per-room
facade, furniture choice/placement, window size or `pano` kind, door width/height, or partitions.

> **Every bedroom in every one of the 31 templates is exactly 3.0 × 3.6 m at rotation 0.**
> Templates can only vary *which* rooms and *where*. That is the genericness, at the data layer.

**Bug found:** several templates pass strings — `:3073` `{doors:[['0','0.85','ext_hard']]}`. `wallPoint`
uses strict `wall===0` (`:640-643`), so `'0'` silently takes the wrong branch.

### 0.5 Furniture — quantified

`C.furniture` (`:534-552`) has **17 items / 49 primitives → mean 2.9 boxes each** (median 2).
**Every primitive is an axis-aligned `BoxGeometry`.** Zero cylinders, spheres, lathes, bevels.
`nightstand` is one box. `plant` is a pot cube + a foliage cube.
Density per room (`furnishRoom` `:3035-3062`): hall 9, bedroom 4, kitchen 3, bath 3, veranda 4,
hallway 2, balcony 2, **stairs 0**. `bath` (bathtub) is never auto-placed. No rugs, curtains, art,
shelving, lighting beyond one `walllamp`. **No furniture-vs-furniture collision check** — items interpenetrate.

### 0.6 Absent entirely

Ceilings · skirting/cornice/architrave · window cutouts · real 4-sided window frames (frame is one
box *behind* the glass) · openable doors (all 8 door types render identically) · landscaping ·
boundary wall · gate · vehicles · scale figures · terrain relief · any image texture · IBL.
Stairs exist but are **7 steps at 0.343 m rise** (realistic ≈ 0.17) and do not reach the next floor.
Neighbours are flat grey extrusions with no roofs or windows (`:827-842`).

### 0.7 Hard constraints that bound every phase

- **CSP blocks external textures.** `next.config.ts:50` `img-src` = `'self' data: blob:` + unsplash,
  supabase, tiles, clerk, razorpay. **`cdn.jsdelivr.net` is in `script-src` and `connect-src` but NOT
  `img-src`.** Any HDRI/texture/model fetched from jsDelivr **will be blocked**. Options: keep
  procedural (`data:`/`blob:` are allowed), self-host under `/builder/assets/` (`'self'`), or amend CSP.
- **`rebuild3D()` tears down and rebuilds every mesh on every edit** (`:1289-1361`), disposing and
  reallocating all geometry/materials. Detail added per room multiplies per-edit cost linearly.
  Existing escape hatches: `render2D()` during drags, and mutating the live `wallMats[]` array (`:2613`).
- **`shoot3D()` (`:2684-2698`) shares the main renderer/canvas/camera** and depends on
  `preserveDrawingBuffer:true` (`:746`) and `wallMats[]` being live. Any post-processing or async
  env-map compile that lands after the frame will be **missing from saved thumbnails** unless `shoot3D` is updated.
- Max 3 floors (`:2641`). `C.H = 2.75` wall height (realistic). Room dims are metric-plausible.

---

## Phasing rationale

Ordered by **visual-realism per unit of risk**. Phases 1–3 deliver most of the perceived gain and are
independent of the data model. Phase 4 is the unlock for "templates feel different from each other".

| Phase | Delivers | Risk |
|---|---|---|
| 1 Lighting & material response | The single biggest visual jump; no geometry change | Low |
| 2 Wall openings, ceilings, real thickness | Stops it reading as a doll's house | Medium |
| 3 Unified building roof | Stops it reading as stacked boxes | Medium |
| 4 Template schema v2 | Templates can finally differ | Medium (data migration) |
| 5 Re-author templates on v2 | Realistic, varied plans | Low, high effort |
| 6 Furniture fidelity & placement | Interior believability | Low |
| 7 Site context | Exterior believability | Low |
| 8 Verification | Proof | — |

---

## Phase 1 — Lighting and material response

**Why first:** the scene is `NoToneMapping`, two lights, no environment, flat colours. Even perfect
geometry renders flat under this. Cheapest large win, and it touches no geometry.

**Implement — copy the documented r160 patterns:**
1. Add `import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';` to the module
   imports at `:444`. Confirmed reachable at that exact addon path (§0.1).
2. After renderer creation (`:746-748`), build an IBL:
   ```js
   const pmrem = new THREE.PMREMGenerator(renderer);
   scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
   ```
   Signature `fromScene(scene, sigma, near, far)` verified in the r160 bundle.
3. Set `renderer.toneMapping = THREE.ACESFilmicToneMapping;` and tune
   `renderer.toneMappingExposure` (start 1.0). Both verified present.
4. Re-balance the two existing lights (`:760-768`) downward once IBL contributes — currently
   hemisphere 1.15 + sun 1.6 with no environment.
5. Give materials something to reflect: raise `metalness`/lower `roughness` selectively on glass
   (`:1206`, `:1237`) and metal furniture (`:923-932`). With `scene.environment` set, existing
   `MeshStandardMaterial` picks up IBL with **no per-material envMap assignment**.
6. Consider `MeshPhysicalMaterial` **only** for glass (`transmission`, `ior`) — verified available.
   Cost is real; restrict to window glass.

**Anti-pattern guards:**
- **Do NOT use `renderer.outputEncoding`.** Removed in r160 — it is a getter/setter that only
  `console.warn`s (bundle lines 30968-30978). Use `outputColorSpace`, which already defaults to
  `SRGBColorSpace`, so **you likely need to set nothing**.
- Do not set `useLegacyLights` — r160 already defaults it to `false`.
- Do not fetch an HDRI from a CDN. **CSP `img-src` will block it** (§0.7). `RoomEnvironment` is
  procedural and needs no network asset — that is exactly why it is chosen here.
- Call `pmrem.compileEquirectangularShader()` / generate the env **once at boot**, never inside
  `rebuild3D()`.

**Verification:**
- `grep -c "outputEncoding" public/builder/builder.html` → **0**.
- `grep "scene.environment" public/builder/builder.html` → exactly one assignment, outside `rebuild3D`.
- Load `/builder/builder.html`, `read_console_messages` → no CSP violations, no three.js deprecation warnings.
- Screenshot before/after at the same camera; glass and metal must show gradient response, not flat fill.
- **Re-shoot a thumbnail via the save path and confirm it is not black** — `shoot3D` shares the
  renderer, and tone mapping changes what `toDataURL` returns (§0.7).

---

## Phase 2 — Wall openings, ceilings, and honest wall thickness

**Why:** §0.3 items 1, 3, 4. Solid walls with doors pasted on is the strongest "fake" signal.

**Implement:**
1. **Segment walls around openings — no CSG.** Replace the single `BoxGeometry` per wall (`:1021`)
   with 2–4 boxes computed from that wall's door/window `t` positions: left pier, right pier, lintel
   above, sill below. The 2D renderer **already does exactly this maths** — copy the splitting logic
   from `wallLines2D` (`:1901-1921`), which is the only place in the file openings currently break a wall.
   This avoids adding any CSG dependency (none exists, §0.3).
2. **Interior vs exterior thickness.** `sharedWall(b, wall)` (`:711-735`) already detects adjacency.
   Use it to pick `wt`: exterior ≈ 0.23, interior ≈ 0.10, replacing the hardcoded `wt = 0.09` (`:996`).
3. **Suppress duplicate party walls.** When `sharedWall()` reports an adjacent room, build the wall on
   one side only (e.g. lower block id wins) so two rooms share one wall instead of two coincident ones.
4. **Ceilings.** Mirror the floor slab (`:1170-1173`) at `y = C.H`, skipping `open:true` room types
   (`balcony`, `veranda` — flag already exists in `C.rooms`). Must be hidden by the same
   `toggleRoofs()` path (`:1286-1288`) or interior view breaks.
5. **Reveals.** With openings cut, add jamb/sill/lintel boxes so wall thickness is visible through the
   opening — this is what sells thickness.

**Anti-pattern guards:**
- Do **not** add a CSG library. Verified absent; it would change the self-contained-file property and
  the bundle budget. Segmenting is sufficient and cheaper.
- Do not break `wallMats[]` (`:1003`) — every wall material must still be pushed into it, or the wall
  opacity slider (`:2609-2613`) and `shoot3D(seeThrough)` silently stop working.
- Preserve the `OUT_FACE` per-face facade mapping (`:1014`) when a wall becomes several boxes; each
  segment needs the correct outward face index.
- Watch `rebuild3D` cost: this multiplies wall meshes ~3×. Measure before/after (§0.7).

**Verification:**
- Screenshot through a doorway from outside: the far room must be visible.
- Interior camera mode (`#btnIn`): ceilings present, and hidden when roofs are toggled off.
- Two adjacent rooms: count wall meshes at the shared edge — must be 1, not 2.
- Wall opacity slider still works end-to-end; `shoot3D` see-through still works.
- Re-run the template smoke test (Phase 8) — every one of the 31 templates must still build.

---

## Phase 3 — One roof per building

**Why:** §0.3 item 2. Per-room roofs are why a house reads as stacked boxes.

**Implement:**
1. Compute the **union footprint** of all top-floor blocks. `boundsOf()` (`:697-703`) gives AABBs;
   for a rectilinear union, emit a `THREE.Shape` outline. `Shape` + `ExtrudeGeometry` are verified
   available and **already used in this file** — copy the neighbour-polygon pattern at `:826-843` and
   the gable extrusion at `:1056-1067`.
2. Build **one** roof group from that outline in `rebuild3D` (`:1289-1361`), not inside
   `buildBlockGroup` per block. Keep `userData.roof = true` so `toggleRoofs()` still works.
3. Port the existing 9 `C.roofStyle` variants (`:503-513`, `:1044-1164`) to the union outline. `flat`,
   `overhang`, `parapet`, `cantilever_flat`, `green_roof` are slab-based and port directly. `gable`,
   `gabled`, `monoslope`, `butterfly` need a ridge axis chosen from the union's longer dimension.
4. Add eaves/fascia continuity around the union perimeter.

**Anti-pattern guards:**
- Keep roofs on the **top floor only** (`fi === topIdx`, `:1297`).
- `balcony` must remain roofless (`:1045`).
- Do not regress `toggleRoofs()` / interior view.
- Non-contiguous blocks (a detached veranda) must not produce one giant roof spanning the gap —
  union by connected component, not by overall bounding box.

**Verification:**
- A 6-room template renders **1** roof group (assert `scene` roof-tagged group count).
- Each of the 9 roof styles still renders on a multi-room plan; screenshot a matrix.
- Detached-block case produces separate roofs.

---

## Phase 4 — Template schema v2

**Why:** §0.4. Until `opts` can carry more than `doors`/`wins`, every template's bedroom is identical
and no amount of rendering work makes templates feel distinct.

**Implement:**
1. Extend `tRoom` (`:3016-3023`) to read additional optional `opts` keys — **all backward compatible,
   all defaulting to today's behaviour**:
   `w`, `len` (override catalog size), `rot` (0-3), `paint`, `floorCol`, `name`,
   `wins: [wall, t, kind]` (3rd slot enabling the already-implemented `pano`, currently unreachable —
   §0.4), `doors: [wall, t, type, width, height]`, `furniture: [[key, lx, lz, rot]]` to override
   `furnishRoom`, and `partitions`.
2. **Fix the string-index bug** (§0.4): coerce `wall` with `Number(wall)` in `tRoom` before use, since
   `wallPoint` (`:640-643`) uses strict equality. Do this even if templates are also cleaned up.
3. **Version the payload.** `getTemplateGeometry` returns `{profile, rooms}`; add `v: 2` and keep the
   v1 tuple shape readable so existing rows/callers do not break.
   Touch: `lib/template-geometry.ts`, `lib/template-catalog.ts`, `app/api/templates/[key]/route.ts`,
   and `buildFromGeometry` in `builder.html:3258-3261`.
4. Regenerate the server geometry module rather than hand-editing — it is generated (header says so).
   Keep the generator script; extend it to emit v2.

**Anti-pattern guards:**
- Do **not** hand-edit `lib/template-geometry.ts` — it is generated; a hand-typed coordinate silently
  deforms a paid customer's floor plan.
- Do not break the paywall boundary: geometry for the 20 paid templates must stay server-side, and
  `lib/template-geometry.ts` must keep `import "server-only"` as line 1.
- Keep v1 payloads working — paid templates are already sold.
- `clampFurn` (`:982-990`) **silently drops** furniture that does not fit. If templates start
  specifying furniture, dropped items must be logged, not swallowed.

**Verification:**
- All 31 templates build under v2 with byte-identical geometry to v1 (snapshot test).
- `grep -n 'import "server-only"' lib/template-geometry.ts` → line 1.
- `curl /api/templates/off_law` signed out → **402**; catalog response contains **0** `"rooms"` keys.
- New v2-only feature (e.g. a rotated, resized room) renders correctly in one scratch template.

---

## Phase 5 — Re-author templates against v2

**Implement:** rebuild the 31 templates using real plan proportions — varied room sizes, rotations,
corridors that actually connect, `pano` glazing where a living room faces a garden, per-room floor
materials. Author Indian layouts against real typologies (vastu zoning, courtyard, kothi setback).
Use L-shaped arrangements composed of multiple rectangles (the model supports tiling — §0.3 item 5).

**Anti-pattern guards:** do not invent `opts` keys Phase 4 did not implement. Regenerate, never hand-edit.

**Verification:** every template builds; no `clampFurn` drops; screenshot matrix of all 31; area/room
counts match the catalog `desc` text.

---

## Phase 6 — Furniture fidelity and placement

**Implement:** raise the primitive budget beyond 2.9 boxes/item (§0.5) — add `CylinderGeometry`/
`LatheGeometry` for legs, lamps, basins, pots; bevel silhouettes. Add missing pieces (rugs, curtains,
wardrobes in offices, shelving, artwork, ceiling lights). Add a furniture-vs-furniture overlap check
(none exists today). Place against walls using `sharedWall`/`wallPoint` rather than fixed local coords.
Use `InstancedMesh` (verified available) for repeated items like dining chairs.

**Anti-pattern guards:** `FURN_MATS()` currently allocates a fresh material set per instance
(`:923-932`) — share materials before increasing counts, or `rebuild3D` cost explodes. Respect
`clampFurn` and surface drops.

**Verification:** primitive count per item and per scene measured before/after; frame time and
`rebuild3D` duration measured on the largest template; no interpenetration in a screenshot matrix.

---

## Phase 7 — Site context

**Implement:** boundary wall + gate on the plot outline (currently only a `LineLoop` + pink plane,
`:810-826`); driveway/paving; trees and planting; give neighbour extrusions (`:827-842`) simple roofs
and window banding so they stop reading as grey slabs; optional scale figure.

**Anti-pattern guards:** neighbours must stay non-pickable (`userData.pick = null`, `:840`). Keep the
ground plane's shadow-catcher stack intact (`:771-786`). No external texture fetches (CSP, §0.7).

**Verification:** plot renders enclosed; neighbours read as buildings; shadow catcher still works.

---

## Phase 8 — Final verification

1. **Template smoke test (all 31).** Load the builder, build every template key, assert no thrown
   errors and non-zero block counts. This is the single most valuable regression guard — Phases 2–5
   all touch the path every template flows through.
2. **Paywall integrity re-check** (must survive all refactors):
   - `curl -s .../builder/builder.html | grep -c "addTemplate('off_"` → **0**
   - `curl /api/templates/off_law` signed out → **402**
   - `curl /api/templates | grep -o '"rooms":' | wc -l` → **0**
3. **Anti-pattern greps:** `outputEncoding` → 0; `TextureLoader` pointing at any non-`'self'` origin → 0;
   CSG imports → 0; hand-edits to generated files → check the generated header is intact.
4. **Console clean** on `/builder/builder.html` and inside the `/designer` iframe: no CSP violations,
   no three.js deprecation warnings.
5. **Thumbnails:** `shoot3D` output non-black and representative after tone-mapping changes.
6. **Performance:** `rebuild3D` duration on the largest template before vs after; record the number.
7. `npx tsc --noEmit`, `node --test tests/*.test.mjs`, `npm run build` all green.

---

## Open decisions for the owner

1. **Asset strategy.** Procedural-only (works today, CSP-safe, caps fidelity) vs self-hosting real
   PBR textures under `/builder/assets/` (`'self'`, CSP-safe, adds page weight) vs amending
   `img-src`. Phase 1 assumes procedural; Phase 6+ realism is materially better with real maps.
2. **File structure.** `builder.html` is 169 KB of inline JS. Phases 2–6 add substantial code. Consider
   splitting into ES modules under `/builder/` before Phase 2 — but note it is currently
   self-contained, which is why it is trivially served and CSP-simple.
3. **Scope.** Phases 1–3 alone would move this a long way. 4–7 are the difference between "looks
   decent" and "looks designed". Sequence against whether templates or renders are the sales surface.
