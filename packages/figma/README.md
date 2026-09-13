# @zengin/figma

Figma both ways for a Zengin system. One rule carries both directions: a variable is named like its token, with slashes for dots, and its code syntax is the CSS custom property. `color.primary.soft` is `color/primary/soft` in Figma and `var(--color-primary-soft)` in code. That is the Carbon model, and it is what lets a designer's change come back into the token file with the token's own unit.

```bash
zengin figma export                          # zengin/tokens*.json -> figma/variables.json, the Variables payload
zengin figma plugin                          # a Figma plugin into figma/plugin/, to import that payload into any file
zengin figma import figma/local.json         # what the plugin (or the REST API) exported -> a report; --write updates the token files
zengin figma connect --map figma/map.json    # Code Connect files from zengin/components.json
```

## Variables

`export` turns the light and dark token files into one collection with Light and Dark modes: colors as COLOR, lengths as FLOAT in px (rem converted at 16), durations as FLOAT in ms, weights and line heights as FLOAT, font stacks, easings and shadows as STRING. Every variable gets scopes fit for its namespace (fills for colors, corner radius for radii, font size for text sizes) and `codeSyntax.WEB` set to `var(--token)`, so Dev Mode shows the CSS variable a designer picked. The payload is the shape of `POST /v1/files/:key/variables`; that endpoint is Enterprise-only, which is why there is a plugin.

`import` reads the shape of `GET /v1/files/:key/variables/local`, which the plugin's Export button produces too, and reports what a designer changed, what they added, and what code has that Figma does not. Units follow the existing token: a text size kept in rem comes back in rem. Aliases to other variables are skipped and reported. Nothing is written without `--write`.

## The plugin

`zengin figma plugin` writes three files. In Figma: Plugins, Development, Import plugin from manifest, pick `manifest.json`. Import pastes the payload from `export`; Export produces the JSON `import` takes. It uses only the Plugin API's variables calls and needs no network.

## Code Connect

`connect` writes `figma.config.json` and one `src/figma/<name>.figma.tsx` per component, mapping the Figma component's properties to the React props by the same names: enum props become `figma.enum` with the manifest's values title-cased, booleans `figma.boolean`, labels `figma.string`. Pass `--map figma/map.json` with `{ "Button": "https://www.figma.com/design/...?node-id=..." }` to fill the URLs; components without one get a placeholder and a TODO. Then `npx figma connect publish` from the Code Connect CLI.

## Programmatic use

```ts
import { toFigmaVariables, fromFigmaVariables, codeConnectFiles, writePlugin } from "@zengin/figma";

const payload = toFigmaVariables(light, dark, { collection: "Acme" });
const report = fromFigmaVariables(local, light, dark);
const files = codeConnectFiles(manifests, { urls: { Button: "..." } });
```

## Not in this version

- Pushing to Figma from the CLI. The REST write endpoint needs an Enterprise token; the plugin covers everyone else.
- Generating the components in Figma from code. That is the design-resources layer after this one.
