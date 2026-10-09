// url=https://www.figma.com/design/CgJCRr7JbqYHm4U5WEtH1z/Zengin-Design-System?node-id=20-129
// component=Skeleton
// Generated from zengin/components.json by `zengin figma connect`. The Figma component's properties are
// named like the props; the values are the manifest's, title-cased.

import figma from "figma"

const variant = figma.selectedInstance.getEnum("Variant", {
  "Text": "text",
  "Rect": "rect",
  "Circle": "circle",
})
const width = figma.selectedInstance.getString("Width")
const height = figma.selectedInstance.getString("Height")
const children = figma.selectedInstance.getString("Label")

export default {
  id: "Skeleton",
  imports: ["import { Skeleton } from \"@zenginui/ui\";"],
  example: figma.code`<Skeleton${figma.helpers.react.renderProp("variant", variant)}${figma.helpers.react.renderProp("width", width)}${figma.helpers.react.renderProp("height", height)}${figma.helpers.react.renderProp("children", children)}/>`,
  metadata: { nestable: true },
}
