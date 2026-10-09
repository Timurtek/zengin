---
"@zenginui/figma": patch
---

`zengin figma export` and `import` read `tokens.dark.json` against `tokens.json`, so a dark file whose values alias light tokens (`{color.gray-900}`, as the CSS adapter writes) exports instead of failing with "Token alias not found". The same goes for the themed export and for brand files. Import also stops reporting a color with no dark override as a dark change: Figma's uppercase hex is compared with the token's case-insensitively.
