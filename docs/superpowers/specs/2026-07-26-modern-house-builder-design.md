# Modern House Builder Design

**Date:** 2026-07-26  
**Status:** Approved design, pending implementation plan

## Goal

Improve the existing Three.js house builder with modern exterior styles while preserving its current single-file architecture, procedural rendering, saved-design format, undo/redo behavior, and embedded `/designer` workflow.

The first release adds four facade materials, four roof styles, and four one-click design presets. It does not add downloaded textures, GLTF models, per-wall material editing, or a new persistence schema.

## Existing Architecture

The builder lives in `public/builder/builder.html` and contains:

- The Three.js scene and procedural mesh generators.
- Builder state, undo/redo, save/load, and embed messaging.
- The inspector and project summary UI.
- Canvas-generated facade textures cached by material and color.
- Roof geometry selected through the global `state.roofStyle` value.

Saved designs use the existing version 3 JSON wrapper represented by `DesignStateV3`. New facade and roof identifiers are plain string values inside the existing state, so no API or database migration is required.

## User Experience

### Design Presets

Add a **Modern presets** section to the global house settings panel. It contains four compact buttons:

1. **Japandi Minimal**
   - Facade material: Fluted wood
   - Facade color: Sand
   - Roof style: Cantilever flat
   - Roof color: Charcoal
   - Interior wall paint: Cream

2. **Nordic Timber**
   - Facade material: Fluted wood
   - Facade color: Dark brick
   - Roof style: Monoslope
   - Roof color: Zinc
   - Interior wall paint: White

3. **Contemporary Stone**
   - Facade material: Stone cladding
   - Facade color: Ivory
   - Roof style: Cantilever flat
   - Roof color: Graphite
   - Interior wall paint: Greige

4. **Modern Monolith**
   - Facade material: Matte stucco
   - Facade color: Graphite
   - Roof style: Monoslope
   - Roof color: Black
   - Interior wall paint: Gray

Selecting a preset performs one undoable state update using the same global fields already changed by the individual selectors. A preset is not stored as a separate state field. Subsequent manual edits are allowed and do not need to preserve a named preset selection.

The existing facade material, facade color, roof style, roof color, and wall paint selectors remain available below the preset buttons.

### Selection Feedback

- Clicking a preset rebuilds the scene immediately.
- The existing selectors reflect the preset values after the inspector rerenders.
- Preset buttons use text labels rather than image thumbnails to avoid asset and loading overhead.
- The project summary continues to show the resolved material and roof names.

## Facade Materials

Extend `C.facadeMat` and `makeFacadeTexture` with four procedural materials.

### Fluted Wood

- Narrow vertical boards with dark recessed gaps.
- Alternating low-opacity highlights prevent a flat barcode appearance.
- Uses the selected facade color as the timber base.

### Stone Cladding

- Staggered rectangular courses with thin grout lines.
- Deterministic tone variation and short mineral streaks create depth.
- Uses the selected facade color as the dominant stone tone.

### Metal Panels

- Wide vertical panels with narrow standing seams.
- Soft edge highlights suggest folded metal without adding geometry.
- Uses the selected facade color and the existing standard material pipeline.

### Matte Stucco

- Fine deterministic grain with sparse cloudy tonal variation.
- Avoids high-contrast joints or repeating structural lines.
- Uses the selected facade color as the plaster base.

Texture generation must be deterministic. The existing concrete texture currently uses `Math.random`; the new materials must use coordinate-based patterns or a small seeded generator so undo/rebuild does not visibly change their surface.

The texture cache remains keyed by material identifier and facade color. No external image files or new dependencies are added.

## Roof Styles

Extend `C.roofStyle` and the existing roof branch in the room mesh builder.

### Monoslope

- A single roof plane rises from one side of the room block to the other.
- A thin fascia follows the exposed high and low edges.
- Pitch is clamped based on room width so small rooms remain believable.

### Butterfly

- Two planes descend from opposite outer edges toward a shallow center valley.
- A narrow dark valley strip visually separates the planes.
- Rise is clamped to avoid extreme roof heights.

### Cantilever Flat

- A thin flat slab extends farther than the existing overhang roof.
- A dark perimeter fascia creates a crisp contemporary profile.
- A warm emissive strip sits below the front edge as a subtle soffit light.

### Green Roof

- A flat roof slab receives a shallow vegetation layer inset from the edges.
- A dark perimeter curb frames the planted area.
- The vegetation uses simple geometry and a rough green material; no particles or instancing are needed for this release.

All roof meshes keep `userData.roof = true`, cast shadows where appropriate, and are omitted from balcony blocks and non-top floors through the existing roof conditions.

## State And Compatibility

- Keep the saved design version at `v: 3`.
- Do not add a required field to `DesignStateV3`.
- Existing saved designs retain their current appearance.
- Missing or unknown facade and roof values must fall back to existing safe defaults before rendering.
- Presets modify only `paint`, `facade`, `facadeMat`, `roofStyle`, and `roofCol`.
- Preset application uses the existing commit path so undo, redo, dirty state, scene rebuild, and embed saving remain consistent.

## Accessibility

- Presets are native `<button>` elements with visible names.
- Focus indicators follow the builder's existing button treatment and remain visible.
- Selected or pressed styling must not be the only way values are communicated because the live selectors show the applied values.
- Decorative color samples, if used, are marked hidden from assistive technology.

## Performance And Resource Handling

- Generate textures only on first use and reuse the existing cache.
- Reuse simple box, shape, and buffer geometry patterns already present in the builder.
- Dispose generated roof materials and geometry through the existing scene cleanup traversal.
- Do not load network assets, add animation loops, or increase render resolution.

## Validation

Add one small runnable browser-side self-check for the preset data and new catalog identifiers. It verifies that:

- Every preset references an existing paint, facade, facade material, roof style, and roof color key.
- Every newly introduced material and roof style has a display name.

Manual verification covers:

1. Open each preset and confirm the scene and selectors update.
2. Undo and redo one preset application.
3. Render each new material in light and dark facade colors.
4. Render each new roof on narrow and wide room blocks.
5. Save, reload, and edit a design using new options in embedded mode.
6. Load an existing v3 design and confirm its previous appearance remains unchanged.
7. Check preset buttons with keyboard navigation and visible focus.

## Files

Expected implementation changes are limited to:

- `public/builder/builder.html`

No dependency, API, database, or TypeScript model changes are expected.

## Deliberate Limits

- No per-wall facade assignment; add it only when mixed-material elevations become an explicit editing requirement.
- No PBR image textures or normal maps; add them only when visual fidelity justifies asset hosting and loading controls.
- No roof drainage simulation, editable pitch, or solar analysis; add them only when construction-level modeling is required.
- No preset thumbnails; add generated previews only when the text buttons prove insufficient for choosing styles.
