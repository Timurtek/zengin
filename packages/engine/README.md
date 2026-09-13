# @zenginui/engine

Deterministic design-system conformance engine. Code in, structured violations out. No LLM in the loop, no token spend on the check, the same answer every run.

## How it works

Three artifacts, each with one owner:

1. **Definitions**, shipped by the design system inside its package: `tokens.json` in W3C DTCG format and `components.json`, the component manifest. Storybook, docs, the registry and this engine all read the same files.
2. **Policy**, authored by the consumer in `zengin.config.yaml`: which rules are on, at what severity, with what exceptions.
3. **Rule kinds**, implemented here in TypeScript. Consumers configure instances; they never write rule logic.

The engine judges CSS declarations. It never knows how a class name is styled; adapters do:

- **Project stylesheets**, always on, no dependency. A `.btn { ... }` rule in any CSS file in scope tells the engine what `className="btn"` does. Only simple single-class selectors are indexed; descendant and compound selectors depend on the DOM and are skipped.
- **Tailwind v4**, optional. Enabled by `classes.tailwind: true`, or automatically when the project depends on `tailwindcss`. Utilities are compiled through Tailwind's own design system, so `px-[13px]` becomes `padding-inline: 13px` exactly as the consumer's build produces it. Tailwind's default theme is loaded underneath the system theme so the engine can tell "references the default palette" (a policy question) apart from "references nothing" (a typo). `tailwindcss` is an optional peer dependency and is never loaded unless enabled.

A project's own stylesheet wins over a utility of the same name. Literal values inside stylesheet classes are reported in the stylesheet, where the fix belongs; the class use on the element is judged only for contract and substitution rules.

## The seven rule kinds

| Rule | Family | Catches |
| --- | --- | --- |
| `color-literal` | foundation | Hex, rgb, oklch and named colors in classes, inline styles and CSS. Palette utilities like `bg-red-500` in `semantic` mode. |
| `spacing-literal` | foundation | Arbitrary lengths on margin, padding, gap and scroll offsets. Position offsets are coordinates and are not judged. With no system spacing tokens, Tailwind's scale is the scale and its steps are suggested. |
| `token-reference` | foundation | Utilities and `var()` references to tokens that do not exist. |
| `unknown-prop` | contract | Props a system component does not declare. |
| `unknown-prop-value` | contract | Enum values a component does not accept, including values added in a newer version than the project pins. |
| `classname-policy` | contract | `className` or `style` on a system component setting properties the component owns. |
| `component-substitution` | substitution | Imports from packages the system shadows, raw elements styled as a system component, and raw elements styled with the system's own `xxxVariants()` function. |

Rules have a scope dimension. Foundation rules run everywhere except theme files. Contract and substitution rules are off inside files the consumer has declared as owned.

## Configuration

```yaml
system:
  package: "@zenginui/ui"
  version: "1.2.0"                 # read from node_modules when omitted
  sources: ["@zenginui/ui", "@/components/ui/*"]
  definitions: ./node_modules/@zenginui/ui/zengin   # default

scope:
  include: ["src/**/*.{ts,tsx,css}"]
  exclude: ["**/*.stories.tsx", "**/*.test.tsx"]
  foundations: ["src/theme/**"]    # literals live here; not checked
  ownership: ["src/components/ui/**"]

classes:
  tailwind: auto                   # auto | true | false; auto = on when package.json depends on tailwindcss
  css: ["app/globals.css"]         # stylesheets whose @custom-variant and @utility rules the class compiler must know

rules:
  color-literal: { severity: error, allow: semantic, except: ["src/marketing/illustrations/**"] }
  spacing-literal: error
  token-reference: error
  unknown-prop: error
  unknown-prop-value: error
  classname-policy: error
  component-substitution:
    severity: error
    map: { "@headlessui/react#Dialog": Dialog }
```

## Violations

Every surface renders the same shape:

```json
{
  "rule": "color-literal",
  "severity": "error",
  "file": "src/features/review/ApproveBar.tsx",
  "range": { "start": { "line": 3, "col": 45 }, "end": { "line": 3, "col": 57 } },
  "found": "bg-[#3B82F6]",
  "message": "Color literal where a token reference is required. The value matches color.primary in the default theme but will not follow theme changes.",
  "fix": { "replace": "bg-primary", "confidence": "exact", "token": "color.primary" },
  "suppress": "// zengin-allow color-literal: <reason>"
}
```

`fix.replace` is a code edit for `range`, never prose. `confidence` is what keeps the engine honest: `exact` can be auto-applied, `nearest` needs a decision, `none` means the engine knows what is wrong and not what is right.

## Suppressions and ownership

- `// zengin-allow color-literal: hero gradient, approved in brand review` on the line above silences that violation. A comment with no reason does not suppress; the violation is kept and annotated.
- `/* zengin-owned Button, forked from @zenginui/ui@1.2.0 */` at the top of a file, or a path under `scope.ownership`, marks it owned. Contract and substitution rules turn off. Foundation rules stay on: owning a component never licenses a hardcoded color inside it.

## Usage

```ts
import { createEngine, loadConfigFile, readProjectFiles, resolveConfig } from "@zenginui/engine";

const { config, dir } = loadConfigFile("zengin.config.yaml");
const resolved = resolveConfig(config, dir);
const engine = await createEngine(resolved);
const violations = engine.check(readProjectFiles(dir, resolved.scope.include, resolved.scope.exclude));
```

## Phase 1 limits, stated

- TSX/JSX and plain CSS. CSS-in-JS template literals are not parsed.
- Class strings are read statically: string literals, template quasis, and arguments to `cva`, `clsx`, `cn`, `cx`, `twMerge`, `tv`. `className={styles[kind]}` is invisible to the engine.
- Sub-part elements like `Dialog.Content` are not contracted yet.
- The raw-element substitution heuristic fires when a replaced intrinsic element carries two or more properties the system component owns. Its false positive rate is unmeasured.
- Width and height on Tailwind's default multiplier scale are treated as layout and not reported.
- A token group may declare `"$extensions": { "zengin": { "extendsDefault": true } }` to say the framework's default scale for that namespace remains on-system (Tailwind `extend` semantics). Without it, defining any token in a namespace makes the defaults in that namespace off-system.
- `className.allow` categories: `margin`, `width`, `height`, `flex-item`, `grid-item`, `position`, `display`, `overflow`, or any CSS property name. Display and overflow are placement: showing, hiding and clipping are not restyling.
- A component whose manifest declares no props and extends nothing is uncontracted: `unknown-prop` does not apply to it.
- Field-tested against two real shadcn codebases (Tailwind 3 and Tailwind 4); see `docs/field-tests/`. Zero false positives after the fixes each run produced.
- Stylesheet resolution indexes single-class selectors only. `.card .btn` and `.btn.primary` are invisible to className checks; their literals are still checked in the stylesheet.
- CSS Modules resolve through the stylesheet index only when the class name in the file matches the one in the JSX, which is not the case for hashed class names. A CSS Modules adapter is a candidate for later.

## Tests

```bash
pnpm test
```

Two fixture projects hold the three violation examples from the design record, one written with Tailwind utilities (`test/fixtures/project`, adapter on) and one in plain CSS (`test/fixtures/project-css`, no adapter). The snapshots under `test/fixtures/expected/` are the contract: the engine must return each byte for byte, and every rule kind fires in both.
