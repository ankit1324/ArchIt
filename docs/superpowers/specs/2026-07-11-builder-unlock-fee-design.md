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
- New `purchases` table — a ledger of every verified payment: `user_id,
  purpose, ref, order_id, payment_id (unique), amount, created_at`. Partial
  unique indexes make `builder_unlock` one-time per user and `contact_owner`
  one-time per (user, property). RLS enabled with no policies (all access
  via API routes with the secret key).
- `POST /api/create-order`: stamps `notes: { purpose, userId, ref }` on the
  Razorpay order; `ref` is e.g. the property id for contact unlocks.
- `POST /api/verify-payment`: after the HMAC check, fetches the order from
  Razorpay and inserts a purchases row for the user recorded in the order
  notes — every purpose, not just unlocks. Duplicate inserts (retries,
  already-owned one-time purchases) are ignored. The client cannot fake an
  unlock — persistence happens only server-side after signature verification.
- `GET /api/purchases?purpose=X[&ref=Y]`: returns `{ unlocked }` for the
  current Clerk user.

## Persistence per fee

- `builder_unlock` ₹2000 — one-time per user; gates `/designer`.
- `contact_owner` ₹20 — one-time per (user, property); the detail panel
  checks the ledger on open and skips the paywall if already paid.
- `add_property` ₹100 — recorded for audit; still charged per listing.
