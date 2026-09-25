# Brand fonts

`src/styles/fonts.css` declares `@font-face` rules that point at the files
below.

## Files (exact names)

| File | Family / weight |
|------|-----------------|
| `CenturyGothic-Regular.woff2`  | Century Gothic — 400 |
| `CenturyGothic-Italic.woff2`   | Century Gothic — 400 italic |
| `CenturyGothic-SemiBold.woff2` | Century Gothic — 600 |
| `CenturyGothic-Bold.woff2`     | Century Gothic — 700 |

## Source

Converted from the Pan-European Century Gothic TTFs in
`ui-branding-guidelines/fonts/centurygothic/` (repo root, gitignored,
read-only) using `fonttools`:

```python
from fontTools.ttLib import TTFont
f = TTFont("path/to/CenturyGothicPaneuropeanRegular.ttf")
f.flavor = "woff2"
f.save("CenturyGothic-Regular.woff2")
```

## Adding or changing weights

Edit `src/styles/fonts.css` to add another `@font-face` block, then use
that weight via `--font-sans-display` / `--font-sans-body` /
`--font-serif-display` in `src/index.css`.
