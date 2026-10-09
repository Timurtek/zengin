// url=https://www.figma.com/design/CgJCRr7JbqYHm4U5WEtH1z/Zengin-Design-System?node-id=20-104
// component=Avatar
// Generated from zengin/components.json by `zengin figma connect`. The Figma component's properties are
// named like the props; the values are the manifest's, title-cased.

import figma from "figma"

const size = figma.selectedInstance.getEnum("Size", {
  "Sm": "sm",
  "Md": "md",
  "Lg": "lg",
  "Xl": "xl",
})
const shape = figma.selectedInstance.getEnum("Shape", {
  "Circle": "circle",
  "Square": "square",
})
const children = figma.selectedInstance.getString("Label")

export default {
  id: "Avatar",
  imports: ["import { Avatar } from \"@zenginui/ui\";"],
  example: figma.code`<Avatar${figma.helpers.react.renderProp("size", size)}${figma.helpers.react.renderProp("shape", shape)}${figma.helpers.react.renderProp("children", children)}/>`,
  metadata: { nestable: true },
}
