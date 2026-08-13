# Self-hosted font binaries

These woff2 files are checked in so `next build` never touches the network.
Pulling them from `next/font/google` at build time made every production build
depend on Google Fonts being reachable, and it has already broken CI once
("Module not found: Can't resolve
'@vercel/turbopack-next/internal/font/google/font'").

Provenance: copied verbatim out of the `@fontsource*` npm packages (kept as
devDependencies purely as the source of these binaries — nothing imports them
at runtime). To refresh, reinstall those packages and re-copy:

| file | package | source path |
| --- | --- | --- |
| `plus-jakarta-sans-latin-wght-normal.woff2` | `@fontsource-variable/plus-jakarta-sans` | `files/plus-jakarta-sans-latin-wght-normal.woff2` |
| `fraunces-latin-wght-normal.woff2` | `@fontsource-variable/fraunces` | `files/fraunces-latin-wght-normal.woff2` |
| `fraunces-latin-wght-italic.woff2` | `@fontsource-variable/fraunces` | `files/fraunces-latin-wght-italic.woff2` |
| `manrope-latin-wght-normal.woff2` | `@fontsource-variable/manrope` | `files/manrope-latin-wght-normal.woff2` |
| `ibm-plex-mono-latin-{400,500,600}-normal.woff2` | `@fontsource/ibm-plex-mono` | `files/ibm-plex-mono-latin-<w>-normal.woff2` |

Only the `latin` subset is shipped, matching the `subsets: ["latin"]` the
`next/font/google` calls used to request. The variable families use the
`wght`-only cut (not `full`), which is the same single-axis slice Google serves
by default — the extra Fraunces axes (`opsz`, `SOFT`, `WONK`) were never
requested via `axes`, so leaving them out keeps rendering identical and the
file small. IBM Plex Mono has no variable release, hence one file per weight.

All four families are OFL-licensed; the licenses sit next to the binaries.
