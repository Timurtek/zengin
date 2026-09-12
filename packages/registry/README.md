# @zengin/registry

Components, templates and definitions as installable items, and the generator behind `zengin create` and `zengin add`. This is the shadcn model with the piece shadcn lacks: what gets copied into a project stays understood by the engine, so it can be checked, tracked and upgraded.

```bash
zengin create acme --template marketing     # a project that owns its components, checked before it prints
cd acme && npm install && npm run dev
zengin add dialog tooltip                   # more items from the registry
zengin tokens                               # zengin/tokens*.json to src/styles/generated/tokens.css
```

## What a created project looks like

| Path | What |
| --- | --- |
| `src/components/ui/<name>/` | The component's TSX and CSS, copied in. The TSX opens with `/* zengin-owned Button, forked from @zengin/ui@0.1.0 */`, which the engine and the rollup read. |
| `src/components/ui/index.ts` | The barrel. The engine treats `@/components/ui` as the system. |
| `src/lib/cx.ts` | The one shared helper. |
| `zengin/` | `tokens.json`, `tokens.dark.json`, `components.json`. The manifest entries arrive with each component, `export.from` already pointing at the alias. |
| `src/styles/` | `base.css`, `index.css` with one `@import` per component, `generated/tokens.css` built by `zengin tokens`. |
| `src/theme/brand.css` | Token overrides. The one place literals are allowed. |
| `zengin.config.yaml` | `system.package: "@/components/ui"`, `definitions: ./zengin`, `ownership: src/components/ui/**`, every rule at error. |
| `.mcp.json`, `.claude/settings.json` | The MCP server and the edit hook. |
| `.storybook/`, `stories/` | Storybook with the theme toolbar and one story file per component, reading the manifest. `--no-storybook` leaves them out. |

The generator runs the engine on the result before it returns. A fresh project reports zero violations, or the registry is wrong.

## The registry

A directory of static JSON, so it can be served from anywhere: `index.json` lists every item without file contents; `items/<name>.json` carries the files. The marketing site serves the public one at `https://zengin-marketing-site.vercel.app/r`, rebuilt on every deploy. `ZENGIN_REGISTRY` or `--registry <dir|url>` points the CLI elsewhere, which is how a private registry of paid templates works later: same shape, a different URL, a token on the request.

```bash
zengin registry build --out public/r        # from a Zengin repository checkout
```

Items are built, never hand-written. Components come from `packages/ui/src/components`, their stories from `packages/ui/stories`, their manifest entries from `packages/ui/zengin/components.json`. Templates come from `examples/` (every template is a real app there, recorded in the item's `source` field, which the marketing site builds as the template's live preview) with `@zengin/ui` imports rewritten to `@/components/ui`. The `default` theme is generated from the token files rather than read from a file, so applying it over another brand resets every token. The one test that matters: every template creates a project the engine finds clean.

| Item type | Examples | Installs |
| --- | --- | --- |
| `component` | `button`, `dialog`, `tabs` | TSX and CSS under `src/components/ui`, the story, the manifest entry, the barrel export, the stylesheet import |
| `template` | `blank`, `marketing`, `review`, `saas` | App files under `src/` plus `index.html`; depends on the components it uses |
| `lib` | `cx`, `chart` | `src/lib/<name>.ts`; every file in `packages/ui/src/internal` is one, and components depend on the ones they import |
| `definitions` | `foundation` | `zengin/tokens.json`, `zengin/tokens.dark.json`, `src/styles/base.css` |
| `theme` | `default`, `meadow`, `plex`, `spec-sheet` | `src/theme/brand.css`, replacing the current one, plus the theme's fonts link in `index.html` |

## Themes and brands

A theme is a brand file in the registry (`packages/ui/themes/<name>/brand.css` with a `theme.json` naming its fonts). `zengin theme <name>` swaps it in; `zengin create --theme <name>` applies it at creation. A theme is the whole brand: applying one replaces the file, so the previous brand is gone, which is what a swap means.

`zengin brand` generates a brand file instead of picking one: `derivePalette(hex)` builds both schemes from one color in OKLCH and pushes every component pairing to WCAG AA; `renderBrandCss` writes it with the fonts and radii; `brandProject` adds the logo, favicon, wordmark and `index.html` patches. Both are exported for programmatic use.

## Programmatic use

```ts
import { buildRegistry, createProject, installItems, openRegistry, resolveItems } from "@zengin/registry";

const source = openRegistry();                       // the public registry, or ZENGIN_REGISTRY
const result = await createProject({ dir: "acme", template: "review", source });
const items = await resolveItems(source, ["dialog"]);
installItems({ projectDir: "acme", items, version: (await source.index()).version });
```

## Before the first npm release

Created projects depend on `@zengin/cli`, `@zengin/mcp` and `@zengin/hook` from npm. Until those are published, `zengin create --local <path to this repository>` links them from the checkout with `link:`, which pnpm resolves. That is how the generator is tested.
