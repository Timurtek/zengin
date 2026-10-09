---
"@zenginui/figma": minor
"@zenginui/cli": minor
---

`zengin figma connect` writes Code Connect template files (`<name>.figma.ts`), the format Code Connect CLI v2 reads; it no longer accepts the v1 `figma.connect()` React files this command used to write. The config sets the snippet language (React, tsx). With `--map`, only the mapped components are written, since a placeholder URL failed `figma connect publish` for the whole run, and a name the manifest does not have is an error. The import line follows the project's `system.package`. Form plumbing props (`defaultValue`, `defaultOpen`, `name`, `id`) are no longer mapped.
