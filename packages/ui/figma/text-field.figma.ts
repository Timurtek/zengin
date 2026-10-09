// url=https://www.figma.com/design/CgJCRr7JbqYHm4U5WEtH1z/Zengin-Design-System?node-id=13-291
// component=TextField
// Generated from zengin/components.json by `zengin figma connect`. The Figma component's properties are
// named like the props; the values are the manifest's, title-cased.

import figma from "figma"

const label = figma.selectedInstance.getString("Label")
const description = figma.selectedInstance.getString("Description")
const size = figma.selectedInstance.getEnum("Size", {
  "Sm": "sm",
  "Md": "md",
  "Lg": "lg",
})
const font = figma.selectedInstance.getEnum("Font", {
  "Sans": "sans",
  "Mono": "mono",
})

export default {
  id: "TextField",
  imports: ["import { TextField } from \"@zenginui/ui\";"],
  example: figma.code`<TextField${figma.helpers.react.renderProp("label", label)}${figma.helpers.react.renderProp("description", description)}${figma.helpers.react.renderProp("size", size)}${figma.helpers.react.renderProp("font", font)}/>`,
  metadata: { nestable: true },
}
