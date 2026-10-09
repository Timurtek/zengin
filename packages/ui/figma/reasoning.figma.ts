// url=https://www.figma.com/design/CgJCRr7JbqYHm4U5WEtH1z/Zengin-Design-System?node-id=29-124
// component=Reasoning
// Generated from zengin/components.json by `zengin figma connect`. The Figma component's properties are
// named like the props; the values are the manifest's, title-cased.

import figma from "figma"

const text = figma.selectedInstance.getString("Text")
const streaming = figma.selectedInstance.getBoolean("Streaming")

export default {
  id: "Reasoning",
  imports: ["import { Reasoning } from \"@zenginui/ui\";"],
  example: figma.code`<Reasoning${figma.helpers.react.renderProp("text", text)}${figma.helpers.react.renderProp("streaming", streaming)}/>`,
  metadata: { nestable: true },
}
