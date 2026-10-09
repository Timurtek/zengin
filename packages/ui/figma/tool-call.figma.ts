// url=https://www.figma.com/design/CgJCRr7JbqYHm4U5WEtH1z/Zengin-Design-System?node-id=29-250
// component=ToolCall
// Generated from zengin/components.json by `zengin figma connect`. The Figma component's properties are
// named like the props; the values are the manifest's, title-cased.

import figma from "figma"

const state = figma.selectedInstance.getEnum("State", {
  "Input streaming": "input-streaming",
  "Input available": "input-available",
  "Approval requested": "approval-requested",
  "Approval responded": "approval-responded",
  "Output available": "output-available",
  "Output error": "output-error",
  "Output denied": "output-denied",
})
const errorText = figma.selectedInstance.getString("Error text")

export default {
  id: "ToolCall",
  imports: ["import { ToolCall } from \"@zenginui/ui\";"],
  example: figma.code`<ToolCall${figma.helpers.react.renderProp("state", state)}${figma.helpers.react.renderProp("errorText", errorText)}/>`,
  metadata: { nestable: true },
}
