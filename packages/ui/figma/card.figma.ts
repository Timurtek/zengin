// url=https://www.figma.com/design/CgJCRr7JbqYHm4U5WEtH1z/Zengin-Design-System?node-id=16-297
// component=Card
// Generated from zengin/components.json by `zengin figma connect`. The Figma component's properties are
// named like the props; the values are the manifest's, title-cased.

import figma from "figma"

const variant = figma.selectedInstance.getEnum("Variant", {
  "Outlined": "outlined",
  "Elevated": "elevated",
  "Sunken": "sunken",
})
const padding = figma.selectedInstance.getEnum("Padding", {
  "None": "none",
  "Sm": "sm",
  "Md": "md",
  "Lg": "lg",
})
const interactive = figma.selectedInstance.getBoolean("Interactive")

export default {
  id: "Card",
  imports: ["import { Card } from \"@zenginui/ui\";"],
  example: figma.code`<Card${figma.helpers.react.renderProp("variant", variant)}${figma.helpers.react.renderProp("padding", padding)}${figma.helpers.react.renderProp("interactive", interactive)}/>`,
  metadata: { nestable: true },
}
