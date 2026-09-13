# @zenginui/registry

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
| `src/components/ui/<name>/` | The component's TSX and CSS, copied in. The TSX opens with `/* zengin-owned Button, forked from @zenginui/ui@0.1.0 */`, which the engine and the rollup read. |
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

A directory of static JSON, so it can be served from anywhere: `index.json` lists every item without file contents; `items/<name>.json` carries the files. The marketing site serves the public one at `https://zengin.timurtek.com/r`, rebuilt on every deploy. `ZENGIN_REGISTRY` or `--registry <dir|url>` points the CLI elsewhere, which is how a private registry of paid templates works later: same shape, a different URL, a token on the request.

```bash
zengin registry build --out public/r        # from a Zengin repository checkout
```

Items are built, never hand-written. Components come from `packages/ui/src/components`, their stories from `packages/ui/stories`, their manifest entries from `packages/ui/zengin/components.json`. Templates come from `examples/` (every template is a real app there, recorded in the item's `source` field, which the marketing site builds as the template's live preview) with `@zenginui/ui` imports rewritten to `@/components/ui`. The `default` theme is generated from the token files rather than read from a file, so applying it over another brand resets every token. The one test that matters: every template creates a project the engine finds clean.

| Item type | Examples | Installs |
| --- | --- | --- |
| `component` | `button`, `dialog`, `tabs` | TSX and CSS under `src/components/ui`, the story, the manifest entry, the barrel export, the stylesheet import |
| `template` | `blank`, `marketing`, `review`, `saas`, `chat`, `auth`, `docs`, `storefront` | App files under `src/` plus `index.html`; depends on the components it uses |
| `lib` | `lib-cx`, `lib-chart`, `lib-markdown` | `src/lib/<name>.ts`; every file in `packages/ui/src/internal` is one, named `lib-<file>` so it cannot collide with a component, and components depend on the ones they import |
| `definitions` | `foundation` | `zengin/tokens.json`, `zengin/tokens.dark.json`, `src/styles/base.css` |
| `theme` | `brutal`, `default`, `meadow`, `plex`, `spec-sheet`, `zengin` | `src/theme/brand.css`, replacing the current one, plus the theme's fonts link in `index.html` |
| `icons` | `icons-lucide`, `icons-tabler`, `icons-phosphor`, `icons-heroicons`, `icons-feather`, `icons-radix`, `icons-material`, `icons-bootstrap` | `src/lib/icons.tsx` rewritten so the icon vocabulary draws from that react-icons set, plus the `react-icons` dependency. The names stay; every `<Icon.Name />` follows |
| `fonts` | `fonts-inter`, `fonts-plex`, `fonts-archivo`, `fonts-geist`, `fonts-space`, `fonts-manrope`, `fonts-fraunces`, `fonts-playfair`, `fonts-dm`, `fonts-brutal` | No files: a pairing of three roles (headlines, text, code), each a Google Fonts family at its weights. `zengin fonts <name>` rewrites the three font tokens in `src/theme/brand.css` and the fonts link; nothing else changes |

## Themes and brands

A theme is a brand file in the registry (`packages/ui/themes/<name>/brand.css` with a `theme.json` naming its fonts). `zengin theme <name>` swaps it in; `zengin create --theme <name>` applies it at creation. A theme is the whole brand: applying one replaces the file, so the previous brand is gone, which is what a swap means.

`zengin brand` generates a brand file instead of picking one: `derivePalette(hex)` builds both schemes from one color in OKLCH and pushes every component pairing to WCAG AA; `renderBrandCss` writes it with the fonts and radii; `brandProject` adds the logo, favicon, wordmark and `index.html` patches. Both are exported for programmatic use.

## Fonts

A pairing is three roles, `display`, `sans` and `mono`, each a Google Fonts family at the weights the components use, with a serif flag that picks the fallback stack. They live in `packages/ui/fonts/<name>/fonts.json` and reach the registry as `fonts-<name>`; people say the bare name.

