# Multi-user showcase — design

Date: 2026-10-17 · Branch: `feat/multiuser-showcase` · Target: PR to `main` (ankit1324/ArchIt)

## Intent

Today every design made in `/designer` is private to its author, and `/find`
only shows property listings. "Multi-user" for ArchIt means users can see each
other's work:

1. **Publish designs.** A user can publish a saved design so other users can
   browse it in a showcase gallery and open it in a read-only 3D view.
2. **Designs on the map.** Published designs appear on the `/find` map at their
   plot location, next to property listings, so people browse by place.
3. **Owner's presentation choices for listings.** A property owner picks the
   listing's intent (sale, rent, or the new **showcase only** — "look at my
   place, it is not on the market") and can attach one of their published
   designs, so visitors see the property as photos or as a 3D design.

Confirmed with the user (2026-10-17): the playback of points 1–3 above, including
"owner attaches their own 3D design to their listing so buyers can walk through it".
Also decided by the user: a design's map pin comes from **picking the spot on a
map when publishing** (designs published without a spot are gallery-only), and
**ArchIt Lite has its own data** — it does not read this `properties` table, so
a new listing type needs no Lite compatibility work.

## Current state (what this builds on)

- All data routes are Clerk-gated in `proxy.ts`; Supabase is reached only
  server-side with the secret key (`lib/db.ts`). RLS is enabled with **no
  policies** on every table, so the anon/publishable key gets nothing. Per-user
  isolation is already enforced by `.eq("user_id", userId)` in every route.
  **Keep this pattern** — no client-side Supabase, no RLS policies added.
