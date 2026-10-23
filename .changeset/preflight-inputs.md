---
"@zenginui/engine": minor
"@zenginui/adapter-css": minor
"@zenginui/cli": minor
---

`zengin init --from package` reads design systems as real monorepos ship them, and `zengin check` resolves Tailwind 3 projects. Found in preflights on Comp, Sim and Dub, where all three needed hand preparation and Dub got no class resolution at all:

- **Barrels and TypeScript source.** The package's types entry is followed through `export *` and `export { } from` re-exports and the files they import. A declaration entry yields every declaration file's components; a source entry (`"types": "./src/index.ts"`, the shape of an internal package consumed through `transpilePackages`) is read as source, including `const Button = forwardRef(...)` exported by `export { Button }`. Package components read from source get the same `replaces` and variant `owns` as from declarations. Comp's design system goes from 0 components to 351, Sim's to 309, with no build step.
- **Tokens outside the package.** When the package's stylesheets define no tokens (or it ships none), the adapter looks in the project's `:root` stylesheets, in stylesheets the project imports by relative path (`@import "../../../packages/tailwind-config/themes.css"`), and in the package's own dependencies. `--tokens <css>` names them outright.
- **RGB channel triples are colors.** `--bg-default: 255 255 255`, used as `rgb(var(--bg-default) / <alpha-value>)`, is a color token, and fixes refer to it as `rgb(var(--bg-default))`: tokens can carry `$extensions.zengin.reference` for any variable that is not referred to as `var(--x)`.
- **Tailwind 3.** `tailwindcss` is loaded from the project first, then from beside the engine, so `npx` and global installs check against the project's own version. A Tailwind 3 project resolves classes through its `tailwind.config` (loaded as Tailwind's build loads it, `classes.config` to name another) and Tailwind 3's own rule generator.
- **The palette, when the system uses it.** When the package's own code styles with ten or more Tailwind palette classes, the adapter writes `color-literal: allow: palette` and says so; under `allow: palette` a palette step passes in Tailwind 3 too, where it compiles to a literal.
