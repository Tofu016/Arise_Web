# ARISE — brand & design system

The UI follows the **SDCA Brand Style Guide** (St. Dominic College of Asia):
SDCA Maroon leads every page, Dominican Gold is a sparing premium accent, on
warm neutrals, roughly a **60 / 30 / 10** white–maroon–gold split.

## How styling works in this repo

There is no CSS framework. Styling lives in three layers, imported in
`src/App.jsx` in this order:

| File | Role |
|------|------|
| `src/styles/fonts.css` | `@font-face` for the three brand families (self-hosted) |
| `src/styles/tokens.css` | **all** design tokens — the single source of truth |
| `src/index.css` | every component's rules, referencing the tokens |

Components use `className="…"`; visual rules are in `index.css`, organised by
feature with `/* --- Section --- */` headers. A few genuinely dynamic values
(3D marker sizes/colours, canvas stroke styles, sheet height) stay inline —
those mirror the tokens with a comment, because 3D materials and `<canvas>`
can't read CSS custom properties.

**To change the look, edit `tokens.css`, not `index.css`.** Everything points
at the semantic aliases (`--surface`, `--accent`, `--text`, `--border`, …),
so a retheme is one block.

## Colour

| Token | Value | Use |
|-------|-------|-----|
| `--accent` / `--sdca-maroon` | `#A12124` | primary actions, headers accents, links, selected state |
| `--accent-hover` / `--sdca-maroon-dark` | `#7A171A` | hover / pressed |
| `--sdca-maroon-deeper` | `#5C1113` | dark overlays, tint-on text |
| `--selected-bg` / `--sdca-maroon-tint` | `#F4E1E1` | selected rows, error surfaces |
| `--accent-tint` / `--sdca-maroon-tint-2` | `#FBF0F0` | faint maroon fills (chips, ghost hovers) |
| `--gold` / `--sdca-gold` | `#C9A24B` | premium accents only — keep to ~10% |
| `--ink` … `--gray-100` | warm neutral ramp | text and surfaces |
| `--success` `#2E7D46` / `--warning` `#B4791A` / `--info` `#2C5F8A` | functional states |
| `--danger` | = maroon | destructive actions & form errors reuse the brand maroon |

**Map wayfinding colours** (`src/utils/constants.js` — `NODE_TYPES`,
`MARKER_TYPES`) are *not* brand colours. They keep their hue (blue hallway,
green entrance, red fire-exit, orange hydrant) but are contrast-tuned to read
on light surfaces and over 360° photos. Adjust them there, not in tokens.

### Accessibility pairings (from the guide)

| Pairing | Verdict |
|---------|---------|
| White text on Maroon | ✅ AA (body & large) — buttons, hero overlays, footer |
| Maroon text on White | ✅ AA — headings, links, badges |
| Gold text on White | ❌ fails AA for body — gold only for large display, icons, or on maroon |
| Gold on Maroon | ✅ AA (large) — eyebrows, hairlines, premium accents |

## Type

Self-hosted (see `public/fonts/README.md` for the `.woff2` drop-in — the app
falls back to system fonts until the files are added):

| Token | Family | Where |
|-------|--------|-------|
| `--font-serif-display` | Source Serif 4 | editorial hero statements only (`.auth-left-panel h1`, `.main-page-picker h1`) |
| `--font-sans-display` | Montserrat (700–800, uppercase, +tracking) | nav, section titles, primary CTAs |
| `--font-sans-body` | Source Sans 3 | all body copy (set on `body`) |
| `--font-mono` | JetBrains Mono | code / IDs |

## Shell

- `index.html` `theme-color` and `public/manifest.webmanifest` `theme_color` → `#A12124`.
- `public/favicon.svg` recoloured to the maroon/gold mark.
- **`public/icons/*.png` still need re-exporting** from the maroon mark — they
  were not regenerated (binary raster; no source artwork in the repo).
