# Practical planner landing implementation plan

**Goal:** Give homeowners a clear introduction to the existing builder, with a compact architectural landing page.

**Architecture:** Replace MarketingLanding with a focused client component and scoped CSS module. Keep the signed-in dashboard and builder behavior intact. Use catalog metadata for three existing starter layouts, an explicitly illustrative hero drawing, and the existing builder recording.

**Scope:** Warm paper/charcoal/terracotta palette, local fonts, responsive navigation, readable hero, expandable template descriptions, three-step workflow, user-controlled demo, FAQ and footer. Builder CTAs open Clerk with a designer redirect. Property search remains secondary. Add home-specific metadata without changing other routes.

- [x] Implement component and scoped responsive styles. Keep all text visible without scroll effects and avoid autoplay.
- [x] Check TypeScript, lint, existing tests and production build.
- [x] Inspect desktop/mobile rendering if local browser access is available; report limitations honestly.

No builder geometry changes or claims of construction-ready templates in this phase.

## Verification

TypeScript passed; all 19 existing tests passed; lint completed with four pre-existing unused-variable warnings. Production build passed with `npm run build -- --webpack`. Default Turbopack build remains blocked by a CSS worker local-port permission error, including on elevated retry.

Chrome review confirmed desktop rendering and 390px mobile layout, expandable template details, mobile menu and anchor navigation, and Clerk sign-up modal opening from the builder CTA. Authentication was not completed. Preview served on http://localhost:3001.
