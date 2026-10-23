# @zenginui/adapter-css

Turns a design system that ships as an npm package into Zengin definitions. It reads the package's stylesheets and its types (declarations or TypeScript source) and writes the two files the engine needs, plus a config. Nothing is executed.

```bash
zengin init --from package @umami/react-zen    # in the project root
zengin check
```

Verified against [umami-software/umami](../../docs/field-tests/2026-09-12-umami.md): 158 components and 53 tokens derived from `@umami/react-zen` with no hand edits, 147 violations, 0 false positives. Since 2026-10-22 it also reads Comp's (`@trycompai/design-system`, TypeScript source behind barrels), Sim's (`@sim/emcn`, a workspace package with no stylesheet) and Dub's (`@dub/ui`, tokens in a sibling preset, Tailwind 3) without hand preparation.

## What it reads

| Input | Where | Becomes |
| --- | --- | --- |
| Custom properties | The package stylesheet that is mostly variables (variables per class rule), found through `exports`, `files` and the package root; failing that, the project's `:root` stylesheets, stylesheets it imports by relative path, then the package's dependencies; or what `--tokens <css>` names. Literal values in `@theme` blocks count. `:root`, `html`, `[data-theme="light"]` blocks are the light theme; `[data-theme="dark"]`, `.dark` and `prefers-color-scheme: dark` blocks are the dark overrides. | `zengin/tokens.json` and `zengin/tokens.dark.json`, grouped by what each value is: `color`, `space`, `radius`, `text`, `font`, `shadow`. **Variable names are kept**: each token carries `$extensions.zengin.cssVar`, so the engine recognises `var(--surface-base)` and suggests `var(--surface-base)`. A `var()` to another variable of the same group becomes a DTCG alias. RGB channels (`--bg-default: 255 255 255`) are colors referred to as `rgb(var(--bg-default))`. Spacing, type sizes and radii extend Tailwind's scale unless the sheet resets the namespace (`--spacing-*: initial`). |
| Precompiled utilities | The largest other stylesheet, when one is larger than the theme sheet (`styles.full.css`). | `classes.css` in the config. The engine indexes it, so `className="w-full bg-white"` resolves to declarations without a class compiler, and a shipped `bg-white` is judged where it is used. |
| Types | `types`, `exports["."].types`, or `dist/index.d.ts`, followed through `export *` barrels. A source entry (`./src/index.ts`) is read as source. | `zengin/components.json`: one entry per component. Props from the parameter type, followed through interfaces, aliases, intersections, unions (a key in several members merges its values), `Omit`/`Pick`/`Partial` and `VariantProps<typeof x>`; string-literal unions become enums, `boolean`, `string`, `number` and function types keep their kind. The `tailwind-variants` or `cva` constant named for the component (`button` or `buttonVariants` for `Button`) supplies the `variant` and `size` values and what those props own; a boolean variant is a boolean prop. `HTMLAttributes<HTMLButtonElement>` in the chain becomes `extends: button`. What `Omit` removes and the type does not declare again becomes `omits`. |
| Project stylesheets | Any `.css` under the project (not `node_modules`) that defines custom properties on `:root`. | `scope.foundations`. The project's theme layer holds literals by design and is not checked. The ones with `@theme` blocks also go in `classes.css`, so the utilities they define resolve. |
| What the project scans | `tsconfig.json` `include`, Tailwind 3 `content`, Tailwind 4 `@source`. | `scope.include`. Anything that covers the whole project scopes the whole project, minus build output, tests and stories. |
| Palette use | The package's own utility sheet or source. | `color-literal: allow: palette` when it styles with ten or more Tailwind palette classes: the palette is part of that system. |

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

## From the project's own source

`zengin init --from package` reads an installed design system. `zengin define` reads the one you are writing.

A component a project owns sits in an ownership path, where the contract and substitution rules are off so the
file may style itself freely. That is right for the file and wrong for everyone else: nothing tells the rest of
the project what the component accepts, so a misspelled prop or an invented variant passes unnoticed. The
component has joined the system's surface without joining its rules.

`deriveManifestFromSource` closes that. Props come from the TypeScript types the component already declares,
with named aliases opened so `variant?: ButtonVariant` reads as the enum it is; defaults come from the
destructuring in the component's own signature; `extends` from the element whose attributes pass through; and
`owns` from the component's stylesheet, since a property the component's own class sets is a property a caller
must not set from outside. A property declared under `[data-tone="..."]` is attributed to `tone`, and one
declared under a state the component sets for itself, like `[data-disabled]`, is attributed to nobody.

`mergeIntoManifest` folds the result into the manifest the project already has, and never removes. A prop the
manifest carries and the source cannot see survives, a hand-declared enum beats a type the walker could not
open, and a disagreement about which prop controls a property is reported rather than resolved.
