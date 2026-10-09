// url=https://www.figma.com/design/CgJCRr7JbqYHm4U5WEtH1z/Zengin-Design-System?node-id=22-33
// component=Checkbox
// Generated from zengin/components.json by `zengin figma connect`. The Figma component's properties are
// named like the props; the values are the manifest's, title-cased.

import figma from "figma"

const label = figma.selectedInstance.getString("Label")
const description = figma.selectedInstance.getString("Description")
const size = figma.selectedInstance.getEnum("Size", {
  "Sm": "sm",
  "Md": "md",
})
const checked = figma.selectedInstance.getBoolean("Checked")
const disabled = figma.selectedInstance.getBoolean("Disabled")
const required = figma.selectedInstance.getBoolean("Required")
const value = figma.selectedInstance.getString("Value")

export default {
  id: "Checkbox",
  imports: ["import { Checkbox } from \"@zenginui/ui\";"],
  example: figma.code`<Checkbox${figma.helpers.react.renderProp("label", label)}${figma.helpers.react.renderProp("description", description)}${figma.helpers.react.renderProp("size", size)}${figma.helpers.react.renderProp("checked", checked)}${figma.helpers.react.renderProp("disabled", disabled)}${figma.helpers.react.renderProp("required", required)}${figma.helpers.react.renderProp("value", value)}/>`,
  metadata: { nestable: true },
}
