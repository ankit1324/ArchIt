# ArchIt UI/UX Polish Design

## Intent

Improve the highest-friction user journeys without replacing the practical-planner visual language introduced across the product. The landing page already has a strong editorial identity and scores 100 in the desktop Lighthouse accessibility, best-practices, SEO, and agentic-browsing categories. This pass keeps that foundation and fixes gaps in wayfinding, mobile map controls, motion accessibility, dialog keyboard use, and conversion paths.

## Audit evidence

- The live landing and showcase pages were checked at desktop and phone widths. Their hierarchy, typography, contrast, and responsive layouts are already strong.
- The live landing and showcase pages score 100 in Lighthouse accessibility. The sign-in screen also scores 100 for accessibility.
- On `/find`, the only page heading is inside a filter panel hidden below 1024px, so the default mobile view has no available `h1`.
- The phone stylesheet hides “Show on map,” removing a useful result action exactly where the map is hardest to frame manually.
- Opening filters on a phone leaves all map chrome visually active behind the panel and offers no outside-click dismissal.
- MapLibre camera transitions use fixed durations throughout Find, the map introduction, cluster expansion, and the publish pin picker. These transitions do not honor `prefers-reduced-motion`.
- The shared bottom-sheet handle always says “Close property details,” including when it contains a published design.
- The shared mobile menu overlays the page without a visual scrim, and its menu and sign-in controls are 40px tall rather than the product’s 44px primary-control target.
- The pricing page explains the offer but ends without a route into either core product.
- The Designer setup link says “Back to map” while it routes to `/`, which is the signed-in dashboard. Several setup and saved-design controls use small touch targets, and setup placeholders use lower contrast than the search UI.
- The publish dialog declares itself modal and closes with Escape, but it does not place focus inside, contain Tab navigation, or return focus to the opener.

## Direction

Keep the refined editorial planner aesthetic: warm paper, forest ink, terracotta actions, Fraunces display type, Manrope body copy, squared 5–6px panels, and thin rules. The product should feel like a calm architectural desk rather than a generic dashboard. New UI uses existing tokens and components; no dependency or palette changes are needed.

## Goals

### Find on phones

- Provide one persistent page `h1`; use the visible filter title as a section heading.
- Add a subtle ink scrim behind the open filter panel. Tapping the scrim closes filters.
- Preserve “Show on map” at phone widths. Reflow the result summary and controls into two compact rows instead of removing the action.
- Keep every existing search, filter, sort, map, listing, design, add-property, and payment behavior unchanged.

### Motion accessibility

- Every programmatic MapLibre camera animation resolves to `0ms` when the browser reports `prefers-reduced-motion: reduce`.
- Normal motion retains the current durations and camera destinations.
- Use one small tested helper so Find, Map3D, and PinPickerMap cannot drift apart.

### Navigation and conversion

- Add a backdrop to the shared phone menu so its relationship to the obscured page is clear and outside-click dismissal is obvious.
- Raise the shared phone menu and sign-in controls to at least 44px.
- Add a dark planner-style call-to-action band to Pricing with direct routes to Designer and Find. The page remains truthful whether the paywall is enabled or disabled.

### Designer and modal usability

- Rename setup and locked-state exits to “Back to dashboard,” matching their `/` destination for signed-in users.
- Improve setup placeholder contrast and touch targets without changing form values or validation.
- Improve saved-design touch targets and raise the 10px publication badge to 11px.
- Give each map detail sheet an accurate dismiss label.
- On publish-dialog open, focus its first field; trap Tab/Shift+Tab inside enabled focusable controls; on close, return focus to the opener. Escape and backdrop dismissal remain unchanged.

## Non-goals

- No new visual identity, font, package, route, backend behavior, payment behavior, or data model.
- No redesign of the standalone Three.js builder chrome.
- No persistent mobile tab bar inside full-screen tools; preserving canvas height wins over duplicating the existing top navigation.
- No admin redesign or unrelated refactor.

## Constraints and validation

- Follow Next.js 16.4’s bundled guidance, existing Tailwind 4 and CSS Module patterns, and the current App Router boundaries.
- Add no dependencies.
- Use pure Node tests for motion-duration and focus-wrap decisions. Do not add source-string tests for markup or CSS.
- Validate with targeted tests first, then `npm test`, `npx tsc --noEmit --incremental false`, and `npm run lint`.
- Inspect public changed surfaces locally at 320–390px and desktop width. Authenticated Find and Designer surfaces receive source-level review because the browser has no test account.
- Do not build, commit, push, deploy, or change Git configuration.
