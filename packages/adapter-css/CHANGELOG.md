# @zenginui/adapter-css

## 0.1.0

### Minor Changes

- [`52e16ea`](https://github.com/Timurtek/zengin/commit/52e16eac6c656a7f19ba72f1ed9bf21e46435542) Thanks [@Timurtek](https://github.com/Timurtek)! - `@zenginui/adapter-css` and `zengin init --from package <name>`: definitions from an installed design-system package. Tokens from its stylesheet with the variable names kept (`$extensions.zengin.cssVar`), a component manifest from its `.d.ts` (props, `tailwind-variants` enums, `extends` from `HTMLAttributes`, `passthrough` for types declared elsewhere), `classes.css` pointed at its precompiled utilities, and project theme stylesheets as foundations. Verified on umami-software/umami: 147 violations, 0 false positives.
  
  Engine: `classes.css` stylesheets are indexed as `external` class resolutions; `$extensions.zengin.cssVar` sets a token's variable name; manifests may declare `passthrough`, which turns `unknown-prop` off for that component with the reason on record; a nearest spacing fix is offered only when the neighbour is within 4px or half the value; fully transparent hex and rgba values are not color literals.
  
  Zengin UI: a `border.width` token (`--border-width`) and a `color.outline` token (`--color-outline`, transparent by default) that every component border uses, so a theme can thicken and darken every rule at once. New `brutal` theme: neo-brutalism, 2px black borders, hard offset shadows, square corners, yellow primary with black text, Archivo Black headlines.

- [`bf6477b`](https://github.com/Timurtek/zengin/commit/bf6477bd04edbd3fc4fdc317bf93d9adb941a09a) Thanks [@Timurtek](https://github.com/Timurtek)! - The npm scope is `@zenginui`: `@zenginui/ui`, `@zenginui/cli`, `@zenginui/engine` and the rest, since the `zengin` org was taken. The unscoped `zenginui` package carries the `zengin` bin, so `npm create zengin@latest my-app` is the install command. Generated projects, the registry's import rewriting, the docs and the rollup history all use the new scope.

### Patch Changes

- Updated dependencies [[`52e16ea`](https://github.com/Timurtek/zengin/commit/52e16eac6c656a7f19ba72f1ed9bf21e46435542), [`8c0024c`](https://github.com/Timurtek/zengin/commit/8c0024c402edaf707ff44e600a96944f1c55975a), [`05568b7`](https://github.com/Timurtek/zengin/commit/05568b7b471b10871260ea85461d4ccbfaf28844), [`156f5f5`](https://github.com/Timurtek/zengin/commit/156f5f5dcfced05199a64628f2d27037d7e974dc), [`6157f71`](https://github.com/Timurtek/zengin/commit/6157f71b414bc588c0bc34eaf46dacdd1ab4513a), [`bf6477b`](https://github.com/Timurtek/zengin/commit/bf6477bd04edbd3fc4fdc317bf93d9adb941a09a), [`9462306`](https://github.com/Timurtek/zengin/commit/946230627df7249acf6e8d650df44d8233369071)]:
  - @zenginui/engine@0.1.0
