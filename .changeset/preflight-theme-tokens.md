---
"@zenginui/engine": minor
"@zenginui/adapter-css": minor
---

Fixes from preflights on three real Tailwind design systems (Comp, Sim, Dub), where most of a first run was false positives:

- **`@theme` blocks are read.** The engine compiles the `@theme` and `@theme inline` blocks of the stylesheets in `classes.css` along with the tokens, so `text-muted-foreground` (from `--color-muted-foreground: var(--muted-foreground)`) is a utility again instead of "no token matches", and a variable the project's `@theme` redefines (`--radius-md`) no longer counts as Tailwind's default. `zengin init --from package` lists the design system's and the project's `@theme` stylesheets in `classes.css`, and reads literal `@theme` values as tokens.
- **Tailwind's scales are extended, not replaced.** A handful of length variables is not a whole scale, and Tailwind 4's `@theme` extends unless a namespace is reset. The adapter marks spacing, type sizes and radii `extendsDefault` (as adapter-shadcn does for radii) unless the stylesheet resets `--spacing-*`, `--text-*` or `--radius-*`, and `spacing-literal` now honours `extendsDefault` for Tailwind's default steps, as `token-reference` already did.
- **`--text-*` holds colors and sizes.** A color token named `--text-muted` no longer goes into the compiled `@theme`, where Tailwind read it as a font size. Breakpoints and other Tailwind lengths are no longer classified as spacing.
- **cva constants named `<name>Variants`.** The adapter reads the function type tsc emits for a cva constant and links `buttonVariants` to `Button` by name, and reads `cva()`/`tv()` calls in source, so `variant` and `size` reach the manifest.
- **`component-substitution` wants a box.** A raw element styled only with the component's text color and font is a link-like control, not a stand-in: at least one of background, border or padding is now required.
