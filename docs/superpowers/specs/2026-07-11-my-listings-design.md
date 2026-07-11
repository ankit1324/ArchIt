# My Listings + User Roles — Design

Date: 2026-07-11
Status: Approved

## Goal

Tie property listings to Clerk users. Signed-in Owners manage their own listings via a
"My Listings" panel on the map page. Users pick a role (Owner or Tenant/Buyer) after
sign-up; only Owners can create and manage listings.

## Data

- New Supabase migration: `ALTER TABLE properties ADD COLUMN user_id TEXT;` plus an
  index on `user_id`. Existing rows keep `user_id = NULL` (legacy listings).
- `user_id` stores the Clerk user ID. It is never sent to the client.
- `Listing` type gains `isMine?: boolean`, computed server-side per request.

## Roles

- Stored in Clerk `unsafeMetadata.role`: `"owner" | "buyer"`.
- Clerk's modal sign-up cannot collect custom fields, so the first signed-in visit with
  no role shows a role-picker modal ("I'm an Owner" / "I'm a Tenant/Buyer"), saved via
  `user.update({ unsafeMetadata: { role } })`. Covers both modal and `/sign-up` page flows.
- Role is self-declared; server-side checks are for consistency, not hard security.

## API (Clerk `auth()` from `@clerk/nextjs/server`)

- `GET /api/properties` — public. Returns all listings; each includes `isMine`
  (`user_id === auth().userId`, false when signed out).
- `GET /api/properties?mine=1` — only the caller's listings. 401 if signed out.
- `POST /api/properties` — 401 if signed out, 403 if role is not `owner`. Stamps
  `user_id` from the session.
- `PUT`/`DELETE /api/properties/[id]` — 401 if signed out, 403 if role is not `owner`,
  403 if the row's `user_id` is set and differs from the caller. Rows with NULL
  `user_id` (legacy) are editable by any signed-in Owner.
- Role lookup server-side: `clerkClient.users.getUser(userId)` → `unsafeMetadata.role`.

## UI

- **Navbar**: "My Listings" button, visible only when signed in AND role is `owner`.
  Fires an `onMyListings` callback prop.
- **MyListingsPanel** (new component): slides over the left side of the map. Reuses
  `PropertyCard` for each of the caller's listings (fetched via `?mine=1`). Clicking a
  card flies the map to the property and opens `PropertyDetailPanel`. Empty state:
  "No listings yet — click the map to add one."
- **RolePickerModal** (new component): shown when signed in with no role set. Two
  choices, one click, saves and closes.
- **PropertyDetailPanel**: Edit/Delete buttons only when `isMine`, or when the listing
  is legacy (no owner) and the viewer is a signed-in Owner. Panel needs a
  `canManage: boolean` prop (page computes it from `isMine` + role).
- **Add-property flow**: map-click add is enabled only for signed-in Owners. Signed-out
  users are prompted to sign in; Tenant/Buyer sees no add affordance.

## Error handling

- API returns JSON `{ error }` with 401/403/404/500 as appropriate; client surfaces
  failures the same way existing save/delete flows do.
- Role fetch failure in API routes → 500, not silent allow.

## Testing

- curl the API: signed-out POST/PUT/DELETE → 401; GET returns listings with
  `isMine: false`.
- Browser: sign in, pick Owner role, create listing, see it in My Listings, edit,
  delete. Verify Tenant/Buyer sees no My Listings button and no add flow.
