// url=https://www.figma.com/design/CgJCRr7JbqYHm4U5WEtH1z/Zengin-Design-System?node-id=27-108
// component=Combobox
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
const disabled = figma.selectedInstance.getBoolean("Disabled")
const multiple = figma.selectedInstance.getBoolean("Multiple")
const emptyMessage = figma.selectedInstance.getString("Empty message")

export default {
  id: "Combobox",
  imports: ["import { Combobox } from \"@zenginui/ui\";"],
  example: figma.code`<Combobox${figma.helpers.react.renderProp("label", label)}${figma.helpers.react.renderProp("description", description)}${figma.helpers.react.renderProp("placeholder", placeholder)}${figma.helpers.react.renderProp("size", size)}${figma.helpers.react.renderProp("disabled", disabled)}${figma.helpers.react.renderProp("multiple", multiple)}${figma.helpers.react.renderProp("emptyMessage", emptyMessage)}/>`,
  metadata: { nestable: true },
}
