# Brand fonts — drop the `.woff2` files here

`src/styles/fonts.css` declares `@font-face` rules that point at the files
below. They are **not** committed to the repo. Until you add them, the app
falls back to the stacks defined in `src/styles/tokens.css` (Segoe UI /
system sans, Georgia for the serif) and still renders correctly.

## Required files (exact names)

| File | Family / weight |
|------|-----------------|
| `SourceSans3-Regular.woff2`   | Source Sans 3 — 400 |
| `SourceSans3-Medium.woff2`    | Source Sans 3 — 500 |
| `SourceSans3-SemiBold.woff2`  | Source Sans 3 — 600 |
| `Montserrat-SemiBold.woff2`   | Montserrat — 600 |
| `Montserrat-Bold.woff2`       | Montserrat — 700 |
| `Montserrat-ExtraBold.woff2`  | Montserrat — 800 |
| `SourceSerif4-SemiBold.woff2` | Source Serif 4 — 600 |

## Where to get them

All three families are open-licensed (SIL Open Font License):

- **Fontsource** (pre-built `.woff2`, easiest):
  - https://fontsource.org/fonts/source-sans-3
  - https://fontsource.org/fonts/montserrat
  - https://fontsource.org/fonts/source-serif-4
- **Google Fonts**: https://fonts.google.com/ — download the family, then
  convert the `.ttf` to `.woff2` (e.g. `google-webfonts-helper`, or
  `woff2_compress`).

Rename each downloaded file to match the table above. Subsetting to
`latin` + `latin-ext` keeps the payload small; no code change needed.

## Adding or changing weights

Edit `src/styles/fonts.css` to add another `@font-face` block, then use
that weight via `--font-sans-display` / `--font-sans-body` /
`--font-serif-display` in `src/index.css`.
