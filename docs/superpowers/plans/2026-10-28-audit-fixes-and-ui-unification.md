# Audit fixes + one visual language — Implementation Plan

> **For agentic workers:** you implement ONE task from this file, named in your prompt. Read "Global Constraints" and, for UI tasks, "Design Language" first. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Fix every verified gap from the 2026-10-28 repo audit, and bring every page onto the landing page's "practical planner" visual language, so the suite looks like one product.

**Architecture:** Backend fixes stay inside the existing patterns: pure modules or `createX(deps)` factories with thin live wiring (see `lib/record-purchase.ts` + `lib/purchases.ts`, `lib/create-order.ts` + `app/api/create-order/route.ts`), tested with `node --test`. The visual change is token-first: `app/globals.css` now maps the old token names (`plum`, `cream`, `coral`, ...) onto the planner palette and exposes semantic names (`ink`, `paper`, `accent`, ...); each UI task then reworks layout and type in its own files.

**Tech Stack:** Next.js 16.4 (App Router, Turbopack, `proxy.ts`), React 19, TypeScript, Tailwind CSS 4, Supabase (service-role key, RLS deny-all), Clerk, MapLibre 6, Three.js builder (`builder/src` → `public/builder/js` via esbuild), `node --test`.

**Spec:** the audit report in the session (findings are restated per task below).

## Global Constraints

- Work only in `/Users/ankit/Developer/myProject/3d-map`, on the already-checked-out branch `sweep/audit-fixes-and-ui`.
- **Git is read-only for you:** no `git add/commit/stash/checkout/switch/restore/reset/branch/push/merge/rebase`. `git status` / `git diff` are fine.
- Edit only the files your task lists (plus new files it names). Other agents are editing other files at the same time. If you need a change outside your list, describe it in your report instead.
- Never edit `app/globals.css`, `app/layout.tsx`, `components/icons.tsx` (already updated by the orchestrator), `package.json`, `package-lock.json`, `.gitignore`.
- No new npm dependencies. Scratch tools go in a temp dir outside the repo (`mktemp -d`).
- Do not run `next build`, `npm run build`, `npm run dev` or `next dev`. A dev server is already running at http://localhost:3000; use it for visual checks.
- No remote side effects: no `supabase db push`, no `vercel`, no `gh`, no requests that write to the production database.
- Never open or print `.env.local`.
- Type check with `npx tsc --noEmit --incremental false`. Lint your own files with `npx eslint <files>`. Run `npm test`. Errors in files you do not own are other agents' work in progress: ignore them, but leave none in yours.
- Backend tasks are TDD: write the failing test, run it and see it fail for the right reason, implement, see it pass.
- Next.js 16 differs from older versions. Before adding a file convention (`error.tsx`, `loading.tsx`, ...) read its page under `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/`. In 16.4 an error boundary receives `{ error, retry }` (`retry` became stable in 16.3; `unstable_retry` no longer exists at runtime).
- Match the surrounding code style: comments explain *why*, 2-space indent, double quotes, `.ts` extension imports inside `lib/` modules that tests import directly.
- Report back in under 250 words: files changed, tests added (names), the exact verification commands you ran with their pass/fail counts, and anything you could not do.

## Design Language (UI tasks)

Reference implementation: `components/MarketingLanding.tsx` + `components/MarketingLanding.module.css`. Read both before changing anything. Tokens live in `app/globals.css` (read it; do not edit it).

