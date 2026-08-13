<!-- Why this change, not what it changes — the diff covers the what. -->

## Why

## Checks

These are the gates CI actually runs; a PR that fails one cannot merge.

- [ ] `npx tsc --noEmit`
- [ ] `npm run lint`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] Rebased on `main` (the required check has a strict up-to-date policy)
- [ ] New migrations are additive only — nothing in `supabase/migrations/` was edited or deleted
