# Multi-user Showcase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users publish designs to a signed-in showcase and the /find map, and let listing owners pick intent (sale/rent/showcase) and attach a published 3D design.

**Architecture:** Additive Supabase migration; all data still flows through Clerk-gated Next.js route handlers using the server secret key (no RLS policies, no client Supabase). Pure logic (projections, validation, filters) lives in `lib/*.ts` and is unit-tested with `node --test`. UI reuses the builder iframe (new `view=1` mode) for read-only 3D.

**Tech Stack:** Next.js 16 (read `node_modules/next/dist/docs/` before Next code — AGENTS.md), React 19, Clerk 7, supabase-js 2, maplibre-gl 5, Tailwind 4, node:test.

**Spec:** `docs/superpowers/specs/2026-10-17-multiuser-showcase-design.md` — executors read it; this plan does not repeat its UI copy or rationale.

## Global Constraints

- No response body may contain a Clerk `user_id`; other users' designs only leave the server through `toPublishedDesign`.
- `meta` never leaves the server for non-owners except `facing`.
- Paywalls stay disabled; no new fees.
- Every new page/API path is Clerk-gated via `proxy.ts` `isProtected`.
- `[0, 0]` plot center = "no location".
- Migration is additive: no DELETE/UPDATE of existing rows, no column drops.
- Tests: `npm test` (`node --test tests/*.test.mjs`, imports `../lib/x.ts` directly — so lib files under test must not import `server-only` modules except via `import type`).
- Gates: `npm test`, `npx tsc --noEmit`, `npm run lint` all pass.

## Review Focus

1. Published design with no picked spot → in gallery, absent from /find, no "See on map". (Task 2 tests)
2. Owner edits a listing whose attached design was later unpublished → attachment and `defaultView` survive the save. (Task 3 tests)
3. Creating a `showcase` listing (price 0) → accepted; today's POST rejects `!l.price`. (Task 3 tests + Task 4)
4. Saving a published design from /designer (which sends `plotCenter [0,0]`) → pin does not move. (Task 2 test on `designUpdateRow`)
5. Design names with `<img onerror>` loaded into another user's viewer → rendered inert. (Task 1 + Task 7 manual check)

---

### Task 1: Builder escaping fix

**Files:** Modify `public/builder/builder.html`

