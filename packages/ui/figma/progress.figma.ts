// url=https://www.figma.com/design/CgJCRr7JbqYHm4U5WEtH1z/Zengin-Design-System?node-id=20-215
// component=Progress
// Generated from zengin/components.json by `zengin figma connect`. The Figma component's properties are
// named like the props; the values are the manifest's, title-cased.

import figma from "figma"

const label = figma.selectedInstance.getString("Label")
const showValue = figma.selectedInstance.getBoolean("Show value")
const size = figma.selectedInstance.getEnum("Size", {
  "Sm": "sm",
  "Md": "md",
})
const tone = figma.selectedInstance.getEnum("Tone", {
  "Primary": "primary",
  "Neutral": "neutral",
  "Success": "success",
  "Warning": "warning",
  "Danger": "danger",
})

export default {
  id: "Progress",
  imports: ["import { Progress } from \"@zenginui/ui\";"],
  example: figma.code`<Progress${figma.helpers.react.renderProp("label", label)}${figma.helpers.react.renderProp("showValue", showValue)}${figma.helpers.react.renderProp("size", size)}${figma.helpers.react.renderProp("tone", tone)}/>`,
  metadata: { nestable: true },
}
