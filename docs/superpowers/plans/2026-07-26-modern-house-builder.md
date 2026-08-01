# Modern House Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add modern facade materials, modern roof styles, and one-click exterior presets to the procedural Three.js builder without changing saved-design version 3 or adding dependencies.

**Architecture:** Keep implementation in `public/builder/builder.html`, extending the existing catalog, canvas texture generator, room roof builder, and global inspector. Presets remain simple assignments through the existing `commit()` path; procedural assets reuse the current texture cache and cleanup traversal.

**Tech Stack:** Standalone HTML, browser JavaScript modules, Three.js from the existing import map, Canvas 2D textures, existing sidebar DOM renderer.

## Global Constraints

- Keep saved designs at `v: 3`; add no required state field or database migration.
- Fall back to existing defaults for missing or unknown exterior keys.
- Presets modify only `paint`, `facade`, `facadeMat`, `roofStyle`, and `roofCol`.
- Make new textures deterministic and cache them in `facadeTexCache`.
- Mark new roof meshes with `userData.roof = true` and retain balcony/top-floor conditions.
- Use visible native buttons and preserve keyboard focus visibility.
- Add no dependencies, network assets, animation loops, or render-resolution changes.
- Preserve unrelated worktree edits in `public/builder/builder.html`; do not reset or commit them.

## File Map

- Modify: `public/builder/builder.html:425` — facade, roof, and preset catalog data.
- Modify: `public/builder/builder.html:537` — exterior state normalization.
- Modify: `public/builder/builder.html:791` — deterministic facade textures.
- Modify: `public/builder/builder.html:892` — procedural modern roofs.
- Modify: `public/builder/builder.html:1860` — preset inspector UI and handler.
- Modify: `public/builder/builder.html:2108` — delegated preset clicks.
- Modify: `public/builder/builder.html:2715` — normalization before rendering.

No API, database, dependency, or TypeScript files change.

### Task 1: Add Catalog And Preset Contracts

**Files:**
- Modify: `public/builder/builder.html:455`
- Modify: `public/builder/builder.html:537`

**Interfaces:**
- Produces `MODERN_PRESETS`, keyed by `japandi`, `nordic`, `stone`, and `monolith`.
- Produces `ensureExteriorState()`, which repairs global exterior keys in place.
- Existing renderers continue consuming `C.facadeMat` and `C.roofStyle`.

- [ ] **Step 1: Extend the exterior catalogs**

Add the new entries without renaming current keys:

```js
facadeMat:{
  paint:{name:'Smooth paint'},
  wood:{name:'Wood slats'},
  brick:{name:'Brick'},
  concrete:{name:'Concrete'},
  fluted_wood:{name:'Fluted wood'},
  stone_cladding:{name:'Stone cladding'},
  metal_panel:{name:'Metal panels'},
  stucco_matte:{name:'Matte stucco'},
},
roofStyle:{
  flat:{name:'Flat'},
  overhang:{name:'Flat + overhang'},
  parapet:{name:'Parapet'},
  gable:{name:'Low gable'},
  gabled:{name:'Gabled + skylights'},
  monoslope:{name:'Monoslope'},
  butterfly:{name:'Butterfly'},
  cantilever_flat:{name:'Cantilever flat'},
  green_roof:{name:'Green roof'},
},
```

- [ ] **Step 2: Define preset data**

Add after the catalog declaration:

```js
const MODERN_PRESETS = {
  japandi:{name:'Japandi Minimal', paint:'cream', facade:'sand', facadeMat:'fluted_wood', roofStyle:'cantilever_flat', roofCol:'charcoal'},
  nordic:{name:'Nordic Timber', paint:'white', facade:'darkbrick', facadeMat:'fluted_wood', roofStyle:'monoslope', roofCol:'zinc'},
  stone:{name:'Contemporary Stone', paint:'greige', facade:'ivory', facadeMat:'stone_cladding', roofStyle:'cantilever_flat', roofCol:'graphite'},
  monolith:{name:'Modern Monolith', paint:'gray', facade:'graphite', facadeMat:'stucco_matte', roofStyle:'monoslope', roofCol:'black'},
};
```

- [ ] **Step 3: Add legacy-state normalization**

Add near `freshState()` and `linkFloor()`:

```js
function ensureExteriorState(){
  if(!C.paint[state.paint]) state.paint = 'white';
  if(!C.facade[state.facade]) state.facade = 'white';
  if(!C.facadeMat[state.facadeMat]) state.facadeMat = 'paint';
  if(!C.roofStyle[state.roofStyle]) state.roofStyle = 'flat';
  if(!C.roofCol[state.roofCol]) state.roofCol = 'light';
}
```

- [ ] **Step 4: Run static checks**

```bash
git diff --check
rg -n "MODERN_PRESETS|fluted_wood|stone_cladding|metal_panel|stucco_matte|monoslope|butterfly|cantilever_flat|green_roof" public/builder/builder.html
```

