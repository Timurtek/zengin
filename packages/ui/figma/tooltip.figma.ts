// url=https://www.figma.com/design/CgJCRr7JbqYHm4U5WEtH1z/Zengin-Design-System?node-id=22-232
// component=Tooltip
// Generated from zengin/components.json by `zengin figma connect`. The Figma component's properties are
// named like the props; the values are the manifest's, title-cased.

import figma from "figma"

const content = figma.selectedInstance.getString("Content")
const side = figma.selectedInstance.getEnum("Side", {
  "Top": "top",
  "Right": "right",
  "Bottom": "bottom",
  "Left": "left",
})
const open = figma.selectedInstance.getBoolean("Open")

export default {
  id: "Tooltip",
  imports: ["import { Tooltip } from \"@zenginui/ui\";"],
  example: figma.code`<Tooltip${figma.helpers.react.renderProp("content", content)}${figma.helpers.react.renderProp("side", side)}${figma.helpers.react.renderProp("open", open)}/>`,
  metadata: { nestable: true },
}