```bash
zengin fonts                    # the pairings, with their three families
zengin fonts fraunces           # --font-display, --font-sans, --font-mono in brand.css, and the fonts link in index.html
zengin fonts geist --self-host  # the woff2 files into public/fonts, @font-face in src/theme/fonts.css, no Google Fonts at runtime
zengin brand --name Acme --fonts plex   # a pairing name in place of the three --font-* families
```

A theme carries its own fonts; a pairing applied after it wins for type only, the palette, radii and shadows stay. On the marketing site the catalog's font picker passes `?fonts=<name>` to every preview, which applies the pairing the same way `zengin fonts` does.

## Icons

Zengin UI draws by name. `Icon.Search`, `Icon.Close`, `Icon.ChevronDown` and sixty more are one component each, exported from `@zenginui/ui` and, in a project, from `src/lib/icons.tsx` (the `lib-icons` item, which every component that draws an icon depends on). The default drawings are Zengin UI's own: 16 units, a 1.75 stroke, `currentColor`, sized by font-size. Components use the same names for their chevrons, checks and close buttons, so a set change reaches inside them.

```bash
zengin icons                  # lucide, tabler, phosphor, heroicons, feather, radix, material, bootstrap
zengin icons tabler           # src/lib/icons.tsx rewritten: the same Icon object, drawn by react-icons/tb; react-icons added to package.json
```

The manifest carries an `Icon` entry that shadows `react-icons/*`, `lucide-react`, `@tabler/icons-react`, `@phosphor-icons/react`, `@heroicons/react/*` and `@radix-ui/react-icons`: an app file importing a glyph from any of them is a `component-substitution` violation with the fix `import { Icon } from "@/lib/icons"`. `src/lib/**` is owned, so the rewritten file itself is exempt. On the marketing site the catalog's icon picker passes `?icons=<set>` to every preview; the preview loads the set on demand and swaps the drawings at runtime with `setIconSet`, which a project never needs.

A set maps every vocabulary name to a real export of its react-icons module; the registry's tests import each module and check every name. Radix has no glyph for a few names (folder, database, terminal) and reuses the closest one; the others map one to one.

## Upgrading owned components

`zengin upgrade` compares three things per owned file: the hash in its pragma (what was copied), the file now (what the project did), and the registry's file (what the system did). Upstream-only changes are taken with `--write`; local-only changes are left alone; both changed is a conflict with a diff in the report and `--force` to take upstream. The pinned version in `zengin.config.yaml` moves when nothing is held. Libs under `src/lib` follow the same comparison. Stories are the project's from the start and are never touched.

## Next.js

`zengin create acme --framework next` writes the App Router under `src/app` instead of `index.html`, `src/main.tsx` and a Vite config: `layout.tsx` carries the template's stylesheet imports, its title as metadata and its fonts link in `<head>`; `page.tsx` mounts the template's `App` client-side with `next/dynamic` and `ssr: false`, since the templates read `window` and `document` in hooks the way an SPA does. `zengin theme`, `zengin fonts` and `zengin brand` patch the layout's head exactly as they patch `index.html`. Everything else, the components, the definitions, the engine, the hook and the MCP server, is the same project.

## Programmatic use

```ts
import { buildRegistry, createProject, installItems, openRegistry, resolveItems } from "@zenginui/registry";

const source = openRegistry();                       // the public registry, or ZENGIN_REGISTRY
const result = await createProject({ dir: "acme", template: "review", source });
const items = await resolveItems(source, ["dialog"]);
installItems({ projectDir: "acme", items, version: (await source.index()).version });
```

## Before the first npm release

Created projects depend on `@zenginui/cli`, `@zenginui/mcp` and `@zenginui/hook` from npm. Until those are published, `zengin create --local <path to this repository>` links them from the checkout with `link:`, which pnpm resolves. That is how the generator is tested.