Expected: no whitespace errors and every identifier appears in catalog or preset data.

### Task 2: Add Deterministic Facade Textures

**Files:**
- Modify: `public/builder/builder.html:791`

**Interfaces:**
- Extends `makeFacadeTexture(matKey, hex)` without changing its signature.
- Returns a cached `THREE.CanvasTexture` for each new material.
- Uses Canvas 2D coordinate arithmetic only; no random source or network asset.

- [ ] **Step 1: Add fluted wood**

Inside `makeFacadeTexture`, add a `fluted_wood` branch. Draw narrow vertical dark recesses every 24–30 px and a low-opacity highlight beside each recess. Keep the existing `wood` branch unchanged.

- [ ] **Step 2: Add stone cladding**

Add staggered rows around 48 px high with thin grout and deterministic per-tile tone variation. Derive tone from tile coordinates, for example:

```js
const shade = ((row*17 + col*31)%9 - 4) / 100;
```

Convert the variation into low-opacity black or white overlays; do not mutate the chosen facade color.

- [ ] **Step 3: Add metal panels**

Draw broad vertical seams with a subtle light edge and one low-opacity horizontal fold line. Keep contrast low enough that `hex` remains the dominant color.

- [ ] **Step 4: Add matte stucco**

Draw sparse deterministic 1–2 px grain from integer grid coordinates:

```js
for(let y=4; y<256; y+=7) for(let x=4; x<256; x+=7){
  const grain = (x*13 + y*29) % 11;
  if(grain<3) g.fillRect(x, y, grain===0 ? 2 : 1, 1);
}
```

- [ ] **Step 5: Preserve cache finalization and verify**

Keep the existing finalization unchanged:

```js
const tex = new THREE.CanvasTexture(c);
tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
facadeTexCache[ck] = tex;
return tex;
```

Run:

```bash
git diff --check
rg -n "fluted_wood|stone_cladding|metal_panel|stucco_matte|Math\.random" public/builder/builder.html
```

Expected: no new material branch contains `Math.random()`; the existing concrete branch may remain unchanged.

### Task 3: Add Modern Roof Geometry

**Files:**
- Modify: `public/builder/builder.html:940`

**Interfaces:**
- Extends the roof branch inside `buildBlockGroup(b, opts={})`.
- Uses existing local dimensions `L`, `W`, `H`, `roofHex`, `roofMat`, `beam()`, and group `g`.
- Marks each roof mesh/accent with `userData.roof = true`.

- [ ] **Step 1: Add monoslope roof**

Create one shallow box roof plane across `L` and `W`, rotated around local x. Use:

```js
const rise = Math.min(2.4, Math.max(.55, W*.42));
const angle = Math.atan2(rise, W+.5);
const slope = Math.hypot(W+.5, rise);
```

Position the low edge near `H`, then add thin fascia beams on the exposed long edges.

- [ ] **Step 2: Add butterfly roof**

Create two mirrored sloping planes that descend from outer edges at `H + rise` to a center valley at `H`. Use simple extruded triangular shapes along `L`, following the existing gable pattern, and add a narrow dark valley beam.

- [ ] **Step 3: Add cantilever flat roof**

Create a flat slab with a deeper overhang than the existing `overhang` style. Add a dark fascia on front and side edges plus one warm emissive soffit strip under the front edge. Do not add a light source.

- [ ] **Step 4: Add green roof**

Create a flat slab, dark perimeter curb, and one inset shallow green mesh with roughness near `1`. Do not add particles, plants, or instancing.

- [ ] **Step 5: Preserve conditions and cleanup**

Keep the outer condition `b.type!=='balcony' && opts.roof!==false`, leave top-floor selection in the existing caller, and keep `clear3D()` unchanged. Ensure every new object is reachable by the existing traversal.

Run:

```bash
git diff --check
rg -n "state\.roofStyle|userData\.roof|monoslope|butterfly|cantilever_flat|green_roof" public/builder/builder.html
```

Expected: every new style is inside the existing roof section and every new roof object carries roof metadata.

### Task 4: Add Preset UI And Wiring

**Files:**
- Modify: `public/builder/builder.html:115`
- Modify: `public/builder/builder.html:1860`
- Modify: `public/builder/builder.html:2108`
- Modify: `public/builder/builder.html:2715`

**Interfaces:**
- Adds `.preset-grid` and `.preset-btn` styles.
- Renders `data-preset` buttons from `MODERN_PRESETS`.
- Produces `applyModernPreset(key)` and `assertModernExteriorCatalog()`.

- [ ] **Step 1: Add the runnable catalog self-check**

Add after `MODERN_PRESETS`:

