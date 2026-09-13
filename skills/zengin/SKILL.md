---
name: zengin
description: Write UI code that obeys the project's design system, verified by the Zengin conformance engine. Use whenever you create or edit React components, TSX, or CSS in a project that has a zengin.config.yaml; before reporting any UI work as done; when asked whether code is "on-system"; when a zengin hook or CI check reports violations; or when you need to know which tokens, components, variants and props the design system actually provides.
---

# Zengin

Zengin turns a design system's rules into a deterministic check. You submit code, it returns violations with the exact edit that fixes each one. No judgement, no token spend, the same answer every time. Your job is to run the check before you call UI work finished, apply the fixes, and never work around the rules.

## The loop

1. **Learn the system before writing.** Call `zengin_describe_system` (or run `zengin explain` and read `tokens.json` / `components.json`). Note the token names, the component names, and each component's props and enum values. Write against what exists, not what you expect a system to have.
2. **Write the code.**
3. **Check it before it lands.** Call `zengin_check_code` with the project-relative path the file will live at and the full content. The path matters: it decides the parser and which scope applies.
4. **Apply the fixes by confidence.**
   - `exact`: apply `fix.replace` verbatim to the text in `range`.
   - `nearest`: read `fix.note` and `fix.candidates`, decide, then apply. When several tokens share a value, pick by role: a button background is `color.primary`, not `color.on-danger`, even if both are white.
   - `none`: the engine knows what is wrong but not what is right. Go back to step 1 and find the token, variant or component that expresses the intent.
5. **Re-check until clean.** Then write the file.
6. **If a hook or CI reports violations after a write**, treat the output exactly like step 4. The hook shows only the lines you touched and says how many pre-existing problems it left alone; fix yours, do not "clean up" the rest unless asked.

Without MCP, run `zengin check <path>` from the project. Same violations, same fixes.

## Reading a violation

```
rule, severity, file, range {start{line,col}, end{line,col}}, found, message,
fix { replace: string | null, confidence: exact | nearest | none, token?, candidates?, note? },
suppress, note?
```

`fix.replace` replaces exactly the text in `range`, nothing more. `found` is that text as written, so you can locate it. `suppress` is the comment that would silence the violation; read the rules below before using it.

## The seven rules and how to satisfy them

| Rule | It fires when | Satisfy it by |
| --- | --- | --- |
| `color-literal` | A hex, rgb, oklch or named color appears in a class, inline style or CSS. A palette utility like `bg-red-500` in `semantic` mode. **A literal equal to the token's value is still a violation**: it will not follow the theme. | Reference the token: `bg-primary`, `var(--color-primary)`. |
| `spacing-literal` | Margin, padding, gap or inset uses a length not on the spacing scale, or a default-scale utility that resolves off it. | Use the nearest scale step the note lists, or ask whether the design needs an off-scale value. |
| `token-reference` | A class or `var()` names a token that does not exist. | Use the token the fix suggests, or look it up with `zengin_describe_system`. |
| `unknown-prop` | A system component gets a prop its manifest does not declare. DOM, `aria-*`, `data-*` and `on*` props pass through. | Use the declared prop, often a typo away. |
| `unknown-prop-value` | An enum prop gets a value the component does not accept, or one added in a newer version than the project pins. `variant="ghost-danger"` decomposes to `variant="ghost" tone="danger"`. | Use a declared value. Never invent compound values. |
| `classname-policy` | `className` or `style` on a system component sets a property the component owns: background, color, padding, radius, font. | Use the prop that owns it (`tone`, `size`). `className` on a system component is for placement only: margin, width, flex and grid item, position. |
| `component-substitution` | You imported a primitive the system shadows (`@headlessui/react` Dialog, a raw `@radix-ui` package) or styled a raw `<button>` like the system Button. | Import the system component. Express the styling through its props. |

## The customization contract

There are four legitimate ways to get a different look, in order. Try them in this order and stop at the first that works.

1. **Brand**: change tokens in the theme files. The only place literal values live.
2. **Appearance**: a documented variant or prop. `variant`, `tone`, `size`.
3. **Composition**: slots, and `className` for placement in the parent.
4. **Ownership**: a declared, forked copy of the component, under `scope.ownership` or with a `/* zengin-owned Button, forked from @zenginui/ui@1.2.0 */` pragma. Contract and substitution rules turn off inside it. Foundation rules stay on: an owned component still uses tokens.

There is no fifth option where `className` becomes a styling API. If the system lacks a variant the design needs, say so to the human and propose the variant. Do not restyle around the component, and do not fork it silently to escape a check.

## Suppressions

`// zengin-allow <rule>: <reason>` on the line above silences one violation. A comment without a reason does nothing, by design.

Use it only when the human has said the exception is intended (a brand illustration, a marketing gradient approved in review) and write the reason they gave. Never suppress to make a check pass. Never add an ownership pragma to a file to make contract rules stop firing. Suppression counts are reported to the design system owner; an unexplained one is a defect you introduced.

## Things that look right and are wrong

- Copying a color from a screenshot or a rendered page. It matches today and drifts on the first theme change.
- `bg-blue-500`, `text-gray-700`: palette scales are literals wearing a utility class.
- `p-[13px]`, `gap-[7px]`: arbitrary values are off the scale by definition.
- `<Button className="rounded-none bg-red-500">`: that is a `tone="danger"` with a shape decision the system already made.
- `import { Dialog } from "@headlessui/react"` when the system ships a Dialog. Two dialogs in one codebase is exactly the drift Zengin exists to stop.
- Reporting UI work done without having run the check.

## Tools

| Tool | Use for |
| --- | --- |
| `zengin_check_code` | Code that is not on disk yet. Path plus content. The main loop. |
| `zengin_get_violations` | Files on disk, or the whole project. Filters by path, rule, severity. |
| `zengin_describe_system` | Tokens by namespace, or one component's contract: props, values, what `className` may set, what the component owns. |
| `zengin_explain_rules` | What each rule checks and how this project configures it. |

CLI equivalents: `zengin check [paths] [--changed <ref>] [--format json]`, `zengin explain [rule]`.
