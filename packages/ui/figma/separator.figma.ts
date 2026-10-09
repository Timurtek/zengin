// url=https://www.figma.com/design/CgJCRr7JbqYHm4U5WEtH1z/Zengin-Design-System?node-id=20-119
// component=Separator
// Generated from zengin/components.json by `zengin figma connect`. The Figma component's properties are
// named like the props; the values are the manifest's, title-cased.

import figma from "figma"

const orientation = figma.selectedInstance.getEnum("Orientation", {
  "Horizontal": "horizontal",
  "Vertical": "vertical",
})
const label = figma.selectedInstance.getString("Label")
const decorative = figma.selectedInstance.getBoolean("Decorative")

export default {
  id: "Separator",
  imports: ["import { Separator } from \"@zenginui/ui\";"],
  example: figma.code`<Separator${figma.helpers.react.renderProp("orientation", orientation)}${figma.helpers.react.renderProp("label", label)}${figma.helpers.react.renderProp("decorative", decorative)}/>`,
  metadata: { nestable: true },
}
