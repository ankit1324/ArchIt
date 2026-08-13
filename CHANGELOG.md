# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

`main` is squash-merged from 0.1.0 onward, so entries map to one squashed commit
each. Some history predating the branch ruleset came in as merge commits.

## [Unreleased]

## [0.1.0] - 2026-08-13

First tagged release. Everything below already exists in `main`; this entry
describes the state of the app at the point it was given a version, not a batch
of new work.

### Added

- **Find** (`/find`) — 3D map property search on MapLibre GL 5 with OpenFreeMap
  tiles (no map vendor key). Listings render as extruded buildings; filters for
  type, price, beds, and area. Panels layer above the carousel and controls.
- **Designer** (`/designer`) — browser house builder: real house geometry,
  stacked floors, roofs, materials, image-based lighting, exterior presets, and
  a template picker. Ships as a standalone Three.js page in `public/builder/`
  and is embedded as an iframe.
- **Landing page** (`/`) — marketing page with mobile-responsive nav and demo
  reels for the suite, autoplayed muted and looping.
- **Property listings** — upload with multiple photos, Supabase Storage
  `photos` bucket, per-listing owner, and a `featured` flag.
- **Payments** via Razorpay, with the fee table server-side in `lib/fees.ts`:
  contact owner unlock, featured listing boost, one-time builder unlock, and
  per-template unlock. Clients send a purpose, never an amount.
- **Purchases ledger** — every payment is persisted, and entitlements
  (including `builder_unlock` and whether a listing is featured) are derived
  from the ledger rather than trusted from the client. Webhook handling for
  Razorpay events.
- **Template catalog** — server-side, with a per-template paywall and a
  checkout bridge from the builder.
- **Auth** via Clerk; middleware in `proxy.ts`.
- **Privacy and terms pages**, a site footer, and route-level error boundaries.
- **Keepalive cron** (`/api/keepalive`) that keeps the Supabase project warm,
  running daily and authorized by `CRON_SECRET`.
- **Database migrations** in `supabase/migrations/` — properties, designs and
  design metadata, purchases with hardening and indexes, `properties.featured`,
  `user_id` columns for listings and designs, and photo storage rules.
- **Tests** on `node --test`, no test framework: payment validation, checkout
  unlock, and purchase write retry.
- **CI** (`.github/workflows/ci.yml`) — type check, lint, tests, and a
  production build on every pull request and on pushes to `main`, with Node
  pinned by `.nvmrc`, least-privilege permissions, and stale runs cancelled.
- **Branch protection** for `main`, checked in as
  `.github/rulesets/main-protection.json`, plus `.github/CODEOWNERS` covering
  money paths, migrations, and CI.
- **Project docs** — README describing the real surfaces, stack, environment,
  and design decisions; MIT license; `.env.example` covering all nine
  variables.

### Security

- Row Level Security enabled with zero policies on every table, so the anon and
  publishable keys can read nothing. All data access goes through server routes
  holding the secret key, which stamp `user_id` from the Clerk session and never
  from the request body.
- Property ownership enforced server-side, and data behind the paywalls is
  withheld until the ledger says otherwise.
- Content Security Policy and `Permissions-Policy` response headers.
- Payment capture is verified server-side before entitlements are granted, with
  double-charge detection and a guard against a failed verify being treated as
  success.
- Image validation on listing uploads.

### Fixed

- `lib/db.ts` constructs the Supabase client lazily behind a `Proxy`. A
  module-scope client threw `supabaseUrl is required` during `next build`, which
  evaluates every route module to collect page data.
- The `designs.user_id` migration is replay-safe.
- Keepalive bypasses Vercel deployment protection, which was silently failing
  the cron.
- Cleared the react-hooks and `next/link` lint errors that were blocking CI.

[Unreleased]: https://github.com/ankit1324/ArchIt/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/ankit1324/ArchIt/releases/tag/v0.1.0