- `designs` rows have `plot_lng`, `plot_lat`, `plot_w`, `plot_d`, `snapshot`
  (public Storage URL of a PNG) and `meta` — **but the location is fake**:
  `/designer` is deliberately standalone and saves every design at
  `plotCenter = [0, 0]` (`app/designer/page.tsx`, "standalone designs carry no
  map location"). A real location only comes from the publish map picker
  below. Treat `[0, 0]` as "no location".
- The builder renders design names/ids into its own HTML. An escaping fix for
  that is commit `daff9fe` on the unmerged branch `fix/audit-first-batch`.
- `properties.type` is `'sale' | 'rent'` (DB CHECK). Listings render on the
  `/find` map via `components/Map3D.tsx` (price markers + extruded prisms) and
  open `components/PropertyDetailPanel.tsx`.
- The builder (`public/builder/builder.html?embed=1`) is driven from
  `components/DesignerOverlay.tsx` over `postMessage` (`archit:init`,
  `archit:save`, `archit:close`, `archit:ready`).
- Paywalls are disabled (builder, templates, contact owner are free). Do not
  re-enable them and do not add new fees.

## Goals

- Publish / unpublish a design from the `/designer` designs list (owner only).
- `/showcase`: gallery of published designs, newest first.
- `/showcase/[id]`: read-only viewer for one published design.
- `/find`: published designs as a distinct pin type; a layer toggle
  (Listings · Designs · Both); clicking a design pin shows a small card with a
  link to the viewer.
- Listings gain intent `showcase` and an optional attached published design,
  plus the owner's choice of which view opens first (photos or 3D).
- Unit tests for the pure logic; `npm test`, `npx tsc --noEmit`, `npm run lint`
  all pass.

## Non-goals

- Real-time co-editing, collaborators/roles, teams/Clerk Organizations.
- Remixing or copying someone else's design.
- Likes, comments, follows, notifications.
- Public (signed-out) access or SEO for the showcase — everything stays
  Clerk-gated like the rest of the app.
- Moderation tooling (beyond the owner being able to unpublish).
- Switching Clerk to a production instance (dashboard work for the user; see
  Launch note).

## Anti-goals (would be a failure even if it works)

- Any response body containing another user's Clerk `user_id`.
- A private design readable by anyone other than its owner, by any route.
- Attaching someone else's design to your listing.
- Breaking existing saves/edits/deletes of private designs or listings.

## Data model (migration `supabase/migrations/20261017120000_multiuser_showcase.sql`)

Purely additive; no destructive DML.

**designs**
- `published_at TIMESTAMPTZ NULL` — NULL = private; non-NULL = published (and
  when). One column instead of a flag + timestamp.
- `author_name TEXT NULL` — display name captured at publish time (see Author
  name). Cleared on unpublish.
- `place TEXT NULL` — short human place label (e.g. "Sector 8, Chandigarh")
  from reverse-geocoding the picked spot; shown on cards and matched by search.
  NULL when no spot was picked.
- The picked spot is written into the existing `plot_lng` / `plot_lat`.
  "Has location" = not both zero (helper in `lib/showcase.ts`).
- Partial index `designs_published_idx ON designs (published_at DESC) WHERE published_at IS NOT NULL`.

**properties**
- Widen the type CHECK to `('sale', 'rent', 'showcase')`. The original
  constraint is the inline CHECK from `20260710165836_create_properties.sql`
  (Postgres name `properties_type_check`); drop and re-add it in the migration.
- `design_id TEXT NULL REFERENCES designs(id) ON DELETE SET NULL`.
- `default_view TEXT NOT NULL DEFAULT 'photos' CHECK (default_view IN ('photos', '3d'))`.
- For `showcase` listings, `price` is stored as `0` (column stays NOT NULL).


## API

All under existing Clerk protection. Add `/showcase(.*)` and
`/api/showcase(.*)` to the `isProtected` matcher in `proxy.ts`.

**Public projection.** A new `PublishedDesign` type (in `lib/types.ts`) is what
other users see: `id, name, plotCenter (null when no location), plotW, plotD,
place, facing, snapshot, authorName, publishedAt, mine` and — only on the
single-design endpoint — `design` (the v3 JSON). `facing` is copied out of
`meta` (not sensitive; the viewer needs it). Never `user_id`, never the rest of
`meta` (budget/notes are private).
Mapping lives in `lib/showcase.ts` (pure, unit-tested).

- `POST /api/designs/[id]/publish` body
  `{ published: boolean, location?: { lng, lat, place? } | null }` — owner only
  (`.eq("user_id", userId)`, else 404). Publishing sets `published_at = now()`
  and `author_name`; if `location` is given (validated: finite, lng ∈ [-180,180],
  lat ∈ [-90,90], not both 0; `place` trimmed, ≤ 120 chars) it writes
  `plot_lng`/`plot_lat`/`place`. Re-publishing an already-published design with
  a new `location` moves the pin. Unpublishing sets `published_at` and
  `author_name` to NULL and keeps location/place (so re-publishing pre-fills). Rate-limited with the
  existing `lib/rate-limit.ts` helper (same style as other write routes).
  Returns the owner's `Design`.
- `GET /api/designs` / `PUT` / `DELETE` — unchanged behaviour; `Design` gains
  `publishedAt?: string` so the designer list can show state. Editing a
  published design keeps it published (the showcase shows the latest save).
- `GET /api/showcase` — published designs, newest first, list projection
  (no `design` JSON). Query `?limit=` (default 60, max 200) and
  `?before=<ISO publishedAt>` cursor for "Load more". `/find` calls it with
  `limit=200` and `?located=1` (only designs with a location) — my call:
  designs are few today; bbox filtering is later work.
- `PUT /api/designs/[id]` must not overwrite the picked location: the designer
  sends `plotCenter: [0, 0]` for standalone designs, so the PUT keeps the
  stored `plot_lng`/`plot_lat` (drop them from the update) — location changes
  only via the publish route.
- `GET /api/showcase/[id]` — one published design incl. `design` JSON; 404 if
  missing or private (even for its owner — the owner uses `/designer`).
- `POST /api/properties`, `PUT /api/properties/[id]` accept `designId?: string | null`
  and `defaultView?: 'photos' | '3d'` and `type: 'showcase'`. Contract for
  `designId` on PUT: **absent = keep the stored value**, `null` = detach, a
  string = attach. Server validation (pure helper, unit-tested): a *newly
  attached* `designId` (different from the stored one) must be a design owned by
  the same user **and published**, else 400; re-sending the already-stored id is
  always allowed even if that design is now unpublished (so editing a listing
  never silently drops the attachment). `type: 'showcase'` forces `price = 0`.
  `defaultView` is stored as given.
- `GET /api/properties` (+ `[id]`): for everyone, `designId`, `designSnapshot`
  and the stored `defaultView` are returned only while the attached design is
  published; otherwise those are omitted and `defaultView` reads `'photos'`.
  **For the owner (`mine`)**, `designId`, `defaultView` and
  `designPublished: boolean` are always returned so the form can show
  "attached design is unpublished". Implement with a second query over the
  referenced design ids (simple, avoids PostgREST embed quirks) — builder may
  use an embed if cleaner.

## Pages and UI

Follow the existing look (Tailwind + the CSS modules already used in
`app/find`). Read `node_modules/next/dist/docs/` before writing Next.js code
(AGENTS.md: this Next version has breaking changes).

**`/designer` (designs list).** Each saved design row gets a Publish /
Unpublish control and a "Published" badge (plus "Move pin" for published
designs). Link to `/showcase` from the list header.

**Publish dialog.** Opens from Publish / Move pin. Contains:
- a place search box (same Nominatim search `/find` uses — `app/find/page.tsx`
  `searchPlace`; extract to a shared helper) and a small 2D maplibre map
  (same basemap style as `components/Map3D.tsx`) where a click drops/moves a
  pin; reverse-geocode the pin for `place` (same Nominatim reverse call `/find`
  uses; extract too). Pre-filled with the stored spot when it has one.
- note: "Anyone signed in to ArchIt can see this design and the spot you pick."
- buttons: **Publish** (needs a pin) and **Publish without map pin**
  (gallery only). For Move pin: **Save pin**.
- Component: `components/PublishDialog.tsx`, map in its own dynamic
  (`ssr: false`) component like `Map3D`.

**`/showcase`.** Card grid: snapshot, name, author name, place (if any),
plot `W × D m`, published date. Cards link to `/showcase/[id]`. "Load more" via the cursor.
Empty state links to `/designer`. Add a nav entry next to Find/Designer in
`components/Navbar.tsx`.

**`/showcase/[id]` viewer.** Header with name, author, place, plot size,
"See on map" (→ `/find?design=<id>`, shown only when it has a location), and a
full-height builder iframe in **view mode**.

**Builder hardening first.** Other users' designs will now load into a
same-origin iframe, so the builder must escape every design-sourced string it
puts into HTML. That fix lives in `daff9fe` (open PR ankit1324/ArchIt#39,
branch `fix/audit-first-batch`), which also carries unrelated changes, so take
**only its builder file**: `git checkout daff9fe -- public/builder/builder.html`
as this branch's first commit (#39 is based on the same main commit, so the
file is exactly main + the fix, and merges with #39 cleanly). Then check that view mode adds no new
`innerHTML` paths for design data.

**Builder view mode** (`builder.html?embed=1&view=1`). Same init protocol
(`archit:init` with `design`, `plot`, `neighbors: []`, `facing`). In view mode:
hide the Save button and every editing tool/panel the builder exposes (toolbar
for adding/moving rooms, template picker, export/share); keep camera orbit,
floor switching, 2D/3D toggle, and Close. Mechanism is the builder's: a
`body.view` class with CSS hides plus a guard in the mutating handlers is
enough. Close posts `archit:close` with `dirty: false`. A reusable
`components/DesignViewer.tsx` wraps the iframe (modelled on
`DesignerOverlay.tsx`, minus save/template logic).

**`/find` map.**
- Fetch `/api/showcase?limit=200` alongside listings.
- Design pins: a distinct marker (snapshot thumbnail with an accent outline,
  no price) at `plotCenter`; no prisms.
- Layer toggle in the map controls: Listings · Designs · Both (default Both).
  Existing listing filters apply to listings only.
- Clicking a design pin opens a compact card (snapshot, name, author, plot
  size, "Open 3D") — "Open 3D" opens `DesignViewer` as an overlay on the map.
- `?design=<id>` on load flies to that design and opens its card.
- Search (`lib/find.ts`) also matches published design names and places; keep
  existing listing search behaviour and tests green.

**Listing form (`components/AddPropertyForm.tsx`).**
- Intent: Sale · Rent · Showcase only. Showcase hides the price field.
- "Attach a 3D design" select listing the user's **published** designs
  (from `/api/designs`, filtered client-side by `publishedAt`), with "None".
  If they have none, a hint linking to `/designer`. When editing a listing whose
  attached design is now unpublished, show it as "(unpublished — hidden from
  visitors)" and keep it selected unless the owner changes it.
