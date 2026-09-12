# Field test: shadcn/taxonomy

**Date** 2026-09-12. **Engine** @zengin/engine at the commit this file lands in. **Subject** [shadcn-ui/taxonomy](https://github.com/shadcn-ui/taxonomy) at `298a885`: 94 TSX files, 36 of them in `components/ui`, Tailwind 3, Next 13. The archetype of a copied-components React app, and old enough to have real drift.

The question was the one the design record left open: what is the false-positive rate of the rules, and of the raw-element substitution heuristic in particular, on code nobody wrote for Zengin.

## Method

Definitions were derived from the project's own system, not invented. The theme variables in `styles/globals.css` became `tokens.json` (HSL triples converted to hex), the `borderRadius` and `fontFamily` overrides in `tailwind.config.js` became radius and font tokens, and 22 of the 36 `components/ui` files became `components.json` entries with their real variants. `components/ui/**` was declared owned, `styles/**` foundation, and the Tailwind adapter on. All seven rules at `error`. Every violation was then read and classified by hand.

## First run: 41 violations, 122 files, 0.5 seconds

| Classification | Count | What |
| --- | --- | --- |
| True positive | 28 | 15 palette colors where semantic tokens exist, including two inside shadcn's own `toast.tsx`. 6 dead classes referencing colors that do not exist, one of them a real typo in shadcn's `command.tsx` (`text-foreground-muted` for `text-muted-foreground`). 4 arbitrary spacings. 3 `className` restylings of system components. |
| Engine false positive | 6 | `sr-only` on a `Label` reported as restyling (2). `autoCapitalize`, `autoCorrect` and `size` on `Input` reported as unknown props (3). A type-only `AvatarProps` import reported as a shadowed component (1). |
| Definition false positive | 4 | `rounded-2xl` and `font-mono` (3) reported as off-system. They exist in this project because Tailwind's `extend` keeps the defaults, and the derived definitions had no way to say so. |
| Policy question | 3 | `left-[-200px]`, `top-[1px]`, `marginLeft: "-3px"`: position offsets and an optical nudge in an OG-image renderer. Coordinates, not rhythm. |

The substitution heuristic itself produced **zero raw-element hits and one import hit, which was the false positive**. It also **missed six raw buttons** styled with `cn(buttonVariants(...))`, because their classes come from a call the engine cannot resolve statically. Those are the most common form of substitution in shadcn codebases.

## Changes made

Every finding above became an engine change or a definitions feature, with a regression test in `packages/engine/test/field.test.ts`:

- **`sr-only` and `not-sr-only`** are exempt from `classname-policy`. Visually-hidden is not a styling decision.
- **`extends` passthrough** now covers the full React DOM attribute set, global and per-element, instead of a short list. An incomplete list here is the most expensive kind of noise.
- **Type-only imports and `*Props` names** are never substitution candidates.
- **Raw elements styled with `<name>Variants(...)`** are substitutions when the system has a component of that name. The fix rewrites to the component and says to pass the arguments as props.
- **Position offsets** (`top`, `left`, `inset`) are no longer spacing properties. Margin, padding, gap and scroll offsets still are.
- **`$extensions.zengin.extendsDefault`** on a token group declares that the framework's default scale remains on-system for that namespace. `token-reference` respects it. This is what a shadcn adapter will set automatically for every `extend` key.
- **Tailwind step suggestions** when the system defines no spacing tokens: `p-[1px]` gets `p-px` as an exact fix, `gap-[13px]` gets `gap-3` as nearest.

## Second run: 35 violations, all true positives

| Rule | Count | Notes |
| --- | --- | --- |
| color-literal | 15 | Palette utilities in feature code and in shadcn's toast. Fixes: `text-red-600` to `text-destructive` (nearest by value), `bg-white` to `bg-background`, and so on. |
| component-substitution | 6 | Six raw buttons styled with `buttonVariants()`, one each in billing-form, editor, post-create-button, user-name-form and two in user-auth-form. Every one should be `<Button>`. |
| token-reference | 6 | `hover:text-brand` (3), `divide-border-200`, `text-on-popover`, and the `command.tsx` typo. All dead classes that render nothing. |
| spacing-literal | 5 | `p-[1px]` (2, fix `p-px`), `px-[0.3rem]` and `py-[0.2rem]` (fixes `px-1`, `py-1`), `marginLeft: "-3px"` in the OG renderer (weak). |
| classname-policy | 3 | `!pl-14` on Alert, `px-0` on Button, `sm:pr-12` on Input. True by the contract. Whether a shadcn project wants that contract is their policy; the rule is configurable per component through `className.allow`. |

**False positives after the changes: 0 of 35. Substitution heuristic: 6 hits, 6 true.** One codebase is one data point, not a rate, and this codebase predates the `size="icon"` variant that would resolve the `px-0` case.

## What it says about the engine

- The engine finds things a human review missed for years: a typo in a library shipped to thousands of projects, and dead classes that silently render nothing.
- The expensive noise is not in the rules but in the edges: attribute lists, type imports, accessibility utilities, framework `extend` semantics. Those are now fixed once, centrally.
- The substitution heuristic is too conservative rather than too eager. The `Variants()` pattern was the miss, and it is the common one.
- Deriving definitions from a shadcn project is mechanical: a theme file, a config file, and a directory of `cva` calls. The adapter is worth building.

## Reproduce

```bash
git clone --depth 1 https://github.com/shadcn-ui/taxonomy
cd taxonomy
# write zengin/tokens.json, zengin/components.json and zengin.config.yaml as described above
zengin check --format json --fail-on never > report.json
```

The derivation script used for this run is not part of the repository; the shadcn adapter will replace it.