```js
function assertModernExteriorCatalog(){
  Object.entries(MODERN_PRESETS).forEach(([key,preset])=>{
    ['paint','facade','facadeMat','roofStyle','roofCol'].forEach(field=>{
      if(!C[field][preset[field]]) throw new Error(`Invalid ${field} in preset ${key}`);
    });
  });
  ['fluted_wood','stone_cladding','metal_panel','stucco_matte'].forEach(key=>{
    if(!C.facadeMat[key]?.name) throw new Error(`Missing facade material ${key}`);
  });
  ['monoslope','butterfly','cantilever_flat','green_roof'].forEach(key=>{
    if(!C.roofStyle[key]?.name) throw new Error(`Missing roof style ${key}`);
  });
  return true;
}
assertModernExteriorCatalog();
```

- [ ] **Step 2: Add accessible preset styling**

Add a compact two-column grid near existing inspector styles. Use existing tokens and a visible `:focus-visible` outline:

```css
.preset-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.preset-btn{min-height:48px;padding:8px;border:1.5px solid var(--line);border-radius:10px;background:var(--panel);font-size:12px;font-weight:700;text-align:left}
.preset-btn:hover{background:var(--canvas);border-color:var(--blue)}
.preset-btn:focus-visible{outline:3px solid var(--blue-soft);border-color:var(--blue)}
```

- [ ] **Step 3: Render presets above existing exterior selectors**

At the beginning of the `exterior` section body, add:

```js
<div class="f-label">Modern presets</div>
<div class="preset-grid">
  ${Object.entries(MODERN_PRESETS).map(([key,preset])=>
    `<button type="button" class="preset-btn" data-preset="${key}">${preset.name}</button>`
  ).join('')}
</div>
```

Keep all current material/color/roof selectors below the buttons.

- [ ] **Step 4: Apply presets through one undoable commit**

Define near `SEL_H` and `stdSelect`:

```js
function applyModernPreset(key){
  const preset = MODERN_PRESETS[key];
  if(!preset) return;
  commit(()=>{
    Object.assign(state, {
      paint:preset.paint,
      facade:preset.facade,
      facadeMat:preset.facadeMat,
      roofStyle:preset.roofStyle,
      roofCol:preset.roofCol,
    });
    ensureExteriorState();
  });
}
```

- [ ] **Step 5: Delegate preset clicks**

Before the `.sel-item` branch in `side.addEventListener('click', ...)`, add:

```js
const preset = e.target.closest('[data-preset]');
if(preset){
  applyModernPreset(preset.dataset.preset);
  return;
}
```

- [ ] **Step 6: Normalize all loaded states before render**

At the beginning of `renderAll()`, after `if(!state) return;`, add:

```js
ensureExteriorState();
```

This covers localStorage, share-link, and embed loads without changing their serialized shape.

- [ ] **Step 7: Run static checks**

```bash
git diff --check
rg -n "assertModernExteriorCatalog|applyModernPreset|data-preset|ensureExteriorState|preset-grid" public/builder/builder.html
```

Expected: each integration appears once in its intended section.

### Task 5: Browser Verification And Handoff

**Files:**
- Verify: `public/builder/builder.html`
- Compare: `docs/superpowers/specs/2026-07-26-modern-house-builder-design.md`

- [ ] **Step 1: Start the app**

Run:

```bash
npm run dev
```

Expected: the existing Next.js development server starts without a compile error.

- [ ] **Step 2: Verify the standalone builder**

Open `/builder/builder.html` and confirm:

1. Four labeled preset buttons appear under Exterior.
2. Each preset updates all five selectors and changes the house.
3. Each new material renders with one light and one dark facade color.
4. Each new roof renders on narrow and wide rooms without console errors.
5. Undo and Redo restore states around a preset click.
6. Refresh preserves values through current localStorage behavior.
7. Existing material and roof keys render unchanged.
8. Keyboard Tab reaches every preset with visible focus.
9. `assertModernExteriorCatalog()` produces no console error.

- [ ] **Step 3: Verify embedded saving**

Open `/designer`, load the embedded builder, apply a preset, and save. Confirm the parent receives the existing `{v:3, state}` design payload and snapshot; no new required property appears.

- [ ] **Step 4: Review the focused diff**

Run:

```bash
git diff --check
git diff --stat -- public/builder/builder.html
git diff -- public/builder/builder.html
```

Confirm approved changes coexist with pre-existing user edits and no unrelated file was modified by implementation.

- [ ] **Step 5: Report deliberate limits**

Report validation results and note that external PBR textures, per-wall materials, preset thumbnails, editable roof pitch, and roof drainage remain intentionally excluded.

## Self-Review

- Spec coverage: Task 1 covers catalog/state compatibility; Task 2 covers four deterministic textures; Task 3 covers four roofs and cleanup; Task 4 covers presets, accessibility, undo wiring, and load normalization; Task 5 covers standalone/embed validation.
- Placeholder scan: no `TODO`, `TBD`, or unspecified error-handling steps remain.
- Key consistency: presets use exactly `paint`, `facade`, `facadeMat`, `roofStyle`, and `roofCol`; every referenced value exists in Task 1.
- File scope: implementation stays in `public/builder/builder.html`; no dependency, API, database, or model changes are planned.
