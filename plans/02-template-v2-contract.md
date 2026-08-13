# Template schema v2 — the contract between builder.html and the server

Two workstreams build against this simultaneously. **Neither may change this file.**
If something here is impossible, stop and report — do not improvise a different shape.

- **Workstream A owns `public/builder/builder.html` ONLY.** It implements the *reader*.
- **Workstream B owns `lib/*.ts` + `app/api/templates/**` ONLY.** It implements the *producer*.

Neither touches the other's files. No exceptions.

---

## 1. Payload shape returned by `GET /api/templates/[key]` and stored in `lib/template-geometry.ts`

```jsonc
{
  "v": 2,                          // absent or 1 => legacy payload, see §3
  "profile": "home",               // "home" | "office"  (drives furnishRoom)
  "rooms": [ /* RoomSpec, see §2 */ ]
}
```

## 2. `RoomSpec` — v2 object form

```jsonc
{
  "type": "bedroom",               // REQUIRED. key in C.rooms (builder.html:456-465)
  "cx": 0,                         // REQUIRED. metres, world X, room centre
  "cz": 3.3,                       // REQUIRED. metres, world Z, room centre

  "rot": 0,                        // OPTIONAL int 0-3 (quarter turns). default 0
  "w":  3.0,                       // OPTIONAL metres. default = C.rooms[type].w
  "len": 3.6,                      // OPTIONAL metres. default = C.rooms[type].len
  "name": "Master bedroom",        // OPTIONAL label
  "paint": "cream",                // OPTIONAL key in C.paint  (builder.html:466-476)
  "floorCol": "oak",               // OPTIONAL key in C.floorCol (builder.html:524-533)

  "doors": [ [0, 0.5, "ext_hard", 0.9, 2.1] ],
  "wins":  [ [1, 0.5, "pano"] ],
  "furniture": [ ["bed", 0, -0.4, 0] ]
}
```

### 2.1 `doors` — array of tuples
`[wall, t, type?, width?, height?]`
- `wall` — int **0-3**. 0=+z, 1=+x, 2=-z, 3=-x (`wallPoint`, builder.html:640-643)
- `t` — 0..1 position along that wall. 0.5 = centre
- `type` — OPTIONAL key in `C.doors` (builder.html:553-562). default `"int_hard"`
- `width` — OPTIONAL metres. default `0.8`
- `height` — OPTIONAL metres. default `2.0`

### 2.2 `wins` — array of tuples
`[wall, t, kind?]`
- `wall`, `t` as above
- `kind` — OPTIONAL `"std"` | `"pano"`. default `"std"`.
  `"pano"` is already implemented in the renderer (builder.html:1211) but was
  **unreachable from templates in v1** — v2 exposes it.

### 2.3 `furniture` — array of tuples, OPTIONAL
`[key, lx, lz, rot?]`
- `key` — key in `C.furniture` (builder.html:534-552)
- `lx`, `lz` — **room-local** metres from room centre. `lx` along `len`, `lz` along `w`
- `rot` — OPTIONAL int 0-3. default 0
- **When `furniture` is present it REPLACES the automatic `furnishRoom` output for
  that room. When absent, auto-furnish runs exactly as today.**

## 3. Backward compatibility — MANDATORY

v1 payloads must keep working byte-identically. A room entry that is an **array**
is v1 and means `[type, cx, cz, opts]` where `opts` has only `doors`/`wins`:

```js
// v1 tuple                          // equivalent v2 object
["hall", 0, 0, {doors:[[0,.5]]}]  ≡  {type:"hall", cx:0, cz:0, doors:[[0,.5]]}
```

The reader MUST accept a `rooms` array containing either form, mixed.
20 paid templates are already sold against v1 — breaking them is a paid-product regression.

## 4. Known bug the reader MUST fix

Several v1 templates pass **strings**: `{doors:[['0','0.85','ext_hard']]}`.
`wallPoint` uses strict `wall===0` (builder.html:640-643), so `'0'` silently takes
the wrong branch. The reader must coerce: `wall = Number(wall)`, `t = Number(t)`.

## 5. Invariants neither workstream may break

1. `lib/template-geometry.ts` keeps `import "server-only";` as **line 1**.
2. Geometry for the 20 paid templates **never** appears in `public/builder/builder.html`
   or in the `GET /api/templates` catalog response.
3. `GET /api/templates/<paid key>` returns **402** when signed out.
4. The 11 free templates (`empty` + 10 `in_*`) keep their geometry inline in builder.html.
5. `lib/template-geometry.ts` is **generated** — never hand-edit it. Extend the generator.
6. `wallMats[]` (builder.html:~1019) must still receive every wall material, or the
   wall-opacity control and `shoot3D(seeThrough)` break silently.
7. Max 3 floors. `C.H = 2.75` wall height.
8. No external asset fetches. CSP `img-src` does **not** allow `cdn.jsdelivr.net`.
