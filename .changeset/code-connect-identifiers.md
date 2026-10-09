---
"@zenginui/figma": patch
---

`zengin figma connect` writes valid templates for every component: a prop like `aria-label` becomes the identifier `ariaLabel` (it was written as `const aria-label`, which does not parse), a component whose own prop reads the "Label" property no longer reads it a second time as children, and `dir`, `src` and `*Src` props (writing direction, image URLs) are left out with the other form plumbing.
