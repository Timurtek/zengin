# @zenginui/adapter-css

Turns a design system that ships as an npm package into Zengin definitions. It reads the package's stylesheet and type declarations and writes the two files the engine needs, plus a config. Nothing is executed.

```bash
zengin init --from package @umami/react-zen    # in the project root
zengin check
```

Verified against [umami-software/umami](../../docs/field-tests/2026-09-12-umami.md): 158 components and 53 tokens derived from `@umami/react-zen` with no hand edits, 147 violations, 0 false positives.

## What it reads

| Input | Where | Becomes |
| --- | --- | --- |
| Custom properties | The package stylesheet that is mostly variables (variables per class rule), found through `exports`, `files` and the package root. `:root`, `html`, `[data-theme="light"]` blocks are the light theme; `[data-theme="dark"]`, `.dark` and `prefers-color-scheme: dark` blocks are the dark overrides. | `zengin/tokens.json` and `zengin/tokens.dark.json`, grouped by what each value is: `color`, `space`, `radius`, `text`, `font`, `shadow`. **Variable names are kept**: each token carries `$extensions.zengin.cssVar`, so the engine recognises `var(--surface-base)` and suggests `var(--surface-base)`. A `var()` to another variable of the same group becomes a DTCG alias. |
| Precompiled utilities | The largest other stylesheet, when one is larger than the theme sheet (`styles.full.css`). | `classes.css` in the config. The engine indexes it, so `className="w-full bg-white"` resolves to declarations without a class compiler, and a shipped `bg-white` is judged where it is used. |
| Type declarations | `types`, `exports["."].types`, or `dist/index.d.ts`. | `zengin/components.json`: one entry per `declare function X`, `declare const X: ForwardRefExoticComponent<…>` or `FC<…>`. Props from the parameter type, followed through interfaces, aliases, intersections, `Omit`/`Pick`/`Partial` and `VariantProps<typeof x>`; string-literal unions become enums, `boolean`, `string`, `number` and function types keep their kind. The `tailwind-variants` or `cva` constant named for the component (`button` for `Button`) supplies the `variant` and `size` values and what those props own. `HTMLAttributes<HTMLButtonElement>` in the chain becomes `extends: button`. |
| Project stylesheets | Any `.css` under the project (not `node_modules`) that defines custom properties on `:root`. | `scope.foundations`. The project's theme layer holds literals by design and is not checked. |

## Passthrough

A component often forwards the props of a type declared in another package: `interface PopoverProps extends Popover.Positioner.Props`. The adapter cannot open that type, so it records it instead:

```json
{ "name": "Popover", "props": { "isOpen": { "type": "boolean" } }, "passthrough": ["@base-ui/react/popover#Popover.Positioner.Props"] }
```

The engine's `unknown-prop` rule does not run on a component with passthrough types, because the manifest cannot say what the component does not accept; enum values are still checked. The report lists every passthrough, so the choice is visible rather than silent. React's own helpers (`RefAttributes`, `HTMLAttributes`) are never passthrough.

## What to review

- **`className.allow`** starts at placement for every component. Layout primitives (`Box`, `Row`, `Column`) are the first to widen.
- **`owns`** is set only for components with a variant map: `variant` owns background, color and border color; `size` owns padding and font. Everything else owns nothing until you say so.
- **Skipped components** are listed in the report: a component with no props type and no variant map has no contract to check.
- **Unclassified variables** are listed too: a `--text-xs--line-height` or an easing curve is not on any scale the rules use.

## API

```ts
import { derivePackage, writePackage, renderReport, deriveTokensFromCss, deriveManifestFromTypes } from "@zenginui/adapter-css";

const d = derivePackage(projectDir, "@umami/react-zen"); // { tokens, tokensDark, components, config, report }
writePackage(projectDir, d, force);                        // zengin/tokens.json, zengin/components.json, zengin.config.yaml
```

`deriveTokensFromCss(css)` and `deriveManifestFromTypes(dts, { importFrom })` are the two halves, usable on their own.
