# @zengin/engine

Deterministic design-system conformance engine. Code in, structured violations out. No LLM in the loop, no token spend on the check, the same answer every run.

## How it works

Three artifacts, each with one owner:

1. **Definitions**, shipped by the design system inside its package: `tokens.json` in W3C DTCG format and `components.json`, the component manifest. Storybook, docs, the registry and this engine all read the same files.
2. **Policy**, authored by the consumer in `zengin.config.yaml`: which rules are on, at what severity, with what exceptions.
3. **Rule kinds**, implemented here in TypeScript. Consumers configure instances; they never write rule logic.

Tailwind utilities are resolved through Tailwind v4's own compiler, so `px-[13px]` becomes `padding-inline: 13px` exactly as the consumer's build would produce it. The Tailwind default theme is always loaded underneath the system theme, which lets the engine tell "references the default palette" (a policy question) apart from "references nothing" (a typo).

## The seven rule kinds

| Rule | Family | Catches |
| --- | --- | --- |
| `color-literal` | foundation | Hex, rgb, oklch and named colors in classes, inline styles and CSS. Palette utilities like `bg-red-500` in `semantic` mode. |
| `spacing-literal` | foundation | Arbitrary lengths on margin, padding, gap and inset. Default-scale utilities that resolve off the system scale. |
| `token-reference` | foundation | Utilities and `var()` references to tokens that do not exist. |
| `unknown-prop` | contract | Props a system component does not declare. |
| `unknown-prop-value` | contract | Enum values a component does not accept, including values added in a newer version than the project pins. |
| `classname-policy` | contract | `className` or `style` on a system component setting properties the component owns. |
| `component-substitution` | substitution | Imports from packages the system shadows, and raw elements styled as a system component. |

Rules have a scope dimension. Foundation rules run everywhere except theme files. Contract and substitution rules are off inside files the consumer has declared as owned.

## Configuration

```yaml
system:
  package: "@zengin/ui"
  version: "1.2.0"                 # read from node_modules when omitted
  sources: ["@zengin/ui", "@/components/ui/*"]
  definitions: ./node_modules/@zengin/ui/zengin   # default

scope:
  include: ["src/**/*.{ts,tsx,css}"]
  exclude: ["**/*.stories.tsx", "**/*.test.tsx"]
  foundations: ["src/theme/**"]    # literals live here; not checked
  ownership: ["src/components/ui/**"]

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
- `/* zengin-owned Button, forked from @zengin/ui@1.2.0 */` at the top of a file, or a path under `scope.ownership`, marks it owned. Contract and substitution rules turn off. Foundation rules stay on: owning a component never licenses a hardcoded color inside it.

## Usage

```ts
import { createEngine, loadConfigFile, readProjectFiles, resolveConfig } from "@zengin/engine";

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

## Tests

```bash
pnpm test
```

The fixture project under `test/fixtures/project` is the three violation examples from the design record, plus a theme file, a CSS file, a suppression example and an owned component. The snapshot at `test/fixtures/expected/violations.json` is the contract: the engine must return it byte for byte.
