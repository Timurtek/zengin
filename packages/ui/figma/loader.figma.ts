// url=https://www.figma.com/design/CgJCRr7JbqYHm4U5WEtH1z/Zengin-Design-System?node-id=20-148
// component=Loader
// Generated from zengin/components.json by `zengin figma connect`. The Figma component's properties are
// named like the props; the values are the manifest's, title-cased.

import figma from "figma"

const label = figma.selectedInstance.getString("Label")
const showLabel = figma.selectedInstance.getBoolean("Show label")
const size = figma.selectedInstance.getEnum("Size", {
  "Sm": "sm",
  "Md": "md",
})

export default {
  id: "Loader",
  imports: ["import { Loader } from \"@zenginui/ui\";"],
  example: figma.code`<Loader${figma.helpers.react.renderProp("label", label)}${figma.helpers.react.renderProp("showLabel", showLabel)}${figma.helpers.react.renderProp("size", size)}/>`,
  metadata: { nestable: true },
}
