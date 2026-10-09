# @zenginui/figma

## 0.3.0

### Minor Changes

- [`b492f73`](https://github.com/Timurtek/zengin/commit/b492f7357b32b2f2276d1411b0f235ab1344ea88) Thanks [@Timurtek](https://github.com/Timurtek)! - `zengin figma export` exports a project in its own brand. `src/theme/brand.css` overrides the token files in the browser, and now in Figma too: its light block gives Light, its `[data-theme="dark"]` block gives Dark, and anything set only in the light block (fonts, radii, text sizes) carries into Dark as the cascade has it. The output lists what the brand overrode, its custom properties that name no token, and values Figma cannot hold. `--no-brand` exports the system defaults, `--brand <file>` reads another file, and `--themes` keeps its meaning and leaves the project's brand out.
  
  `zengin figma import` compares against the brand too. A designer's change to a token the brand sets is reported under `brand`, to make in `brand.css`, and `--write` never copies it into `tokens.json`.
  
  In `@zenginui/figma`: `parseBrandCss`, `resolveBrand`, `renderBrandReport`, an `overrides` option on `toFigmaVariables`, a `brand` option on `fromFigmaVariables` and `ImportReport.brand`. `parseThemeCss` accepts the same selector spellings (`[data-theme='dark']`, `[data-theme=dark]`, `html`). In `@zenginui/registry`: `LAYOUT.brandCss`, the one place the brand file's path is named.

### Patch Changes

- [`2f6b794`](https://github.com/Timurtek/zengin/commit/2f6b79429c6d9042f8d15f3666b30adc1db1a3ae) Thanks [@Timurtek](https://github.com/Timurtek)! - Fix suggestions follow the project's brand. `color-literal` and `spacing-literal` match a literal against what the project paints: the brand's value where `src/theme/brand.css` overrides a token, the token files' elsewhere. A token's dark value is matched too, after the light ones, from the brand's dark block or `tokens.dark.json`. In a project whose brand makes primary `#1E6B3C`, that literal is now an exact `color.primary`, and its dark `#C8F542` is `color.primary` as well; before, both were a "nearest" guess at an unrelated token. The message says where the matched value lives: the project's brand, the default theme, or dark.
  
  `system.brand` in `zengin.config.yaml` names the brand file (default `src/theme/brand.css`, read when it exists); `brand: false` matches the token files alone. `loadDefinitions` reads `tokens.dark.json` when there is one, resolving its aliases against `tokens.json` (`loadDarkTokens`), and a dark file it cannot read is skipped rather than stopping the check.
  
  New in the engine: `BRAND_CSS`, `parseBrandCss`, `resolveBrandValues`, `loadDarkTokens`, `TokenIndex.colorMatches` and `nearestColorMatch`, and `Engine.tokens` and `Engine.brand`. `zengin_describe_system` in the MCP server lists the brand's values, with the default beside each one the brand changes. `@zenginui/figma` reads brand files with the engine's parser, and the registry's `LAYOUT.brandCss` is the engine's `BRAND_CSS`.

- [`318a7ce`](https://github.com/Timurtek/zengin/commit/318a7ce1d2f401802c22991fee2a534b3309552c) Thanks [@Timurtek](https://github.com/Timurtek)! - `zengin figma export` and `import` read `tokens.dark.json` against `tokens.json`, so a dark file whose values alias light tokens (`{color.gray-900}`, as the CSS adapter writes) exports instead of failing with "Token alias not found". The same goes for the themed export and for brand files. Import also stops reporting a color with no dark override as a dark change: Figma's uppercase hex is compared with the token's case-insensitively.
- Updated dependencies [[`2f6b794`](https://github.com/Timurtek/zengin/commit/2f6b79429c6d9042f8d15f3666b30adc1db1a3ae)]:
  - @zenginui/engine@0.6.0

## 0.2.0

### Minor Changes

- [`d5b87c8`](https://github.com/Timurtek/zengin/commit/d5b87c8cf863b6c25687e093d3786a367b44587c) Thanks [@Timurtek](https://github.com/Timurtek)! - `zengin figma connect` writes Code Connect template files (`<name>.figma.ts`), the format Code Connect CLI v2 reads; it no longer accepts the v1 `figma.connect()` React files this command used to write. The config sets the snippet language (React, tsx). With `--map`, only the mapped components are written, since a placeholder URL failed `figma connect publish` for the whole run, and a name the manifest does not have is an error. The import line follows the project's `system.package`. Form plumbing props (`defaultValue`, `defaultOpen`, `name`, `id`) are no longer mapped.

- [`6830972`](https://github.com/Timurtek/zengin/commit/68309720d188f2a3822500b4b89db558fb17d090) Thanks [@Timurtek](https://github.com/Timurtek)! - Figma variables now carry themes and import cleanly back.
  
  - `zengin figma export --themes <dir>` adds a Theme collection with a mode per `<dir>/<name>/brand.css`, and aliases the Zengin collection's themed tokens into it, so a file switches theme with one mode picker within a plan's mode limit.
  - `zengin figma import` follows aliases into the Theme collection (its default mode, or `--theme <name>`) instead of skipping them.
  - Scopes Figma accepts: colors no longer pair `ALL_FILLS` with `TEXT_FILL` (Figma refused the payload), and spacing, weights and the border width get their own scopes instead of falling back to all of them. Line heights, letter spacing, shadows and motion are kept out of the pickers.
  - A font variable holds its stack's first family, the one Figma can load; import puts a changed family back in front of the code's fallbacks.
  - The plugin imports aliases.

### Patch Changes

- [`5acbae6`](https://github.com/Timurtek/zengin/commit/5acbae6abb45eed80b79b959e2aeefd56846a06d) Thanks [@Timurtek](https://github.com/Timurtek)! - `zengin figma connect` writes valid templates for every component: a prop like `aria-label` becomes the identifier `ariaLabel` (it was written as `const aria-label`, which does not parse), a component whose own prop reads the "Label" property no longer reads it a second time as children, and `dir`, `src` and `*Src` props (writing direction, image URLs) are left out with the other form plumbing.

## 0.1.4

### Patch Changes

- Updated dependencies [[`4d14470`](https://github.com/Timurtek/zengin/commit/4d14470b9869a6ef64a5e352296b8fb94cc1d724)]:
  - @zenginui/engine@0.5.0

## 0.1.3

### Patch Changes

- Updated dependencies [[`781d440`](https://github.com/Timurtek/zengin/commit/781d440e9530585f7c524848f8cfe7a1342b69e2), [`93aef4c`](https://github.com/Timurtek/zengin/commit/93aef4c2d739c9cd729f1c8136ac45b843da1b15)]:
  - @zenginui/engine@0.4.0

## 0.1.2

### Patch Changes

- Updated dependencies [[`1bb0588`](https://github.com/Timurtek/zengin/commit/1bb0588a2782b960d8576210643a18bfc4b45f99)]:
  - @zenginui/engine@0.3.0

## 0.1.1

### Patch Changes

- Updated dependencies [[`68deff9`](https://github.com/Timurtek/zengin/commit/68deff932336bf06a8c9d92655fd53683a9abceb)]:
  - @zenginui/engine@0.2.0

## 0.1.0

### Minor Changes

- [`46c9785`](https://github.com/Timurtek/zengin/commit/46c9785cef6a6a2765043d32eb34098584ebd343) Thanks [@Timurtek](https://github.com/Timurtek)! - `@zenginui/figma`: tokens to a Figma Variables payload and back with a report, Code Connect files from the component manifest, and a plugin that imports and exports variables in any Figma file. `zengin figma export | import | connect | plugin` in the CLI.

- [`bf6477b`](https://github.com/Timurtek/zengin/commit/bf6477bd04edbd3fc4fdc317bf93d9adb941a09a) Thanks [@Timurtek](https://github.com/Timurtek)! - The npm scope is `@zenginui`: `@zenginui/ui`, `@zenginui/cli`, `@zenginui/engine` and the rest, since the `zengin` org was taken. The unscoped `zenginui` package carries the `zengin` bin, so `npm create zengin@latest my-app` is the install command. Generated projects, the registry's import rewriting, the docs and the rollup history all use the new scope.

### Patch Changes

- Updated dependencies [[`52e16ea`](https://github.com/Timurtek/zengin/commit/52e16eac6c656a7f19ba72f1ed9bf21e46435542), [`8c0024c`](https://github.com/Timurtek/zengin/commit/8c0024c402edaf707ff44e600a96944f1c55975a), [`05568b7`](https://github.com/Timurtek/zengin/commit/05568b7b471b10871260ea85461d4ccbfaf28844), [`156f5f5`](https://github.com/Timurtek/zengin/commit/156f5f5dcfced05199a64628f2d27037d7e974dc), [`6157f71`](https://github.com/Timurtek/zengin/commit/6157f71b414bc588c0bc34eaf46dacdd1ab4513a), [`bf6477b`](https://github.com/Timurtek/zengin/commit/bf6477bd04edbd3fc4fdc317bf93d9adb941a09a), [`9462306`](https://github.com/Timurtek/zengin/commit/946230627df7249acf6e8d650df44d8233369071)]:
  - @zenginui/engine@0.1.0
