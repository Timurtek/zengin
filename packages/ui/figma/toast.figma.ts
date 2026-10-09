// url=https://www.figma.com/design/CgJCRr7JbqYHm4U5WEtH1z/Zengin-Design-System?node-id=23-180
// component=Toast
// Generated from zengin/components.json by `zengin figma connect`. The Figma component's properties are
// named like the props; the values are the manifest's, title-cased.

import figma from "figma"

const position = figma.selectedInstance.getEnum("Position", {
  "Bottom right": "bottom-right",
  "Bottom left": "bottom-left",
  "Top right": "top-right",
  "Top left": "top-left",
})
const tone = figma.selectedInstance.getEnum("Tone", {
  "Neutral": "neutral",
  "Success": "success",
  "Warning": "warning",
  "Danger": "danger",
})

export default {
  id: "Toast",
  imports: ["import { Toast } from \"@zenginui/ui\";"],
  example: figma.code`<Toast${figma.helpers.react.renderProp("position", position)}${figma.helpers.react.renderProp("tone", tone)}/>`,
  metadata: { nestable: true },
}