- "Open first with": Photos · 3D (enabled only when a design is attached).

**Listing detail (`components/PropertyDetailPanel.tsx`).**
- If the listing has a design: tabs Photos · 3D design; initial tab =
  `defaultView`. The 3D tab shows the design snapshot with "Open 3D", which
  opens `DesignViewer`.
- `showcase` listings show "Showcase · not for sale/rent" instead of a price,
  and keep the Contact owner button.
- Filters (`components/FilterSidebar.tsx`, `lib/find.ts`): type filter gains
  Showcase; `formatPrice` in `lib/types.ts` returns "Showcase" for that type;
  price-range filtering and price sorting ignore showcase listings' 0 price
  (they pass the price filter, sort last on price sorts).

## Author name

At publish time the route reads the Clerk user (`clerkClient().users.getUser`)
and stores `firstName`, else `username`, else `"ArchIt user"`. Never the email.
Stored, not looked up per request, so the showcase is one query.

## Security notes

- Every new read of other users' data goes through the `PublishedDesign`
  projection; a unit test asserts it drops `user_id` and `meta`.
- Ownership + published checks for `designId` happen server-side; the client
  filter in the form is convenience only.
- Snapshots are already public Storage URLs; no Storage change.
- `connect-src`/`img-src` in `lib/csp.ts` should already cover Storage URLs;
  verify the viewer iframe works under the builder's static CSP from
  `next.config.ts`.

