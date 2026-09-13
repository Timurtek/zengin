---
"@zenginui/adapter-shadcn": minor
"@zenginui/cli": minor
"@zenginui/engine": minor
---

`zengin init --from shadcn` derives Zengin definitions from a shadcn/ui project: semantic color tokens from the theme CSS (HSL triples and oklch converted), the radius scale, font families, Tailwind extend semantics, and one manifest entry per `components/ui` file with variants from `cva()`/`tv()`, sub-parts, Radix behavior props, replacements and owned properties. The engine's color normalizer now reads HSL.
