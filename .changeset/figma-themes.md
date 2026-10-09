---
"@zenginui/figma": minor
"@zenginui/cli": minor
---

Figma variables now carry themes and import cleanly back.

- `zengin figma export --themes <dir>` adds a Theme collection with a mode per `<dir>/<name>/brand.css`, and aliases the Zengin collection's themed tokens into it, so a file switches theme with one mode picker within a plan's mode limit.
- `zengin figma import` follows aliases into the Theme collection (its default mode, or `--theme <name>`) instead of skipping them.
- Scopes Figma accepts: colors no longer pair `ALL_FILLS` with `TEXT_FILL` (Figma refused the payload), and spacing, weights and the border width get their own scopes instead of falling back to all of them. Line heights, letter spacing, shadows and motion are kept out of the pickers.
- A font variable holds its stack's first family, the one Figma can load; import puts a changed family back in front of the code's fallbacks.
- The plugin imports aliases.