## Testing

`node --test` imports `lib/*.ts` directly, so keep logic pure and in `lib/`:
- `lib/showcase.ts`: row → `PublishedDesign` projection (drops private
  fields), cursor/limit parsing.
- Listing presentation validation (intent/price/designId/defaultView rules),
  given a stub "design lookup" result.
- `lib/find.ts`: showcase type filter, price filter/sort with showcase
  listings, design-name search.
Plus `npx tsc --noEmit` and `npm run lint`. Browser-check `/showcase`,
the viewer, and `/find` pins locally if the dev env (Clerk + Supabase keys)
is available; say so if it is not.

## Launch note (for the user, not code)

Production runs a Clerk **development** instance (`pk_test_…`), which caps
users. Before inviting real users to a shared showcase, create a Clerk
production instance and swap the Vercel env keys. Also apply the new
migration to the production Supabase project.

## Calls made by the designer of this spec (not discussed with the user)

- Showcase is signed-in only (consistent with the rest of the app).
- Viewer is the builder in a view mode rather than a separate three.js viewer.
- Author shown by first name; budget/notes (`meta`) stay private.
- Only published designs can be newly attached to a listing; unpublishing
  hides the 3D tab from visitors without detaching it, and editing the listing
  keeps the attachment (PUT: absent `designId` = keep).
- `showcase` listings store price 0.
- `/find` loads up to 200 located published designs, no bbox query yet.
- A design's pin is independent of any listing it is attached to (it can
  appear once as its own design pin and again inside a listing).
- `place` column for a readable location label; editing a design in the
  builder never moves its pin.
- Builder escaping fix taken from `daff9fe`'s builder file only, rather than
  waiting for PR #39 to merge.

## Build order (for parallel work)

1. Foundation (sequential, one agent): builder file from `daff9fe`; migration; types
   (`PublishedDesign`, `Design.publishedAt`, listing fields); `lib/showcase.ts`
   and listing-validation helper with tests; all API routes; `proxy.ts`
   matcher.
2. Then in parallel, disjoint files:
   - (a) Designer: `PublishDialog` + map picker + designs-list controls
     (`app/designer/page.tsx`, new components, shared Nominatim helper in `lib/`).
   - (b) Showcase: `/showcase`, `/showcase/[id]`, `DesignViewer`, builder view
     mode (`public/builder/builder.html`), Navbar link.
   - (c) Find + listings: design pins and layer toggle (`Map3D`, `MapControls`,
     `app/find/page.tsx`), `lib/find.ts`, `FilterSidebar`, `AddPropertyForm`,
     `PropertyDetailPanel` (uses `DesignViewer` from (b) — (c) imports it by
     the agreed props `{ designId, onClose }`; (b) owns the file).
   (a) and (c) both need the Nominatim helper: (a) creates `lib/geocode.ts`;
   (c) may switch `/find` to it after (a) lands, or leave `/find` as is.
3. Integrate, `npm test`, `npx tsc --noEmit`, `npm run lint`, browser check,
   one PR.
