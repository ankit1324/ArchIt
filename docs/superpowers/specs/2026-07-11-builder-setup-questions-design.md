# Builder Setup Questions v2 — Design

Date: 2026-07-11. Status: approved.

## Goal

When the ArchIt builder opens (via `/designer`), the setup dialog asks richer
questions before the builder launches: units, floors, facing, budget, notes —
in addition to the existing project name and plot width/depth.

## Fields

| Field | Input | Behavior |
|---|---|---|
| Project name | text (existing) | unchanged |
| Units | toggle m / ft | inputs labeled per unit; ft converted to meters on start (builder is meters-only); area preview in m², plus ft² when ft selected |
| Width / Depth | number (existing) | limits stay 6–120 m (converted equivalent when ft) |
| Floors | 1 / 2 / 3 | builder pre-creates that many empty floors on a new design; cap 3 matches builder limit |
| Facing | N / E / S / W chips | stored with design; builder renders a small compass label at the plot edge |
| Budget ₹ | number, optional | stored; shown in "My designs" list |
| Notes | textarea, optional | stored |

## Storage

One `meta JSONB` column added to the `designs` table holding
`{ unit, facing, budget, notes }`. Chosen over discrete columns because
nothing queries these fields and future setup questions then need no
migration. Passed through `designToRow` / `rowToDesign` converters and the
POST/PUT API bodies.

## Wiring

- `Setup` interface in `app/designer/page.tsx` gains `unit`, `floors`,
  `facing`, `budget`, `notes`.
- `DesignerOverlay` gains optional `floors` and `facing` props, forwarded in
  the `archit:init` postMessage payload.
- `builder.html` init handler: when no existing design, push `floors − 1`
  empty floors; `setContext` gains a facing marker (letter label positioned
  at the corresponding plot edge).
- `saveDesign` includes `meta` in the POST/PUT body.

## Edge cases

- Reopening a saved design: the design state's own floors win; setup floor
  count applies only to new designs.
- Budget/notes empty → omitted from meta.
- Old rows without `meta` → `meta` undefined on the `Design` object; UI
  treats as absent.
