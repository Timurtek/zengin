---
"@zenginui/engine": minor
"@zenginui/mcp": patch
"@zenginui/figma": patch
"@zenginui/registry": patch
---

Fix suggestions follow the project's brand. `color-literal` and `spacing-literal` match a literal against what the project paints: the brand's value where `src/theme/brand.css` overrides a token, the token files' elsewhere. A token's dark value is matched too, after the light ones, from the brand's dark block or `tokens.dark.json`. In a project whose brand makes primary `#1E6B3C`, that literal is now an exact `color.primary`, and its dark `#C8F542` is `color.primary` as well; before, both were a "nearest" guess at an unrelated token. The message says where the matched value lives: the project's brand, the default theme, or dark.

`system.brand` in `zengin.config.yaml` names the brand file (default `src/theme/brand.css`, read when it exists); `brand: false` matches the token files alone. `loadDefinitions` reads `tokens.dark.json` when there is one, resolving its aliases against `tokens.json` (`loadDarkTokens`), and a dark file it cannot read is skipped rather than stopping the check.

New in the engine: `BRAND_CSS`, `parseBrandCss`, `resolveBrandValues`, `loadDarkTokens`, `TokenIndex.colorMatches` and `nearestColorMatch`, and `Engine.tokens` and `Engine.brand`. `zengin_describe_system` in the MCP server lists the brand's values, with the default beside each one the brand changes. `@zenginui/figma` reads brand files with the engine's parser, and the registry's `LAYOUT.brandCss` is the engine's `BRAND_CSS`.
