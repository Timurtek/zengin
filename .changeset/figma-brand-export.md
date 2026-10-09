---
"@zenginui/figma": minor
"@zenginui/cli": minor
"@zenginui/registry": patch
---

`zengin figma export` exports a project in its own brand. `src/theme/brand.css` overrides the token files in the browser, and now in Figma too: its light block gives Light, its `[data-theme="dark"]` block gives Dark, and anything set only in the light block (fonts, radii, text sizes) carries into Dark as the cascade has it. The output lists what the brand overrode, its custom properties that name no token, and values Figma cannot hold. `--no-brand` exports the system defaults, `--brand <file>` reads another file, and `--themes` keeps its meaning and leaves the project's brand out.

`zengin figma import` compares against the brand too. A designer's change to a token the brand sets is reported under `brand`, to make in `brand.css`, and `--write` never copies it into `tokens.json`.

In `@zenginui/figma`: `parseBrandCss`, `resolveBrand`, `renderBrandReport`, an `overrides` option on `toFigmaVariables`, a `brand` option on `fromFigmaVariables` and `ImportReport.brand`. `parseThemeCss` accepts the same selector spellings (`[data-theme='dark']`, `[data-theme=dark]`, `html`). In `@zenginui/registry`: `LAYOUT.brandCss`, the one place the brand file's path is named.
