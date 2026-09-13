---
"@zengin/registry": minor
"@zengin/cli": minor
"@zengin/ui": minor
---

`zengin fonts`: ten curated Google Fonts pairings in the registry (`fonts-<name>`, three roles each: headlines, text, code, at the weights the components use). `zengin fonts <name>` rewrites the three font tokens in `src/theme/brand.css` and the fonts link in `index.html`, nothing else; `--self-host` downloads the woff2 files into `public/fonts` and writes `src/theme/fonts.css`; `zengin brand --fonts <name>` takes a pairing in place of the three families. `fontsHref` accepts `Family:400;700` to pin weights. The marketing site's catalog gets a font picker beside the theme picker.
