// url=https://www.figma.com/design/CgJCRr7JbqYHm4U5WEtH1z/Zengin-Design-System?node-id=14-371
// component=Select
// Generated from zengin/components.json by `zengin figma connect`. The Figma component's properties are
// named like the props; the values are the manifest's, title-cased.

import figma from "figma"

const label = figma.selectedInstance.getString("Label")
const description = figma.selectedInstance.getString("Description")
const placeholder = figma.selectedInstance.getString("Placeholder")
const size = figma.selectedInstance.getEnum("Size", {
  "Sm": "sm",
  "Md": "md",
  "Lg": "lg",
})
const value = figma.selectedInstance.getString("Value")
const open = figma.selectedInstance.getBoolean("Open")
const disabled = figma.selectedInstance.getBoolean("Disabled")
const required = figma.selectedInstance.getBoolean("Required")

export default {
  id: "Select",
  imports: ["import { Select } from \"@zenginui/ui\";"],
  example: figma.code`<Select${figma.helpers.react.renderProp("label", label)}${figma.helpers.react.renderProp("description", description)}${figma.helpers.react.renderProp("placeholder", placeholder)}${figma.helpers.react.renderProp("size", size)}${figma.helpers.react.renderProp("value", value)}${figma.helpers.react.renderProp("open", open)}${figma.helpers.react.renderProp("disabled", disabled)}${figma.helpers.react.renderProp("required", required)}/>`,
  metadata: { nestable: true },
}
