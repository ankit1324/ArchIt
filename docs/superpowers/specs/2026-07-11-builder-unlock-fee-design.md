# Builder One-Time Unlock (₹2000) — Design

Date: 2026-07-11. Status: approved.

## Goal

The ArchIt builder at `/designer` opens only after a one-time ₹2000 payment
per user. Once paid, the builder is unlocked for that Clerk user forever.

## Flow

1. `/designer` is already Clerk-protected by `proxy.ts`, so a session exists.
2. On load the page asks `GET /api/purchases?purpose=builder_unlock` →
   `{ unlocked: boolean }`.
3. Locked → paywall card with "Unlock ArchIt Builder — one-time ₹2000" button
   that calls `payFee("builder_unlock", …)` (existing Razorpay checkout).
4. On verified payment the server records the purchase; the page flips to the
   normal setup-dialog flow. Unlocked users skip the paywall entirely.

## Server pieces

- `lib/fees.ts`: add `builder_unlock: 200000` paise. Amounts stay
  server-side-only; the client sends a purpose, never an amount.
- New `purchases` table: `user_id, purpose, order_id, payment_id,
  created_at`, unique `(user_id, purpose)` — one-time by construction, RLS
  enabled with no policies (all access via API routes with the secret key).
- `POST /api/create-order`: stamps `notes: { purpose, userId }` on the
  Razorpay order.
- `POST /api/verify-payment`: after the HMAC check, fetches the order from
  Razorpay and, when its notes say `builder_unlock`, inserts a purchases row
  for the user recorded in the order notes. Duplicate inserts are ignored.
  The client cannot fake an unlock — persistence happens only server-side
  after signature verification.
- `GET /api/purchases?purpose=X`: returns `{ unlocked }` for the current
  Clerk user.

## Unchanged

The ₹100 listing and ₹20 contact-owner fees keep their stateless flow; no
purchase row is written for them.
