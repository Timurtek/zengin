---
"@zenginui/ui": patch
---

Combobox draws its control like TextField and Select: a border-strong edge at rest, text-muted on hover, the focus colour while the input has focus. It used --color-outline, which is transparent in every theme but brutal, so the field had no visible edge.
