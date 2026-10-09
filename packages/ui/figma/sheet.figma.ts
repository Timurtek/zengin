// url=https://www.figma.com/design/CgJCRr7JbqYHm4U5WEtH1z/Zengin-Design-System?node-id=25-497
// component=Sheet
// Generated from zengin/components.json by `zengin figma connect`. The Figma component's properties are
// named like the props; the values are the manifest's, title-cased.

import figma from "figma"

const open = figma.selectedInstance.getBoolean("Open")
const side = figma.selectedInstance.getEnum("Side", {
  "Right": "right",
  "Left": "left",
  "Top": "top",
  "Bottom": "bottom",
})
const size = figma.selectedInstance.getEnum("Size", {
  "Sm": "sm",
  "Md": "md",
  "Lg": "lg",
})
const modal = figma.selectedInstance.getBoolean("Modal")

export default {
  id: "Sheet",
  imports: ["import { Sheet } from \"@zenginui/ui\";"],
  example: figma.code`<Sheet${figma.helpers.react.renderProp("open", open)}${figma.helpers.react.renderProp("side", side)}${figma.helpers.react.renderProp("size", size)}${figma.helpers.react.renderProp("modal", modal)}/>`,
  metadata: { nestable: true },
}
