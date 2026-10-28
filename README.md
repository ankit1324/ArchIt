<div align="center">

# ArchIt

**Find a property on a 3D map, then design the house that goes on it — in the browser.**

[**Live app →**](https://archit.chaudharyankit.in)

[![CI](https://github.com/ankit1324/ArchIt/actions/workflows/ci.yml/badge.svg)](https://github.com/ankit1324/ArchIt/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)

</div>

---

Most property sites hand you a photo gallery and a floor plan drawn in 2004. ArchIt
puts listings on a real 3D basemap you can fly through, and then lets you build the
house on the plot you just looked at — massing, roofs, materials, lighting — without
installing anything.

## What's in it

| Surface | Route | What it does |
| --- | --- | --- |
| Landing | `/` | Marketing page and demo reels for the suite |
| **Find** | `/find` | 3D map property search — pan, tilt, filter by type, price, beds, area. Listings render as extruded buildings on the basemap. |
| **Designer** | `/designer` | Browser house builder. Place a plot, stack floors, cut openings, apply materials, save designs to your account. |

The [live app](https://archit.chaudharyankit.in) is the fastest way to see it. Find,
Designer, the dashboard and the admin area sit behind a session: signed-out visitors
are redirected to sign-in, and the protected APIs answer `401` JSON instead (see
[`proxy.ts`](proxy.ts)).

## How it fits together

```mermaid
flowchart TB
    subgraph browser["Browser"]
        landing["/ landing"]
        find["/find<br/>MapLibre GL"]
        designer["/designer<br/>iframe shell"]
        builder["public/builder/builder.html<br/>Three.js"]
        designer -.embeds.-> builder
    end

    tiles["OpenFreeMap<br/>vector tiles"]
    find -->|"basemap"| tiles

    gate{"proxy.ts<br/>clerkMiddleware"}
    landing --> gate
    find --> gate
    designer --> gate

    subgraph server["Next.js server routes"]
        propsApi["/api/properties"]
        designsApi["/api/designs"]
        payApi["/api/create-order<br/>/api/verify-payment"]
        hook["/api/webhooks/youpi"]
        upload["/api/upload"]
    end

    gate -->|"session required"| propsApi
    gate -->|"session required"| designsApi
    gate -->|"session required"| payApi
    gate -->|"session required"| upload

    db["lib/db.ts<br/>lazy client, secret key"]
    propsApi --> db
    designsApi --> db
    payApi --> db
    hook --> db
    upload --> db

    subgraph supabase["Supabase"]
        pg[("Postgres<br/>RLS on, zero policies")]
        storage[("Storage<br/>photos bucket")]
    end

    db -->|"bypasses RLS"| pg
    db --> storage

    pg2["YouPI-PG<br/>self-hosted UPI gateway"]
    payApi --> pg2
    pg2 -.->|"signed webhook"| hook
```

Every arrow into Postgres goes through a server route holding the secret key. There
is no path from the browser to the database, which is why RLS can stay deny-all.

## Stack

- **[Next.js 16](https://nextjs.org)** (App Router, Turbopack) + React 19 + TypeScript
- **[MapLibre GL](https://maplibre.org)** 5.x with [OpenFreeMap](https://openfreemap.org) tiles — no map vendor key
- **[Three.js](https://threejs.org)** 0.160 for the designer, served as a standalone
  page in `public/builder/` and embedded as an iframe
- **[Supabase](https://supabase.com)** — Postgres for listings, designs, and the
  purchase ledger; Storage for listing photos
- **[Clerk](https://clerk.com)** for auth
- **[YouPI-PG](https://github.com/youpi-pg/YouPI-PG)** — self-hosted, zero-fee UPI
  payment gateway; the browser embeds its checkout, the server talks to its API
- **Tailwind CSS 4**
- Tests on `node --test`, no test framework dependency

## Design decisions worth calling out

**The server owns every price.** Clients send a *purpose*, never an amount.
[`lib/fees.ts`](lib/fees.ts) is the single source of truth, in paise:

```ts
contact_owner:     5000   // ₹50   — unlock owner contact details
featured_property: 25000  // ₹250  — one-time boost per listing
builder_unlock:    200000 // ₹2000 — one-time per user, full builder suite
template_unlock:   9900   // ₹99   — one-time per template
```

A tampered request body cannot buy a ₹2000 unlock for ₹1, because the amount is
never in the body to begin with. Entitlements are derived from the purchase ledger
rather than trusted from the client — including whether a listing is `featured`.

```mermaid
sequenceDiagram
    autonumber
    participant C as Browser
    participant O as /api/create-order
    participant G as YouPI-PG gateway
    participant V as /api/verify-payment
    participant L as purchases ledger

    C->>O: POST purpose + optional ref
    Note over C,O: no amount is ever sent
    O->>O: Clerk session, else 401
    O->>O: rate limit, 5 per minute
    O->>O: amount looked up in the fee table
    O->>G: create payment, metadata carries purpose + userId + ref
    O-->>C: paymentId, checkoutUrl
    C->>G: youpi.js iframe checkout (UPI)
    G-->>C: payment_success (postMessage)
    C->>V: POST paymentId
    V->>G: GET payment with X-Merchant-Key
    Note over V: metadata only comes back with the merchant key
    V->>V: status SUCCESS, amount, currency, order all checked
    V->>L: record purchase, server-side only
    V-->>C: verified
    G-.->>L: signed webhook records it too if the tab closed
    L-->>C: later reads derive entitlements
```

The amount is read from the fee table *after* the session check, and the purchase is
written only after the server has re-read the payment from the gateway — the browser
can say "I paid" but it can never make that true. Both the verify route and the
webhook (`/api/webhooks/youpi`, HMAC-SHA256 over the raw body) funnel into the same
`recordPurchase`, so a user who closes the tab mid-checkout still gets what they paid
for, and a duplicate delivery is a no-op.

**Row Level Security is deny-all on purpose.** Every table has RLS enabled and
zero policies, so the anon and publishable keys can read nothing. All data access
goes through server routes holding the secret key, which stamp `user_id` from the
Clerk session and never from the request body. The one deliberate exception is the
`photos` storage bucket: public reads (they are public URLs anyway), writes only
through the upload route.

**The Supabase client is lazy.** `next build` evaluates every route module to
collect page data, so a client constructed at import time fails the build on any
machine without secrets. [`lib/db.ts`](lib/db.ts) defers construction to the first
real query behind a `Proxy`.

## Running it locally

Node **22.18+** is the floor — the test files import `.ts` modules directly and rely
on Node's native type stripping. [`.nvmrc`](.nvmrc) pins the exact version CI uses.

```bash
git clone https://github.com/ankit1324/ArchIt.git
cd ArchIt
npm ci
cp .env.example .env.local   # then fill it in
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment

| Variable | Needed for |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SECRET_KEY` | Server routes; bypasses RLS, never expose |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk browser client |
| `CLERK_SECRET_KEY` | Clerk server verification |
| `YOUPI_API_URL` | YouPI-PG payment API base, server-only |
| `NEXT_PUBLIC_YOUPI_PORTAL_URL` | Checkout portal that serves `youpi.js` and the iframe; defaults to the API URL |
| `YOUPI_MERCHANT_ID` | Merchant UUID (optional if the gateway has a single default merchant) |
| `YOUPI_WEBHOOK_SECRET` | Signs webhooks; also sent as `X-Merchant-Key` so payment lookups include metadata |
| `CRON_SECRET` | Authorizes `/api/keepalive` and `/api/cron/reconcile`; both 401 without it |
| `SENTRY_DSN` | Error tracking for money incidents (optional) |
| `ALERT_WEBHOOK_URL` | Slack or Discord incoming webhook pinged on every incident (optional) |
| `ADMIN_USER_IDS` | Comma-separated Clerk user ids allowed into `/admin`; only needed to bootstrap |
| `ADMIN_EMAILS` | Comma-separated admin emails; counts only when verified on the Clerk account |
| `RESEND_API_KEY` | Transactional email via Resend; unset logs and skips emails |
| `EMAIL_FROM` | Sender address, on a domain verified in Resend |
| `EMAIL_REPLY_TO` | Where replies to transactional emails go (optional) |
| `NEXT_PUBLIC_SITE_URL` | Base URL for links in emails; defaults to the live app |
| `NEXT_PUBLIC_VERCEL_ANALYTICS` | `1` on Vercel to enable Web Analytics; unset makes analytics a no-op |

### Database

Migrations are plain SQL in [`supabase/migrations/`](supabase/migrations), applied
with the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase db push
```

## Layout

```
app/                  routes — pages and API handlers
  api/                properties, designs, templates, payments, webhooks
  find/               3D map property search
  designer/           house builder shell
components/           React UI
lib/                  db, fees, payment validation, entitlements, types
public/builder/       standalone Three.js builder, iframed by /designer
public/demo/          demo reels
supabase/migrations/  schema, forward-only
tests/                node --test suites
```

## Scripts

```bash
npm run dev      # dev server
npm run build    # production build
npm run lint     # eslint
npm test         # node --test
npx tsc --noEmit # type check
```

## Contributing

Pull requests welcome. `main` is protected by a
[ruleset](.github/rulesets/README.md): PRs only, `build-and-test` must pass and be
up to date with `main`, review threads resolved, squash merges, linear history.

CI runs type check, lint, tests, and a production build on every PR.

## License

[MIT](LICENSE) © Ankit Chaudhary
