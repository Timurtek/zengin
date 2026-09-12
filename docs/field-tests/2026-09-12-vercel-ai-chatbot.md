# Field test: vercel/ai-chatbot

**Date** 2026-09-12. **Subject** [vercel/ai-chatbot](https://github.com/vercel/ai-chatbot) at `c2f8235`: Next 16, React 19, Tailwind 4.3, 93 TSX files, 22 in `components/ui`, plus a `components/ai-elements` directory. Actively maintained, current shadcn conventions (`radix-ui` unified package, `@theme inline`, oklch), and next door to AI Elements.

Two questions this time: does the shadcn adapter hold up on a Tailwind 4 project it has never seen, and what does the engine get wrong on current code rather than 2023 code.

## Method

`zengin init --from shadcn`, then `zengin check`. No hand-authored definitions. Every violation read and classified by hand, as before.

## First run: 128 violations, 124 files, 0.56 seconds

| Classification | Count | What |
| --- | --- | --- |
| True by rule | 105 | 52 palette colors where semantic tokens exist, including the overlay `bg-black/80` inside shadcn's own dialog, sheet and alert-dialog. 18 raw buttons styled as Button. 34 `className` restylings of system components, at `warn`. One arbitrary optical nudge inside shadcn's `input-group`. |
| Engine defect | 6 | `p-px`, `mx-px`, `my-px` flagged as arbitrary (4): Tailwind's scale is the system's scale here and those are named steps. Two classes under `toast-mobile:` reported as unknown tokens because the resolver had no way to see project-defined variants; they turned out to be a real bug, see below. |
| Adapter defect | 10 | The project imports Radix through the unified `radix-ui` package, which the adapter did not recognise, so `open`, `openDelay`, `closeDelay`, `collapsible` and friends were unknown props (8). A sub-part's `cva()` in `sidebar.tsx` was attributed to `Sidebar` (1). `Command` wraps cmdk, which the adapter did not know (1). |
| Policy gap | 5 | `hidden`, `md:flex`, `md:hidden`, `overflow-hidden`, `overflow-x-auto` on system components. Showing, hiding and clipping are placement, not restyling. |
| Message quality | many | Tailwind's `@property` bookkeeping (`syntax`, `inherits`, `initial-value`) leaked into `classname-policy` messages. `text-red-500` got `text-chart-1` as its fix, the nearest value, when `destructive` is the obvious role. |

## Changes made

Engine, each with a regression test in `packages/engine/test/field2.test.ts`:

- A named step that resolves to a literal (`p-px`) is on-system when the project uses Tailwind's scale. Only values written as arbitrary are arbitrary.
- `classes.css` in the config lists project stylesheets whose `@custom-variant` and `@utility` rules the resolver must compile with. Nested braces handled.
- `@property` declarations are dropped from resolutions.
- `display`, `visibility` and `overflow` are placement categories. The default allow lists include them, including Zengin UI's own manifests.
- A component whose manifest declares no props and extends nothing is uncontracted; `unknown-prop` does not apply to it.
- Palette fixes go by role first: red to `destructive`/`danger`, green to `success`, yellow and orange to `warning`, blue to `info`/`primary`. Value matching remains the fallback.
- oklch values with a `none` hue, which Tailwind 4.3 writes for its greys, now normalise.
- A class whose utility compiles but whose variant does not is reported as an unknown variant, not an unknown token.

Adapter, with fixture and tests:

- `import { HoverCard } from "radix-ui"` is recognised alongside `@radix-ui/react-hover-card`; both spellings land in `replaces`.
- A `cva()` counts for the primary only when it is named for it (`buttonVariants` for `Button`); `sidebarMenuButtonVariants` no longer lends its variants to `Sidebar`.
- Props declared on the primary's own signature are read: string-literal unions become enums with their defaults, `React.ComponentProps<"div">` becomes `extends`.
- `extends` no longer implies `replaces`. A Badge extends `<span>` but does not stand in for every span.
- cmdk, vaul and sonner root props are known.
- The generated config points `classes.css` at the theme file.

## Second run: 109 violations, 0 false positives

| Rule | Count | Notes |
| --- | --- | --- |
| color-literal | 52 | Palette utilities. Fixes now by role where one exists: `text-red-500` to `text-destructive`, `text-neutral-500` to `text-muted-foreground`. The weather card's `text-white` on a gradient is a real gap in the system rather than a mistake in the code: there is no static-white token, and `text-card` by value is the honest but unhelpful answer. |
| classname-policy | 34 | Icon buttons restyled through className (`rounded-full`, `dark:bg-background`), a chat header button rebuilt from scratch on top of `Button`. True by contract, reported at `warn` as the adapter configures. |
| component-substitution | 19 | Eighteen raw buttons that should be `Button`: message actions, version footer navigation, attachment removal, scroll-to-bottom. One arguable: the slash-command menu item is a list item control, and `CommandItem` would be the right answer rather than `Button`. |
| token-reference | 2 | `toast-mobile:w-[356px]` and `toast-mobile:w-fit`. The variant is defined nowhere in the project. A Tailwind 3 `screens` entry that did not survive the v4 migration; both classes render nothing. |
| spacing-literal | 2 | `ml-[-0.15rem]` and `mr-[-0.15rem]` inside shadcn's `input-group`. Arbitrary by rule; an optical nudge in practice. |

**False positives: 0 of 109 by hand classification. Substitution: 19 hits, 18 true, 1 arguable. The adapter needed no hand edits.**

## What it says

- Current shadcn code drifts the same way 2023 shadcn code did: palette colors in feature code, raw buttons in feature code, and shadcn's own primitives shipping `bg-black/80` overlays. The engine's rules did not need to change for the newer conventions; the edges did.
- The engine found a migration bug nobody had noticed: a variant that stopped existing when the project moved to Tailwind 4.
- The adapter's Tailwind 4 path worked on the first real project. What it lacked was current import conventions and the ability to read a component's own signature, both now covered.
- Two field tests, 0 false positives after fixes on both, 275 violations classified by hand in total. Still two data points.

## Reproduce

```bash
git clone --depth 1 https://github.com/vercel/ai-chatbot
cd ai-chatbot
zengin init --from shadcn
zengin check --format json --fail-on never > report.json
```
