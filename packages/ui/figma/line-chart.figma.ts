// url=https://www.figma.com/design/CgJCRr7JbqYHm4U5WEtH1z/Zengin-Design-System?node-id=26-75
// component=LineChart
// Generated from zengin/components.json by `zengin figma connect`. The Figma component's properties are
// named like the props; the values are the manifest's, title-cased.

import figma from "figma"

const area = figma.selectedInstance.getBoolean("Area")
const curve = figma.selectedInstance.getEnum("Curve", {
  "Linear": "linear",
  "Smooth": "smooth",
})
const showGrid = figma.selectedInstance.getBoolean("Show grid")
const showAxis = figma.selectedInstance.getBoolean("Show axis")
const ariaLabel = figma.selectedInstance.getString("Aria label")

export default {
  id: "LineChart",
  imports: ["import { LineChart } from \"@zenginui/ui\";"],
  example: figma.code`<LineChart${figma.helpers.react.renderProp("area", area)}${figma.helpers.react.renderProp("curve", curve)}${figma.helpers.react.renderProp("showGrid", showGrid)}${figma.helpers.react.renderProp("showAxis", showAxis)}${figma.helpers.react.renderProp("aria-label", ariaLabel)}/>`,
  metadata: { nestable: true },
}
