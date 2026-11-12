# ArchIt UI/UX Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove verified mobile, accessibility, wayfinding, and conversion friction while preserving ArchIt’s practical-planner visual identity.

**Architecture:** Keep UI changes inside the existing route components, shared components, Tailwind utilities, and Find CSS Module. Add two tiny pure helpers for reduced-motion duration and dialog focus wrapping so behavior is consistent and directly testable.

**Tech Stack:** Next.js 16.4 App Router, React 19, TypeScript, Tailwind CSS 4, CSS Modules, MapLibre GL 6, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-31-ui-ux-polish-design.md`

## Global Constraints

- Preserve the current warm-paper, forest-ink, terracotta-accent planner language and use existing semantic tokens.
- Add no dependencies and do not change backend, auth, payment, or data behavior.
- Keep diffs focused; do not redesign the Three.js builder or add a persistent tab bar to full-screen tools.
- Follow TDD for new behavior: observe each new focused test fail for the intended reason before implementation.
- Do not commit, push, deploy, run a production build, or change Git configuration.
- Validate with targeted tests, the complete test suite, TypeScript, ESLint, and local browser checks on public changed surfaces.

## Review Focus

- A browser with reduced motion must receive zero-duration camera changes in every MapLibre surface while other users retain current durations.
- Find at 320–600px must keep search, filter, fit-results, map-area, and sort controls usable without horizontal overflow.
- Opening the shared phone menu or Find filters must leave an obvious and operable outside-click dismissal surface.
- Publish-dialog Tab navigation must skip disabled controls, wrap in both directions, and return focus after close.
- Pricing calls to action must route into the existing protected flows and remain accurate with either paywall state.

---

### Task 1: Motion and focus primitives

**Files:**
- Create: `lib/motion.ts`
- Create: `lib/focus.ts`
- Create: `tests/motion.test.mjs`
- Create: `tests/focus.test.mjs`

**Interfaces:**
- Produces: `motionDuration(duration: number, reduced?: boolean): number`
- Produces: `wrappedFocusIndex(itemCount: number, currentIndex: number, backwards: boolean): number`

- [ ] **Step 1: Write failing tests**

Test normal and reduced durations with literal expected values. Test forward and backward focus wrapping, an unknown current element, and an empty focus list.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/motion.test.mjs tests/focus.test.mjs`

Expected: FAIL because the new modules/functions do not exist.

- [ ] **Step 3: Implement the minimal pure helpers**

`motionDuration` reads `matchMedia("(prefers-reduced-motion: reduce)")` only when the optional boolean is omitted and the browser API exists. `wrappedFocusIndex` returns `-1` for no items and wraps deterministically for Tab and Shift+Tab.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `node --test tests/motion.test.mjs tests/focus.test.mjs`

Expected: all tests pass.

### Task 2: Map motion and responsive Find controls

**Files:**
- Modify: `app/(app)/find/FindClient.tsx`
- Modify: `app/(app)/find/find.module.css`
- Modify: `components/Map3D.tsx`
- Modify: `components/PinPickerMap.tsx`
- Modify: `components/BottomSheet.tsx`

**Interfaces:**
- Consumes: `motionDuration` from Task 1.
- Changes `BottomSheet` props to accept optional `dismissLabel?: string`, defaulting to `"Close details"`.

- [ ] **Step 1: Apply reduced-motion durations**

Wrap every fixed MapLibre `duration` in FindClient, Map3D, and PinPickerMap with `motionDuration(...)`; preserve all destinations, pitch, bearing, padding, offsets, and normal durations.

- [ ] **Step 2: Repair Find semantics and filter dismissal**

Add one screen-reader page `h1`, change the visible filter heading to `h2`, and render a phone-only scrim button while filters are open. The scrim closes filters and sits below the filter panel but above map chrome.

- [ ] **Step 3: Preserve phone result actions**

Give “Show on map” a dedicated class and label span. At `max-width: 600px`, stack the result summary over a compact action row and keep map-area, fit-results, and sort controls visible without overflow.

- [ ] **Step 4: Correct sheet labels**

Pass “Close property details” for listing sheets and “Close design details” for design sheets.

- [ ] **Step 5: Verify focused files**

Run: `npx eslint app/(app)/find/FindClient.tsx components/Map3D.tsx components/PinPickerMap.tsx components/BottomSheet.tsx lib/motion.ts`

Expected: zero errors.

### Task 3: Shared phone navigation and Pricing conversion

**Files:**
- Modify: `components/Navbar.tsx`
- Modify: `components/NavAuth.tsx`
- Modify: `components/ClerkNavAuth.tsx`
- Modify: `app/pricing/page.tsx`

**Interfaces:**
- Existing component signatures remain unchanged.

- [ ] **Step 1: Improve the shared phone menu**

Raise the menu and sign-in controls to 44px. While the menu is open, render a fixed, subtle ink scrim beneath the header; tapping it closes the menu. Keep Escape, route-change closing, links, and desktop layout unchanged.

- [ ] **Step 2: Add the Pricing action band**

Add an editorial forest band after “Always free,” with one primary link to `/designer` and one secondary link to `/find`. Copy must work with both paywall modes and must not claim an unimplemented feature.

- [ ] **Step 3: Browser-check public surfaces**

At local `/pricing`, verify 320px/390px and desktop layouts, menu open/close, no horizontal overflow, keyboard focus visibility, and both action destinations.

### Task 4: Designer controls and publish-dialog keyboard flow

**Files:**
- Modify: `app/(app)/designer/page.tsx`
- Modify: `components/PublishDialog.tsx`

**Interfaces:**
- Consumes: `wrappedFocusIndex` from Task 1.
- Existing component props and route behavior remain unchanged.

- [ ] **Step 1: Polish Designer setup and saved-design controls**

Change both misleading exits to “Back to dashboard,” use full `text-ink-soft` placeholder color, raise setup chips and relevant saved-design actions toward touch-target size without disturbing the 52px embedded-builder header, and raise the publication badge from 10px to 11px.

- [ ] **Step 2: Implement modal focus behavior**

Capture the opener on mount, focus the place-search input, trap Tab and Shift+Tab among enabled focusable controls using `wrappedFocusIndex`, and restore opener focus on unmount. Keep Escape, backdrop click, abort cleanup, and busy-state behavior.

- [ ] **Step 3: Verify focused files**

Run: `npx eslint app/(app)/designer/page.tsx components/PublishDialog.tsx lib/focus.ts`

Expected: zero errors.

### Task 5: Full verification and review

**Files:**
- Review all files changed above plus the spec and plan.

- [ ] **Step 1: Run complete verification**

Run: `node --test tests/motion.test.mjs tests/focus.test.mjs`, `npm test`, `npx tsc --noEmit --incremental false`, and `npm run lint`.

Expected: all commands exit 0 with no lint/type errors.

- [ ] **Step 2: Inspect Git diff**

Confirm only scoped files changed, no generated assets or secrets entered the diff, and normal-motion values and route destinations remain intact.

- [ ] **Step 3: Request independent review**

Ask a read-only reviewer to report only verified regressions or accessibility failures, severity-ranked. Fix any verified finding and rerun affected verification.