- **Surfaces:** page `bg-paper` (#f8f7f2). Bands and cards `bg-paper-soft`, or the landing's card tints `bg-[#f0f0e7]` (neutral), `bg-[#eee5d9]` (warm), `bg-[#e7ece4]` (sage) for variety. Dark band `bg-forest` with `text-paper`.
- **Ink:** `text-ink` for headings and body, `text-ink-soft` for secondary text, `border-line` hairlines, `border-line-strong` for outlined controls.
- **Accent:** primary CTA `bg-accent text-paper hover:bg-accent-deep`; `text-accent` for links, emphasis and errors. One primary CTA per view.
- **Type:** headings `font-display` (Fraunces) at `font-normal`/`font-medium` with tight tracking; never bold Fraunces. Text is Manrope (the default `font-sans`). Paragraphs 14–16px, never below 14px. Eyebrows/labels: 11px, uppercase, `tracking-[0.14em]`, `font-bold`, `text-ink-soft` (the landing's `.eyebrow`, optionally with the 6px accent dot). Prices and counts `tabular-nums`.
- **Shape:** squarer than before. Buttons, inputs and cards `rounded-[5px]`–`rounded-md`. Pills (`rounded-full`) only for small chips, toggles, avatars and floating map/canvas controls. Prefer 1px hairline borders to shadows; shadows only on elements floating over the map or canvas (`shadow-[0_18px_35px_-24px_rgb(41_55_44/0.45)]`).
- **Buttons:** primary as above, `px-5 py-3 text-[13px] font-semibold`, optional trailing `↗` (`aria-hidden`). Secondary: `border border-line-strong text-ink hover:border-ink`, or an underlined text link (`underline-offset-4`). Touch targets ≥44px for primary controls, ≥24px for text links (WCAG 2.5.8).
- **Focus:** always visible: `focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-accent`.
- **Motion:** subtle, CSS only, at most one staged reveal per page, and none under `prefers-reduced-motion`. No autoplay.
- **Brand:** `LogoMark` from `components/icons.tsx` + "ArchIt" + a terracotta "." (see the landing header).
- **Copy:** plain and short, sentence case. Do not invent features, prices or promises. Legal pages: restyle only, never reword.
- **Accessibility:** AA contrast (ratios are in the token comments), labels on inputs, alt text, `aria-label` on icon-only buttons, one `h1` and a `main` landmark per page, keyboard reachable.
- **Responsive:** check 390×844 and 1440×900.
- **Scrolling:** the document scrolls natively now (`html`/`body` no longer have `overflow:hidden`). Content pages drop their `h-full overflow-y-auto` wrapper. Full-screen app roots (`/find`, `/designer`) carry the class `app-shell`, which locks document scroll while they are mounted.
- **No hex literals for palette colours:** use the token classes. Replace leftover old-palette literals in your files: `#3d1830`, `#6b4560`, `#f5f1ea`, `#efe9df`, `#f0483e`, `#e2ef6a`, `#ccdb2a`, `#e857c2`, `#b5359a`, `#b18cf0`, `rgb(61 24 48 / x)`, `rgb(245 241 234 / x)`. Where a literal is unavoidable (MapLibre paint properties, OG images, `global-error.tsx`), use the planner hex values from `app/globals.css`.
- **Behaviour is frozen:** restyle and restructure markup, but keep every handler, fetch, prop, route, analytics event and test-visible export working as before.

---

## Backend tasks

### Task T1: Database: explicit grants, constraints, indexes

**Why:** From 2026-10-30 Supabase stops auto-granting new `public` tables to `service_role` (the only role the app uses), so a table created without `GRANT` returns `42501`. No migration has a grant today.

**Files:**
- Create: `supabase/migrations/20261028120000_explicit_service_role_grants.sql`, `supabase/migrations/20261028120100_audit_design_target_and_order_purpose.sql`, `supabase/migrations/20261028120200_listing_and_order_indexes.sql`, `supabase/seed.sql`, `tests/migrations.test.mjs`
- Modify: `app/api/admin/designs/[id]/route.ts`, `lib/admin-audit.ts`
- Delete: the empty untracked directory `db/` (it only holds an empty `db/init.sql/` directory; use `rmdir`, never `rm -rf`)

- [ ] Write `tests/migrations.test.mjs` (reads every `supabase/migrations/*.sql` in filename order) with tests:
  - `every public table enables row level security`
  - `every public table is granted to service_role in the same or a later migration`
  - `every function is executable by service_role`
  - `no migration grants to anon or authenticated, or creates a policy on a public table` (storage-schema statements are out of scope; check what `20260711121000_photos_storage.sql` does and keep the test honest)
- [ ] Run `node --test tests/migrations.test.mjs`; the grant tests fail.
- [ ] Grants migration: `GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.<t> TO service_role;` for `properties, designs, purchases, payment_orders, rate_limits, listing_reports, admin_audit_log, contact_messages`; `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;`; `GRANT EXECUTE ON FUNCTION public.rate_limit_hit(text, integer, integer) TO service_role;`. Idempotent; nothing to `anon`/`authenticated`. A header comment explains the 2026-10-30 change and that every future `CREATE TABLE` needs its grant (the test enforces it).
- [ ] Constraint migration: `admin_audit_log.target_type` CHECK gains `'design'` (find the real constraint name in the 20261024120000 migration; drop and re-add). `payment_orders.purpose` gains a CHECK for exactly `contact_owner, featured_property, builder_unlock, template_unlock` (match `purchases_purpose_chk` style; `NOT VALID` + `VALIDATE` is fine).
- [ ] Index migration, after reading the hot queries in `lib/properties.ts`, `lib/listing-query.ts`, `lib/moderation.ts` (`onlyLive`), `lib/public-listings.ts` and `app/api/cron/reconcile/route.ts`:
  - a partial index serving the public listing query (`status = 'live'` plus its bbox/order/cursor columns), shaped to the query you read;
  - `CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;` and a GIN trigram index on `properties.city` (partial on live) for the `ILIKE 'city%'` in `listMoreInCity`;
  - `payment_orders (checked_at NULLS FIRST, created_at) WHERE status = 'open'` for the reconciler;
  - `DROP INDEX IF EXISTS properties_user_idx;` (a prefix of `properties_user_created_idx` with the same predicate; confirm that before dropping).
  - Use `IF NOT EXISTS` everywhere. Do not index `designs.snapshot` or the photo columns.
- [ ] `supabase/seed.sql`: a comment-only file saying there is no seed data (config.toml has `[db.seed] enabled = true` and the file was missing). Do not edit `config.toml`.
- [ ] `app/api/admin/designs/[id]/route.ts`: log the unpublish as `targetType: "design"`, `targetId` = the design id, author id in `details`; delete the comment that explains the old workaround. Add `"design"` to the target-type union in `lib/admin-audit.ts`. Do not touch `app/admin/**` (Task U8 renders it).
- [ ] Validate the SQL for real: in a `mktemp -d` dir, `npm init -y && npm i @electric-sql/pglite`, then a script that stubs what Supabase provides (roles `anon`, `authenticated`, `service_role`; schemas `storage` with `storage.buckets`/`storage.objects` as the photos migration needs, and `extensions`; load the `pg_trgm` contrib from `@electric-sql/pglite/contrib/pg_trgm`) and applies all 19 migrations in order. Every migration must apply cleanly. Report the result.
- [ ] `node --test tests/migrations.test.mjs` passes; `npm test` passes.

### Task T2: Payment integrity

**Findings:** (1) `lib/record-purchase.ts:163` copies `orderId` from the payment and `checkPayment` compares it with itself, so nothing ties a paid payment to the `payment_orders` row create-order wrote. (2) create-order sells `contact_owner` for listings that are not live (the `lookupProperty` select has no `status`). (3) The reconciler checks 40 orders per daily run (`RECONCILE_BATCH`), so a backlog ages past the 30-day window unchecked. (4) `logOrder` failure is non-fatal, so a checkout can exist without its order row.

**Files:**
- Modify: `lib/record-purchase.ts`, `lib/purchases.ts`, `lib/payment-validation.ts` (only if needed), `lib/create-order.ts`, `lib/purchase-rules.ts`, `app/api/create-order/route.ts`, `lib/reconcile.ts`, `app/api/cron/reconcile/route.ts`, `app/api/verify-payment/route.ts` (only if needed)
- Test: `tests/record-purchase.test.mjs`, `tests/purchase-rules.test.mjs`, `tests/create-order.test.mjs`, `tests/reconcile.test.mjs`, `tests/payment-validation.test.mjs`

**Interfaces:**
- Keep `recordPurchase(paymentId, fallbackUserId?, options?)` and its `PurchaseFailure | null` contract unchanged; the webhook route (Task T4's file) acknowledges statuses 202/400/402/409 and retries 5xx.
- New `RecordPurchaseDeps.loadOrder(paymentId: string): PromiseLike<{ data: { order_id: string; user_id: string; purpose: string; ref: string | null; amount: number } | null; error: { message: string } | null }>`, wired in `lib/purchases.ts` as a `payment_orders` select by `payment_id` (`maybeSingle`).

- [ ] Tests first (record-purchase): `refuses a payment with no payment_orders row` (400, reports `payment_order_missing`, nothing inserted); `refuses when the order row disagrees with the payment` (one case each for order_id, user_id, purpose, ref, amount; 400, reports `payment_order_mismatch`); `answers 503 when the order lookup fails` (nothing inserted); existing happy-path tests updated to supply a matching row.
- [ ] Implement: load the row after the metadata checks; pass `orderId: order.order_id` into `checkPayment` so its order check compares two independent values.
- [ ] Tests first (purchase-rules, create-order): `contact_owner requires a live listing` (pending/rejected → refused with a clear error, no checkout opened); `featured_property` behaviour unchanged; `a failed order log aborts the checkout` (503 `order creation failed`, no checkoutUrl returned).
- [ ] Implement: `lookupProperty` selects `status`; `PurchaseRefProperty` carries it; `validatePurchaseRef` checks it for `contact_owner`; a `logOrder` error or throw now returns 503 instead of continuing.
- [ ] Tests first (reconcile): `keeps sweeping batches until the backlog is empty`; `stops at the time budget and reports reconcile_backlog`; `reports reconcile_backlog when an open order older than 24h remains`. Inject the clock (`deps.now`) so tests are deterministic.
- [ ] Implement: loop `sweepOrders` in batches of `RECONCILE_BATCH` until a batch comes back short or a time budget (`RECONCILE_BUDGET_MS = 45_000`) is spent; then report `reconcile_backlog` (via `deps.report`) if the budget ran out or the oldest open order is past 24h. In the cron route add `export const maxDuration = 60;` (Vercel Hobby crons run once a day, so throughput has to come from looping, not from a tighter schedule).
- [ ] `npm test` passes.

### Task T3: Listings and uploads

**Findings:** (1) `app/api/upload/route.ts:91` stores the original photo with its EXIF (GPS, device serial) in the public bucket; only thumbnails are re-encoded. (2) `app/api/properties/[id]/route.ts:106` ignores the error on the read of the previous row, so a transient DB error silently detaches the design, resets `default_view` and re-queues review. (3) `lib/db.ts:235` `attachedDesigns` puts up to 1,000 ids in one `.in()` URL.

**Files:**
- Create: `lib/image-sanitize.ts`, `lib/chunk.ts`, `tests/image-sanitize.test.mjs`, `tests/chunk.test.mjs`
- Modify: `app/api/upload/route.ts`, `app/api/properties/[id]/route.ts`, `lib/db.ts` (only `attachedDesigns`), `lib/upload.ts` (only if needed)

- [ ] Tests first: `strips EXIF and GPS from a JPEG` (build a JPEG with EXIF via sharp's `withExif`/`withMetadata`, run the sanitizer, assert `metadata().exif` is undefined); `applies EXIF orientation before stripping` (orientation 6 input → width/height swapped, no orientation tag); `keeps the format` for every type `detectImageType` accepts; `chunk splits into fixed-size groups` and `chunk of an empty list is empty`.
- [ ] Implement `sanitizeImage(buf: Buffer, mime: string): Promise<Buffer>` in `lib/image-sanitize.ts` (sharp via `lib/sharp.ts` if that module is importable from tests, else `sharp` directly; `limitInputPixels` same as the upload route; `.rotate()`, re-encode in the same format at high quality, no `withMetadata`). The upload route stores `sanitizeImage(buf, mime)` instead of `buf` and derives thumbnails from the sanitized buffer.
- [ ] Implement `chunk<T>(items: readonly T[], size: number): T[][]` and use it in `attachedDesigns` with 100 ids per query, run in parallel, merged into the same `Map`.
- [ ] PUT `/api/properties/[id]`: destructure `error` from the previous-row read; on error log and return 500 `internal error` before any write.
- [ ] `npm test` passes.

### Task T4: API hardening

**Findings:** (1) design writes (`POST /api/designs`, `PUT`/`DELETE /api/designs/[id]`) are the only write routes without a rate limit. (2) A NUL (`\u0000`) in a contact message or report `details` passes validation and 500s at Postgres. (3) `/api/webhooks/youpi` reads an unbounded body before checking the signature. (4) `ipKey` trusts the first `X-Forwarded-For` entry, which the client controls unless a proxy rewrites it. (5) `rate_limits` is never pruned.

**Files:**
- Create: `lib/client-ip.ts`, `tests/client-ip.test.mjs`
- Modify: `app/api/designs/route.ts`, `app/api/designs/[id]/route.ts`, `lib/contact.ts`, `lib/moderation.ts` (only `validateReport`), `app/api/webhooks/youpi/route.ts`, `lib/rate-limit.ts`, `app/api/keepalive/route.ts`
- Test: `tests/contact.test.mjs`, `tests/moderation.test.mjs`, `tests/client-ip.test.mjs`

- [ ] Tests first: `contact rejects NUL in name, email and message`; `report rejects NUL in details` (400-style validation errors, not throws); `clientIp prefers x-vercel-forwarded-for, then x-real-ip, then the last X-Forwarded-For hop`; `clientIp ignores blank and garbage values`; `clientIp falls back to "anonymous"`.
- [ ] `lib/client-ip.ts` is pure (no `server-only`, no db) and exports `clientIp(headers: Headers): string`; `ipKey` in `lib/rate-limit.ts` uses it. Explain in a comment why the last hop (the one our proxy appended) is used rather than the first.
- [ ] Design writes: `checkRateLimit(ipKey(request, "designs-write", userId), 30, 60_000)` after the auth check in all three handlers, answering `rateLimitedResponse()`.
- [ ] Webhook: read the body with `readBodyCapped` from `lib/request.ts` (64 KiB) before the HMAC check; an oversized body answers 413 and is never hashed. Keep the signature over the exact raw bytes.
- [ ] Prune: `pruneRateLimits()` in `lib/rate-limit.ts` deletes rows whose `window_start` is older than 24h (longer than every window in use: grep `checkRateLimit(` to confirm the longest). The daily `/api/keepalive` cron calls it after its ping; failure is logged and never fails the keepalive. Keep `isCronRequest` auth first.
- [ ] `npm test` passes.

### Task T5: Tooling and docs

**Findings:** `npm run lint` hangs locally (ESLint crawls `.claude/worktrees`, 20 worktrees / 15 GB) and lints the generated MapLibre worker (1,103 warnings). `scripts/check-marketing-landing.mjs` fails and nothing runs it. README line 32 is wrong about signed-out behaviour, its env table misses 9 variables, and it lists `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, which no code reads. `.nvmrc` says `22` but tests need ≥22.18. `app/sitemap.ts` has a stale comment; `app/robots.ts` does not disallow `/admin`.

**Files:**
- Modify: `eslint.config.mjs`, `.nvmrc`, `README.md`, `.env.example`, `.github/workflows/ci.yml` (build env only), `app/sitemap.ts` (comment only), `app/robots.ts`
- Delete: `scripts/check-marketing-landing.mjs`
- Do not touch `package.json`; if `scripts/check-templates.mjs` or `scripts/audit-template-issues.mjs` deserve npm scripts, say so in the report with their real output.

- [ ] `eslint.config.mjs`: add `.claude/**`, `.playwright-mcp/**` and `public/vendor/**` to `globalIgnores`, with a one-line reason each. Verify `time npm run lint` finishes and report the time and warning count.
- [ ] `.nvmrc`: `22.23.2` (the local Node; ≥22.18 for type stripping; CI's `setup-node` reads this file).
- [ ] README: correct line 32 (signed-out visitors to Find/Designer/Dashboard/Admin are redirected to sign-in; protected APIs answer `401` JSON, see `proxy.ts`); bring the Environment table in line with `.env.example` (add `SENTRY_DSN`, `ALERT_WEBHOOK_URL`, `ADMIN_USER_IDS`, `ADMIN_EMAILS`, `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_VERCEL_ANALYTICS`; drop `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`); in "Running it locally" say Node 22.18+ is the floor and `.nvmrc` pins the version CI uses. Keep the README's voice; no new sections beyond what these facts need.
- [ ] `.env.example` and `ci.yml`: remove `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- [ ] `app/sitemap.ts`: drop the stale "ship in PR #47" remark. `app/robots.ts`: disallow `/admin`.
- [ ] Run `node scripts/check-templates.mjs` and `node scripts/audit-template-issues.mjs`; report pass/fail.
- [ ] `npm run lint` (0 errors), `npx tsc --noEmit --incremental false`, `npm test`.

### Task T6: Tests for untested money/auth modules

**Files:**
- Create: `tests/cron-auth.test.mjs`, `tests/entitlements.test.mjs`, `tests/youpi-client.test.mjs`, `tests/storage.test.mjs`
- Modify (test seams only, no behaviour change): `lib/cron-auth.ts`, `lib/entitlements.ts`, `lib/youpi.ts`, `lib/storage.ts`

- [ ] Read each module. Where it imports `server-only` or `./db`, move its logic into a factory (`createEntitlements(deps)`, ...) or a sibling module without those imports, keep the live wiring and every existing export name and signature, the way `lib/record-purchase.ts`/`lib/purchases.ts` are split.
- [ ] Cover at least: cron auth (missing secret → false; wrong/short/long bearer → false; correct → true); entitlements (owned/not owned/DB error mapping, `hasBuilderUnlock` with the paywall on and off, `builderUnlockError` responses); YouPI client with a stubbed `fetch` (merchant headers present, gateway error → `YoupiError` with status, timeout → `isTimeout`, non-JSON body handled); `removeUnreferencedUploads` (deletes only unreferenced objects plus their thumbnails, swallows storage errors, ignores foreign URLs).
- [ ] `npm test` passes.

## UI tasks

All UI tasks follow "Design Language". Each must keep `npx tsc --noEmit --incremental false` clean for its files, lint its files, keep `npm test` green, and screenshot its pages at 1440×900 and 390×844 from http://localhost:3000 when browser tools are available. Signed-in pages redirect to sign-in in your browser; verify those by reading the code carefully (the orchestrator reviews them signed in).

### Task U1: Shell (header, footer, auth, error and loading states)
- Files: `components/Navbar.tsx`, `components/Footer.tsx`, `components/NavAuth.tsx`, `components/ClerkNavAuth.tsx`, `components/Celebration.tsx`, `app/error.tsx`, `app/global-error.tsx`, `app/not-found.tsx`, `app/(app)/loading.tsx`, `app/(app)/layout.tsx` (Clerk `appearance` only), `app/(app)/sign-in/**`, `app/(app)/sign-up/**`; create `app/(app)/error.tsx`.
- `Navbar` gains `variant?: "site" | "app"` (default `"site"`). `site`: the landing header's look (logo + terracotta dot, 12–13px semibold links, outlined sign-in, hairline bottom border) with a working mobile menu (it has none today). `app`: compact 64px bar for `/find` and the dashboard. Other tasks pass `variant="app"`; keep the default export and no other required props.
- `Footer`: the landing footer's look, keeping its links (Pricing, Privacy, Terms, Refunds, Contact) and the year.
- **Bug:** `app/error.tsx` and `app/global-error.tsx` destructure `unstable_retry`, which Next 16.4 no longer passes (it passes `retry`), so "Try again" throws. Use `retry`. `global-error.tsx` renders its own `<html>`; keep it self-contained.
- Clerk `appearance` on `ClerkProvider`: Manrope, ink text, accent primary, 5px radius.

### Task U2: Landing polish
- Files: `components/MarketingLanding.tsx`, `components/MarketingLanding.module.css`, `components/LandingNav.tsx`, `components/TrackedLink.tsx` (only if needed), `app/page.tsx`, `app/opengraph-image.tsx`.
- Keep the design. Raise paragraph text to ≥14px (section intros, steps, FAQ answers, starter details, captions); eyebrows stay 11px. Scroll the document instead of `.page` (`min-height:100%`, no `overflow:auto`; move smooth scrolling and the anchor offset to the document, e.g. `:global(html):has(.page)`). Footer nav adds Pricing and Contact. Make sure `app/opengraph-image.tsx` uses the planner palette.

### Task U3: Pricing, contact, legal pages
- Files: `app/pricing/page.tsx`, `app/contact/page.tsx`, `app/contact/ContactForm.tsx`, `app/(site)/privacy/page.tsx`, `app/(site)/terms/page.tsx`, `app/(site)/refunds/page.tsx`.
- Editorial layouts in the landing's voice: eyebrow + Fraunces `h1`, cards like the landing's starter cards, readable long-form typography for legal pages (measure ~68ch, 15–16px, Fraunces section headings). Contact form: labelled fields, clear focus, error and success states. Remove `h-full overflow-y-auto` wrappers. Keep all copy and logic (`PAYWALL_ENABLED` branches, form submission, honeypot).

### Task U4: Showcase and public property pages
- Files: `app/(site)/showcase/**`, `app/(site)/property/[id]/**`, `components/ShowcaseGallery.tsx`, `components/ShareButtons.tsx`, `components/DesignViewer.tsx`; create `loading.tsx` for `showcase` and `property/[id]`.
- Production has no published designs and no live listings right now, so the empty states are what visitors see: make the showcase empty state inviting, with a clear route into the designer. Keep data fetching, metadata, `notFound()` and OG image logic.

### Task U5a: Find, map and controls
- Files: `app/(app)/find/FindClient.tsx`, `app/(app)/find/find.module.css`, `app/(app)/find/page.tsx`, `components/Map3D.tsx`, `components/map.css`, `components/MapControls.tsx`, `components/SearchBar.tsx`, `components/FilterSidebar.tsx`, `components/PriceHistogram.tsx`, `components/BottomSheet.tsx`, `lib/design.ts` (colour literal only).
- Root gets `app-shell`; pass `variant="app"` to `Navbar`. Re-colour MapLibre markers/layers to the planner palette (hex, since paint properties cannot read CSS variables). Restyle panels and controls; map behaviour unchanged.

### Task U5b: Find, cards, detail panel and listing form
- Files: `components/PropertyCard.tsx`, `components/PropertyCarousel.tsx`, `components/PropertyDetailPanel.tsx`, `components/DesignPinCard.tsx`, `components/AddPropertyForm.tsx`, `components/PinPickerMap.tsx`.
- Restyle in the planner language; replace old-palette literals; give the photo-preview `<img alt="">` in `AddPropertyForm.tsx` (lines ~428/443) a meaningful alt. Behaviour unchanged.

### Task U6: Signed-in dashboard
- Files: `components/SuiteDashboard.tsx`, `components/MobileTabBar.tsx`, `app/(app)/dashboard/**` (keep `listing-status.ts` behaviour; `tests/me.test.mjs` imports it).
- Pass `variant="app"` to `Navbar`. Drop SuiteDashboard's own Fraunces `localFont` (the root layout now provides `--font-fraunces` and `font-display`). Restyle cards, product tiles, "my stuff" lists and status chips.

### Task U7: Designer shell and builder chrome
- Files: `app/(app)/designer/page.tsx`, `components/DesignerOverlay.tsx`, `components/PublishDialog.tsx`, `public/builder/builder.html`, `lib/csp.ts` (builder CSP only), `tests/builder-csp.test.mjs`, colour-only edits in `builder/src/*.js`; create `public/builder/fonts/` (copy of `assets/fonts/manrope-latin-wght-normal.woff2` + its licence).
- Designer root gets `app-shell`. Re-theme `builder.html`'s `:root` variables to the planner palette (blue primary → forest/ink for selection and toggles; pink → accent; neutral greys → warm paper/line tones; ink-tinted shadows). Self-host Manrope via `@font-face` and remove the Google Fonts `<link>`s, then drop the Google Fonts origins from the builder CSP if present and update its test. Only chrome colours change in `builder/src` (selection highlights, 2D plan UI strokes), never geometry or behaviour; rebuild with `node scripts/build-builder.mjs` and keep `tests/builder-*.test.mjs` green. Check `/builder/builder.html` visually.

### Task U8: Admin
- Files: `app/admin/**`; create `app/admin/loading.tsx` and `app/admin/error.tsx`.
- Restyle in the planner language (dense but calm: hairline tables, eyebrow labels, tabular numbers). **A11y bug:** `app/admin/listings/[id]/ListingEditForm.tsx:186-196` photo checkboxes have no accessible name (their label only holds `<img alt="">`). `admin_audit_log.target_type` gains `'design'` (Task T1; `targetId` is the design id): render it in `app/admin/log/page.tsx`.

## Review Focus

- A payment that is SUCCESS at the gateway but whose `payment_orders` row is missing or different must never be recorded, and must page someone (T2).
- A webhook flood with oversized bodies must be rejected before any hashing (T4).
- A content page longer than the viewport must scroll on iOS Safari, and `/find` must not rubber-band (U1–U7, `app-shell`).
- Every focusable control keeps a visible focus ring on paper, paper-soft and forest backgrounds (all UI tasks).
- A migration that adds a table without its `service_role` grant must fail `npm test` (T1).
