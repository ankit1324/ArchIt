import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // bundled builder (scripts/build-builder.mjs); its sources in builder/src are linted
    "public/builder/js/**",
    // agent worktrees (each a full checkout with its own node_modules)
    ".claude/**",
    // Playwright MCP snapshots and console logs, not source
    ".playwright-mcp/**",
    // vendored MapLibre worker copied by scripts/copy-maplibre-worker.mjs
    "public/vendor/**",
  ]),
]);

export default eslintConfig;