- [ ] **Step 1:** `git checkout daff9fe -- public/builder/builder.html` (daff9fe = PR ankit1324/ArchIt#39; same base as main, so this is main + the escaping fix only).
- [ ] **Step 2:** `git diff --cached --stat` shows only that file. Commit: `fix(builder): escape design-sourced strings (from #39)`.

### Task 2: Schema, types, db mapping, showcase projection

**Files:**
- Create: `supabase/migrations/20261017120000_multiuser_showcase.sql`, `lib/showcase.ts`, `tests/showcase.test.mjs`
- Modify: `lib/types.ts`, `lib/db.ts`

**Interfaces — Produces:**
- `lib/types.ts`:
  - `ListingType = "sale" | "rent" | "showcase"`; `ListingView = "photos" | "3d"`
  - `Listing` adds `designId?: string; designSnapshot?: string; defaultView?: ListingView; designPublished?: boolean` (last one owner-only)
  - `Design` adds `publishedAt?: string; place?: string`
  - `PublishedDesign { id; name; plotCenter: [number, number] | null; plotW; plotD; place?: string; facing?: DesignMeta["facing"]; snapshot?: string; authorName: string; publishedAt: string; mine: boolean; design?: DesignStateV3 }`
  - `formatPrice` returns `"Showcase"` for type `showcase`.
- `lib/db.ts`: `DesignRow` adds `published_at: string | null; author_name: string | null; place: string | null`; `rowToDesign` maps `publishedAt`, `place`; new `designUpdateRow(d: Omit<Design,"id">)` = `designToRow` minus `plot_lng`/`plot_lat`; `PropertyRow` adds `design_id: string | null; default_view: ListingView`; `OWNED_COLUMNS` adds `design_id, default_view`; `listingToRow` writes `default_view: l.defaultView ?? "photos"` (never `design_id` — routes set it).
- `lib/showcase.ts` (imports types only):
  - `hasLocation(lng: number, lat: number): boolean`
  - `toPublishedDesign(row: DesignRow, viewerId: string | null, opts?: { includeDesign?: boolean }): PublishedDesign` (`authorName` falls back to `"ArchIt user"`)
  - `parseShowcaseQuery(params: URLSearchParams): { limit: number; before: string | null; located: boolean }` (default 60, clamp 1..200, `before` must parse as a date else null)
  - `parsePublishBody(body: unknown): { ok: true; published: boolean; location: { lng: number; lat: number; place: string | null } | null } | { ok: false; error: string }`
  - `SHOWCASE_COLUMNS` string (every column `toPublishedDesign` needs except `design`)

- [ ] **Step 1: Failing tests** in `tests/showcase.test.mjs`:
  - `hasLocation(0,0) === false`, `hasLocation(76.7, 30.7) === true`, `hasLocation(0, 30) === true`
  - `toPublishedDesign` on a row with `user_id:"u1"`, `meta:{budget:5e6, notes:"x", facing:"N"}`, `plot_lng:0, plot_lat:0`: result has no `user_id`/`meta`/`budget`/`notes` keys (check `JSON.stringify`), `facing === "N"`, `plotCenter === null`, `mine === true` for viewer `"u1"` and `false` for `"u2"`/`null`, no `design` key unless `includeDesign`
  - `parseShowcaseQuery`: `""` → `{limit:60, before:null, located:false}`; `limit=999` → 200; `limit=0` → 1; `limit=abc` → 60; `before=nope` → null; `located=1` → true
  - `parsePublishBody`: `{published:true}` → ok, location null; `{published:false, location:{lng:0,lat:0}}` → error; lng 181 → error; `place` 200 chars → trimmed to 120; `{published:"yes"}` → error; `location:null` → ok null
- [ ] **Step 2:** `npm test` → FAIL (module missing).
- [ ] **Step 3:** Write migration exactly per spec "Data model" (designs `published_at`, `author_name`, `place`, partial index `designs_published_idx`; properties drop `properties_type_check`, re-add with `'showcase'`, `design_id … REFERENCES designs(id) ON DELETE SET NULL`, `default_view … CHECK`). Update types/db/showcase per Interfaces.
- [ ] **Step 4:** `npm test` and `npx tsc --noEmit` → PASS (fix any `ListingType` exhaustiveness errors, e.g. `PRISM_COLORS` in `components/Map3D.tsx` gets a `showcase` colour `#8b5cf6`, FilterSidebar label maps).
- [ ] **Step 5:** Commit `feat: showcase schema, types and projection`.

### Task 3: Listing presentation rules

**Files:** Create `lib/listing-presentation.ts`, `tests/listing-presentation.test.mjs`

**Interfaces — Produces:**
- `validateListingWrite(input: { type: ListingType; price: number; designId?: string | null; defaultView?: ListingView }, storedDesignId: string | null, newDesign: { owned: boolean; published: boolean } | null): { ok: true; price: number; designId: string | null; defaultView: ListingView } | { ok: false; error: string; status: 400 }`
  - `designId` undefined → keep `storedDesignId`; null → detach; equal to stored → keep (no checks); new id → requires `newDesign?.owned && newDesign.published`
  - `type === "showcase"` → `price: 0`; otherwise `price` must be > 0
  - `defaultView` default `"photos"`; must be one of `ListingView`
- `presentListing(listing: Listing, row: { design_id: string | null; default_view: ListingView }, design: { published: boolean; snapshot: string | null } | undefined, mine: boolean): Listing`
  - published design → `designId`, `designSnapshot` (via `safeImageUrl` from `lib/url.ts`), `defaultView: row.default_view`
  - otherwise visitor sees no `designId`/`designSnapshot`, `defaultView: "photos"`
  - `mine` → always `designId`, `defaultView: row.default_view`, `designPublished`

- [ ] **Step 1: Failing tests:** keep-on-undefined with unpublished stored design → ok, same id; re-send stored unpublished id → ok; new id not owned → 400; new id owned but unpublished → 400; null → detach; showcase price 5000 → price 0; sale price 0 → 400; `defaultView:"video"` → 400; `presentListing` visitor vs owner with unpublished design (owner sees `designPublished:false` and stored `defaultView:"3d"`, visitor sees `"photos"` and no `designId`).
- [ ] **Step 2:** run → FAIL. **Step 3:** implement. **Step 4:** run → PASS.
- [ ] **Step 5:** Commit `feat: listing intent and attached-design rules`.

### Task 4: API routes + DesignViewer

**Files:**
- Create: `app/api/designs/[id]/publish/route.ts`, `app/api/showcase/route.ts`, `app/api/showcase/[id]/route.ts`, `components/DesignViewer.tsx`
- Modify: `app/api/designs/[id]/route.ts` (PUT uses `designUpdateRow`), `app/api/properties/route.ts`, `app/api/properties/[id]/route.ts`, `proxy.ts`

**Interfaces — Consumes:** Task 2, Task 3. **Produces:**
- `POST /api/designs/[id]/publish` → `Design` (owner) | 400/401/404/429. Author name: `(await clerkClient()).users.getUser(userId)` → `firstName || username || "ArchIt user"`. Rate limit `checkRateLimit(ipKey(request, "designs-publish", userId), 20, 60_000)`.
- `GET /api/showcase?limit&before&located` → `PublishedDesign[]` (no `design`), `published_at` desc, `.lt("published_at", before)` when set; `located` filters out rows where `hasLocation` is false (filter in JS after query is fine).
- `GET /api/showcase/[id]` → `PublishedDesign` with `design`; 404 when missing or `published_at` null.
- Properties: POST/PUT run `validateListingWrite` (POST: `storedDesignId = null`; PUT: read stored `design_id` in `ownershipError`'s query or a second select); new design lookup = `select("id,user_id,published_at").eq("id", designId)`. POST drops the `!l.price` check in favour of the helper. GET list/[id]: collect `design_id`s, one `select("id,published_at,snapshot").in("id", ids)`, then `presentListing`.
- `proxy.ts`: add `"/showcase(.*)"`, `"/api/showcase(.*)"`.
- `components/DesignViewer.tsx`: `export default function DesignViewer({ designId, onClose }: { designId: string; onClose: () => void })` — fixed full-screen overlay; fetches `/api/showcase/${designId}`; iframe `src="/builder/builder.html?embed=1&view=1"`; on `archit:ready` posts `archit:init` `{ design, plot: { w: plotW, d: plotD }, neighbors: [], facing }`; on `archit:close` calls `onClose`; checks `e.origin === location.origin` and `e.source === iframe.contentWindow` like `DesignerOverlay`. Loading and error states.

- [ ] **Step 1:** Read `node_modules/next/dist/docs/` route-handler + dynamic params pages.
- [ ] **Step 2:** Implement routes, proxy, DesignViewer.
- [ ] **Step 3:** `npm test`, `npx tsc --noEmit`, `npm run lint` → PASS.
- [ ] **Step 4:** Commit `feat: publish, showcase and listing-design APIs`.

---

**Tasks 5, 6, 7 run in parallel after Task 4** (disjoint files). Each runs `npx tsc --noEmit` and `npm run lint` before committing; each commits only its own files.

### Task 5: Designer publish flow

**Files:** Create `lib/geocode.ts`, `tests/geocode.test.mjs`, `components/PublishDialog.tsx`, `components/PinPickerMap.tsx`. Modify `app/designer/page.tsx`.

**Interfaces — Produces:**
- `lib/geocode.ts`: `searchPlace(query: string, signal?: AbortSignal): Promise<{ center: [number, number]; bbox: [[number, number], [number, number]] } | null>`; `reverseGeocode(coords: [number, number], signal?: AbortSignal): Promise<{ label: string; city: string } | null>` — same Nominatim URLs as `app/find/page.tsx`; `label` = short form (road/suburb + city, ≤120 chars).
- `PublishDialog({ design, onDone, onCancel }: { design: Design; onDone: (d: Design) => void; onCancel: () => void })` — behaviour and copy per spec "Publish dialog"; POSTs `/api/designs/${id}/publish`.
- `PinPickerMap({ value, onChange, flyTo })` — 2D maplibre, OpenFreeMap style as in `Map3D`, loaded via `next/dynamic` `ssr:false`.

- [ ] **Step 1:** Failing `tests/geocode.test.mjs` with `globalThis.fetch` stubbed: search parses `boundingbox`/`lon`/`lat` into `center` + `bbox`; empty result → null; reverse builds label from `address.road`, `address.suburb`, `address.city ?? town ?? village`, truncated to 120.
- [ ] **Step 2:** FAIL → implement → PASS.
- [ ] **Step 3:** Dialog, map, designer list controls (Publish / Unpublish / Move pin, Published badge, `/showcase` link). Unpublish = POST `{published:false}` after `confirm()`.
- [ ] **Step 4:** gates → commit `feat(designer): publish designs with a map pin`.

### Task 6: Showcase pages + builder view mode

**Files:** Create `app/showcase/page.tsx`, `app/showcase/[id]/page.tsx`, `app/showcase/layout.tsx` (mirror `app/find/layout.tsx`). Modify `public/builder/builder.html`, `components/Navbar.tsx`.

**Interfaces — Consumes:** `GET /api/showcase`, `GET /api/showcase/[id]`. The `[id]` page renders its header and opens the read-only builder inline with the same init protocol as `DesignViewer` (Task 4). Do not modify `components/DesignViewer.tsx` (Task 7 imports it).

- [ ] **Step 1:** Builder view mode: `const VIEW = EMBED && new URLSearchParams(location.search).has('view')`; `body.view` CSS hides Save, all add/edit/template/export UI, keyboard shortcuts that mutate, drag/move handlers (guard at entry with `if(VIEW) return`). Keep orbit, floor switch, 2D/3D, Close (posts `dirty:false`).
- [ ] **Step 2:** Gallery: cards per spec, `next/image` only if the Storage host is in `next.config.ts` images (else `<img>` via `safeImageUrl`), Load more via `before=<last publishedAt>`, empty state → `/designer`.
- [ ] **Step 3:** Viewer page per spec header; "See on map" only when `plotCenter`.
- [ ] **Step 4:** Navbar "Showcase" link next to Find/Designer.
- [ ] **Step 5:** gates → commit `feat: showcase gallery and read-only viewer`.

### Task 7: /find designs layer + listing intent/design UI

**Files:** Modify `lib/find.ts`, `tests/find.test.mjs`, `components/Map3D.tsx`, `components/MapControls.tsx`, `app/find/page.tsx`, `components/FilterSidebar.tsx`, `components/AddPropertyForm.tsx`, `components/PropertyDetailPanel.tsx`. Create `components/DesignPinCard.tsx`.

**Interfaces — Produces:**
- `lib/find.ts`: `export type MapLayer = "listings" | "designs" | "both"`; `matchesDesignQuery(d: PublishedDesign, query: string): boolean` (name + place); `findListings` sorts showcase listings after priced ones on `price-asc`/`price-desc`; showcase listings pass the price filter.
- `Map3D` props add `designs?: PublishedDesign[]`, `onSelectDesign?: (id: string) => void`; design markers: snapshot thumb with accent outline (`#8b5cf6`), no prism.
- `MapControls` props add `layer: MapLayer`, `onLayerChange: (l: MapLayer) => void`.

- [ ] **Step 1:** Failing tests in `tests/find.test.mjs`: type `showcase` filter returns only showcase listing; showcase listing (price 0) is still returned with `price:[1000, 50000]` (spec: showcase listings pass the price filter); `price-asc` and `price-desc` both put showcase last; `matchesDesignQuery` matches name and place case-insensitively.
- [ ] **Step 2:** FAIL → implement → PASS (existing tests stay green).
- [ ] **Step 3:** Map/controls/page: fetch `/api/showcase?limit=200&located=1`, layer toggle (default both), design pin → `DesignPinCard` (snapshot, name, author, plot size, "Open 3D" → `DesignViewer`), `?design=<id>` flies + opens card, search box also filters design pins.
- [ ] **Step 4:** Form: intent Sale · Rent · Showcase only (hides price), attach-design select (owner's `/api/designs` with `publishedAt`, unpublished-attached label per spec), "Open first with" Photos · 3D. `PropertyDraft` gains `designId: string | null; defaultView: ListingView`.
- [ ] **Step 5:** Detail panel: Photos · 3D design tabs when `designId`, initial = `defaultView`; showcase price line per spec; "Open 3D" → `DesignViewer`. FilterSidebar: Showcase chip.
- [ ] **Step 6:** gates → commit `feat(find): design pins, showcase listings, attached 3D designs`.

### Task 8: Integrate and ship

- [ ] **Step 1:** All three tracks merged on `feat/multiuser-showcase`; `npm test`, `npx tsc --noEmit`, `npm run lint` PASS.
- [ ] **Step 2:** Whole-branch review (superpowers:requesting-code-review) against Global Constraints + Review Focus; fix findings.
- [ ] **Step 3:** If local env has Clerk + Supabase keys and the migration can be applied to a dev DB, browser-check: publish with pin → appears in /showcase and /find; viewer read-only; listing with attached design. Otherwise state it was not browser-verified.
- [ ] **Step 4:** Push, open PR to `main` with migration + Clerk production-instance notes.
