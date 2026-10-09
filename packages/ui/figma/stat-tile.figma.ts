// url=https://www.figma.com/design/CgJCRr7JbqYHm4U5WEtH1z/Zengin-Design-System?node-id=26-134
// component=StatTile
// Generated from zengin/components.json by `zengin figma connect`. The Figma component's properties are
// named like the props; the values are the manifest's, title-cased.

import figma from "figma"

const label = figma.selectedInstance.getString("Label")
const higherIsBetter = figma.selectedInstance.getBoolean("Higher is better")
const seriesLabel = figma.selectedInstance.getString("Series label")
const size = figma.selectedInstance.getEnum("Size", {
  "Sm": "sm",
  "Md": "md",
})

export default {
  id: "StatTile",
  imports: ["import { StatTile } from \"@zenginui/ui\";"],
  example: figma.code`<StatTile${figma.helpers.react.renderProp("label", label)}${figma.helpers.react.renderProp("higherIsBetter", higherIsBetter)}${figma.helpers.react.renderProp("seriesLabel", seriesLabel)}${figma.helpers.react.renderProp("size", size)}/>`,
  metadata: { nestable: true },
}
