// url=https://www.figma.com/design/CgJCRr7JbqYHm4U5WEtH1z/Zengin-Design-System?node-id=29-117
// component=PromptInput
// Generated from zengin/components.json by `zengin figma connect`. The Figma component's properties are
// named like the props; the values are the manifest's, title-cased.

import figma from "figma"

const value = figma.selectedInstance.getString("Value")
const status = figma.selectedInstance.getEnum("Status", {
  "Ready": "ready",
  "Submitted": "submitted",
  "Streaming": "streaming",
  "Error": "error",
})
const sendLabel = figma.selectedInstance.getString("Send label")
const placeholder = figma.selectedInstance.getString("Placeholder")
const disabled = figma.selectedInstance.getBoolean("Disabled")

export default {
  id: "PromptInput",
  imports: ["import { PromptInput } from \"@zenginui/ui\";"],
  example: figma.code`<PromptInput${figma.helpers.react.renderProp("value", value)}${figma.helpers.react.renderProp("status", status)}${figma.helpers.react.renderProp("sendLabel", sendLabel)}${figma.helpers.react.renderProp("placeholder", placeholder)}${figma.helpers.react.renderProp("disabled", disabled)}/>`,
  metadata: { nestable: true },
}
