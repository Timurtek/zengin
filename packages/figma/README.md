# @zenginui/figma

Figma both ways for a Zengin system. One rule carries both directions: a variable is named like its token, with slashes for dots, and its code syntax is the CSS custom property. `color.primary.soft` is `color/primary/soft` in Figma and `var(--color-primary-soft)` in code. That is the Carbon model, and it is what lets a designer's change come back into the token file with the token's own unit.

```bash
zengin figma export                          # zengin/tokens*.json with src/theme/brand.css over them -> figma/variables.json
zengin figma export --no-brand               # the token files alone: the system defaults
zengin figma export --themes themes          # the same, plus a Theme collection with a mode per themes/<name>/brand.css
zengin figma plugin                          # a Figma plugin into figma/plugin/, to import that payload into any file
zengin figma import figma/local.json         # what the plugin (or the REST API) exported -> a report; --write updates the token files
zengin figma connect --map figma/map.json    # Code Connect files from zengin/components.json
```

## Variables

`export` turns the light and dark token files into one collection with Light and Dark modes: colors as COLOR, lengths as FLOAT in px (rem converted at 16), durations as FLOAT in ms, weights and line heights as FLOAT, easings and shadows as STRING, and a font as its stack's first family, the one a Figma font picker can load. Every variable gets scopes fit for its namespace (fills and strokes for colors, gap for spacing, corner radius for radii, stroke weight for the border width, font size for text sizes) and `codeSyntax.WEB` set to `var(--token)`, so Dev Mode shows the CSS variable a designer picked. Families Figma cannot bind as they are (unitless line heights, em letter spacing, shadow lists, motion) are kept out of every picker. The payload is the shape of `POST /v1/files/:key/variables`; that endpoint is Enterprise-only, which is why there is a plugin.

### The project's brand

A project's `src/theme/brand.css` overrides the token files in the browser, so `export` lays it over them (`resolveBrand`, then `toFigmaVariables(light, dark, { overrides })`). The light block (`:root, [data-theme="light"]`) gives Light, `[data-theme="dark"]` gives Dark, and the cascade carries anything set only in the light block into Dark too. The `prefers-color-scheme` copy inside `@media` is skipped. `var(--x)` resolves in the same mode; colors are normalized as the token loader writes them; a value whose Figma type differs from the token's (`calc()`, `color-mix()`) is reported and the default stands. Custom properties that name no token, rules under other selectors, and properties set only inside `@media` are reported, not exported. `--no-brand` skips the file, `--brand <file>` names another, and `--themes` leaves it out.

### Themes

`export --themes <dir>` reads `<dir>/<name>/brand.css` for every theme (a registry theme overrides custom properties and nothing else) and adds a second collection. **Theme** has one mode per theme and holds, for every token some theme overrides, its light and dark value in each (`light/color/primary`, `dark/color/primary`), out of every picker. **Zengin** is the collection above, except that those tokens alias into Theme. Bind components to Zengin only; a frame set to Theme = meadow and Zengin = Dark then shows meadow's dark values, so a whole file switches theme with one mode picker.

The split is the plan limit: a collection holds a limited number of modes (Professional: 10), and six themes in light and dark would need twelve. Here it needs one per theme. `default` comes first and is Theme's default mode.

`import` reads the shape of `GET /v1/files/:key/variables/local`, which the plugin's Export button produces too, and reports what a designer changed, what they added, and what code has that Figma does not. Units follow the existing token: a text size kept in rem comes back in rem; a font family a designer changed replaces the stack's first family and keeps the fallbacks. An alias is followed to the value it lands on, in the Theme collection's default mode, or the one `--theme <name>` names. Only an alias that leads nowhere is skipped. Nothing is written without `--write`.

With a brand, `import` compares each token the brand sets against the brand's value, not the default. A change to one is listed under `brand` and never written: `tokens.json` holds the system's defaults, and the value belongs in `brand.css`. Without this, a file exported in the brand would read back as a change to every color it overrides.

## The plugin

`zengin figma plugin` writes three files. In Figma: Plugins, Development, Import plugin from manifest, pick `manifest.json`. Import pastes the payload from `export`; Export produces the JSON `import` takes. It uses only the Plugin API's variables calls and needs no network.

## Code Connect

`connect` writes `figma.config.json` and one `src/figma/<name>.figma.ts` per component: Code Connect template files, the format the current CLI (v2) reads, in the shape `figma connect migrate` produces. Each maps the Figma component's properties to the React props by the same names: enum props read with `getEnum` and the manifest's values title-cased, booleans with `getBoolean`, labels with `getString`. Form plumbing (`defaultValue`, `defaultOpen`, `name`, `id`) is left out; a design file has no property for it. The import line is the project's `system.package` from `zengin.config.yaml`, else `@/components/ui`.

Pass `--map figma/map.json` with `{ "Button": "https://www.figma.com/design/...?node-id=..." }` and only those components are written; without a map every component gets a placeholder URL and a TODO. Check the files with `npx @figma/code-connect connect parse`, then publish with `npx @figma/code-connect connect publish` and a Figma access token. Zengin UI's own mapping lives in `packages/ui/figma/`.

## Programmatic use

```ts
import { toFigmaVariables, toFigmaThemedVariables, fromFigmaVariables, codeConnectFiles, writePlugin } from "@zenginui/figma";

const payload = toFigmaVariables(light, dark, { collection: "Acme" });
const themed = toFigmaThemedVariables(light, dark, [{ name: "default", css: "" }, { name: "meadow", css: meadowBrandCss }]);
const report = fromFigmaVariables(local, light, dark, { theme: "meadow" });
const files = codeConnectFiles(manifests, { urls: { Button: "..." } });
```

## Not in this version

- Pushing to Figma from the CLI. The REST write endpoint needs an Enterprise token; the plugin covers everyone else.
- Generating the components in Figma from code. That is the design-resources layer after this one.
