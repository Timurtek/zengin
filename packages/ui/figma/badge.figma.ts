// url=https://www.figma.com/design/CgJCRr7JbqYHm4U5WEtH1z/Zengin-Design-System?node-id=20-64
// component=Badge
// Generated from zengin/components.json by `zengin figma connect`. The Figma component's properties are
// named like the props; the values are the manifest's, title-cased.

import figma from "figma"

const tone = figma.selectedInstance.getEnum("Tone", {
  "Neutral": "neutral",
  "Primary": "primary",
  "Danger": "danger",
  "Success": "success",
  "Warning": "warning",
})
const variant = figma.selectedInstance.getEnum("Variant", {
  "Soft": "soft",
  "Solid": "solid",
  "Outline": "outline",
})
const size = figma.selectedInstance.getEnum("Size", {
  "Sm": "sm",
  "Md": "md",
})
const children = figma.selectedInstance.getString("Label")

export default {
  id: "Badge",
  imports: ["import { Badge } from \"@zenginui/ui\";"],
  example: figma.code`<Badge${figma.helpers.react.renderProp("tone", tone)}${figma.helpers.react.renderProp("variant", variant)}${figma.helpers.react.renderProp("size", size)}${figma.helpers.react.renderProp("children", children)}/>`,
  metadata: { nestable: true },
}
