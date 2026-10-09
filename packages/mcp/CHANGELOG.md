# @zenginui/mcp

## 0.1.5

### Patch Changes

- [`2f6b794`](https://github.com/Timurtek/zengin/commit/2f6b79429c6d9042f8d15f3666b30adc1db1a3ae) Thanks [@Timurtek](https://github.com/Timurtek)! - Fix suggestions follow the project's brand. `color-literal` and `spacing-literal` match a literal against what the project paints: the brand's value where `src/theme/brand.css` overrides a token, the token files' elsewhere. A token's dark value is matched too, after the light ones, from the brand's dark block or `tokens.dark.json`. In a project whose brand makes primary `#1E6B3C`, that literal is now an exact `color.primary`, and its dark `#C8F542` is `color.primary` as well; before, both were a "nearest" guess at an unrelated token. The message says where the matched value lives: the project's brand, the default theme, or dark.
  
  `system.brand` in `zengin.config.yaml` names the brand file (default `src/theme/brand.css`, read when it exists); `brand: false` matches the token files alone. `loadDefinitions` reads `tokens.dark.json` when there is one, resolving its aliases against `tokens.json` (`loadDarkTokens`), and a dark file it cannot read is skipped rather than stopping the check.
  
  New in the engine: `BRAND_CSS`, `parseBrandCss`, `resolveBrandValues`, `loadDarkTokens`, `TokenIndex.colorMatches` and `nearestColorMatch`, and `Engine.tokens` and `Engine.brand`. `zengin_describe_system` in the MCP server lists the brand's values, with the default beside each one the brand changes. `@zenginui/figma` reads brand files with the engine's parser, and the registry's `LAYOUT.brandCss` is the engine's `BRAND_CSS`.

- [`9ace652`](https://github.com/Timurtek/zengin/commit/9ace652d5d8d9917e9bb5f1ec269ab9eadccfe98) Thanks [@Timurtek](https://github.com/Timurtek)! - README: setup for Codex CLI and Cursor, both run end to end against the published server, and why ChatGPT cannot launch it yet (its connectors take remote servers; this one is stdio).
- Updated dependencies [[`2f6b794`](https://github.com/Timurtek/zengin/commit/2f6b79429c6d9042f8d15f3666b30adc1db1a3ae)]:
  - @zenginui/engine@0.6.0

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

- [`156f5f5`](https://github.com/Timurtek/zengin/commit/156f5f5dcfced05199a64628f2d27037d7e974dc) Thanks [@Timurtek](https://github.com/Timurtek)! - First public release of the Zengin conformance layer.
  
  - `@zenginui/engine`: the deterministic rule engine. Seven rule kinds (color-literal, spacing-literal, token-reference, unknown-prop, unknown-prop-value, classname-policy, component-substitution) checked against a design system's DTCG tokens and component manifest. Class names resolve through the project's own stylesheets, with Tailwind v4 as an optional adapter.
  - `@zenginui/mcp`: stdio MCP server with `zengin_check_code`, `zengin_get_violations`, `zengin_describe_system` and `zengin_explain_rules`.
  - `@zenginui/hook`: Claude Code PostToolUse hook that checks every file write and reports violations back to the agent.
  - `@zenginui/cli`: `zengin check`, `zengin explain`, `zengin init`, with `--changed`, `--staged` and GitHub annotation output for CI.

- [`bf6477b`](https://github.com/Timurtek/zengin/commit/bf6477bd04edbd3fc4fdc317bf93d9adb941a09a) Thanks [@Timurtek](https://github.com/Timurtek)! - The npm scope is `@zenginui`: `@zenginui/ui`, `@zenginui/cli`, `@zenginui/engine` and the rest, since the `zengin` org was taken. The unscoped `zenginui` package carries the `zengin` bin, so `npm create zengin@latest my-app` is the install command. Generated projects, the registry's import rewriting, the docs and the rollup history all use the new scope.

### Patch Changes

- Updated dependencies [[`52e16ea`](https://github.com/Timurtek/zengin/commit/52e16eac6c656a7f19ba72f1ed9bf21e46435542), [`8c0024c`](https://github.com/Timurtek/zengin/commit/8c0024c402edaf707ff44e600a96944f1c55975a), [`05568b7`](https://github.com/Timurtek/zengin/commit/05568b7b471b10871260ea85461d4ccbfaf28844), [`156f5f5`](https://github.com/Timurtek/zengin/commit/156f5f5dcfced05199a64628f2d27037d7e974dc), [`6157f71`](https://github.com/Timurtek/zengin/commit/6157f71b414bc588c0bc34eaf46dacdd1ab4513a), [`bf6477b`](https://github.com/Timurtek/zengin/commit/bf6477bd04edbd3fc4fdc317bf93d9adb941a09a), [`9462306`](https://github.com/Timurtek/zengin/commit/946230627df7249acf6e8d650df44d8233369071)]:
  - @zenginui/engine@0.1.0
