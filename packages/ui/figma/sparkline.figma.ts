// url=https://www.figma.com/design/CgJCRr7JbqYHm4U5WEtH1z/Zengin-Design-System?node-id=26-20
// component=Sparkline
// Generated from zengin/components.json by `zengin figma connect`. The Figma component's properties are
// named like the props; the values are the manifest's, title-cased.

import figma from "figma"

const tone = figma.selectedInstance.getEnum("Tone", {
  "Primary": "primary",
  "Success": "success",
  "Warning": "warning",
  "Danger": "danger",
  "Neutral": "neutral",
})
const area = figma.selectedInstance.getBoolean("Area")
const ariaLabel = figma.selectedInstance.getString("Aria label")
const children = figma.selectedInstance.getString("Label")

export default {
  id: "Sparkline",
  imports: ["import { Sparkline } from \"@zenginui/ui\";"],
  example: figma.code`<Sparkline${figma.helpers.react.renderProp("tone", tone)}${figma.helpers.react.renderProp("area", area)}${figma.helpers.react.renderProp("aria-label", ariaLabel)}${figma.helpers.react.renderProp("children", children)}/>`,
  metadata: { nestable: true },
}
