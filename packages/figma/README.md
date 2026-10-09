# @zenginui/figma

Figma both ways for a Zengin system. One rule carries both directions: a variable is named like its token, with slashes for dots, and its code syntax is the CSS custom property. `color.primary.soft` is `color/primary/soft` in Figma and `var(--color-primary-soft)` in code. That is the Carbon model, and it is what lets a designer's change come back into the token file with the token's own unit.

```bash
zengin figma export                          # zengin/tokens*.json -> figma/variables.json, the Variables payload
zengin figma export --themes themes          # the same, plus a Theme collection with a mode per themes/<name>/brand.css
zengin figma plugin                          # a Figma plugin into figma/plugin/, to import that payload into any file
zengin figma import figma/local.json         # what the plugin (or the REST API) exported -> a report; --write updates the token files
zengin figma connect --map figma/map.json    # Code Connect files from zengin/components.json
```

## Variables

`export` turns the light and dark token files into one collection with Light and Dark modes: colors as COLOR, lengths as FLOAT in px (rem converted at 16), durations as FLOAT in ms, weights and line heights as FLOAT, easings and shadows as STRING, and a font as its stack's first family, the one a Figma font picker can load. Every variable gets scopes fit for its namespace (fills and strokes for colors, gap for spacing, corner radius for radii, stroke weight for the border width, font size for text sizes) and `codeSyntax.WEB` set to `var(--token)`, so Dev Mode shows the CSS variable a designer picked. Families Figma cannot bind as they are (unitless line heights, em letter spacing, shadow lists, motion) are kept out of every picker. The payload is the shape of `POST /v1/files/:key/variables`; that endpoint is Enterprise-only, which is why there is a plugin.

### Themes

`export --themes <dir>` reads `<dir>/<name>/brand.css` for every theme (a registry theme overrides custom properties and nothing else) and adds a second collection. **Theme** has one mode per theme and holds, for every token some theme overrides, its light and dark value in each (`light/color/primary`, `dark/color/primary`), out of every picker. **Zengin** is the collection above, except that those tokens alias into Theme. Bind components to Zengin only; a frame set to Theme = meadow and Zengin = Dark then shows meadow's dark values, so a whole file switches theme with one mode picker.

The split is the plan limit: a collection holds a limited number of modes (Professional: 10), and six themes in light and dark would need twelve. Here it needs one per theme. `default` comes first and is Theme's default mode.

`import` reads the shape of `GET /v1/files/:key/variables/local`, which the plugin's Export button produces too, and reports what a designer changed, what they added, and what code has that Figma does not. Units follow the existing token: a text size kept in rem comes back in rem; a font family a designer changed replaces the stack's first family and keeps the fallbacks. An alias is followed to the value it lands on, in the Theme collection's default mode, or the one `--theme <name>` names. Only an alias that leads nowhere is skipped. Nothing is written without `--write`.

## The plugin

`zengin figma plugin` writes three files. In Figma: Plugins, Development, Import plugin from manifest, pick `manifest.json`. Import pastes the payload from `export`; Export produces the JSON `import` takes. It uses only the Plugin API's variables calls and needs no network.

## Code Connect

`connect` writes `figma.config.json` and one `src/figma/<name>.figma.tsx` per component, mapping the Figma component's properties to the React props by the same names: enum props become `figma.enum` with the manifest's values title-cased, booleans `figma.boolean`, labels `figma.string`. Pass `--map figma/map.json` with `{ "Button": "https://www.figma.com/design/...?node-id=..." }` to fill the URLs; components without one get a placeholder and a TODO. Then `npx figma connect publish` from the Code Connect CLI.

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
