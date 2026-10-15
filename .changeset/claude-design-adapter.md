---
"@zenginui/adapter-css": minor
"@zenginui/engine": minor
"@zenginui/cli": minor
---

`zengin init --from claude-design` derives definitions from a Claude Design export: tokens from the stylesheets its `_ds_manifest.json` names (the manifest's token `kind` is reported, not trusted), components from their `.d.ts` files, and a cross-check of those contracts against `_adherence.oxlintrc.json`. The engine's fixes got better on the way: a spacing fix names the scale step rather than a token named for a use (`--sp-3`, not `--safe-top`), a translucent color is no longer told it matches the opaque one, and `oklch(var(--l) var(--c) 145)` is not a color literal.
