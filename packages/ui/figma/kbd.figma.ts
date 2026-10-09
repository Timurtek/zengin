// url=https://www.figma.com/design/CgJCRr7JbqYHm4U5WEtH1z/Zengin-Design-System?node-id=20-81
// component=Kbd
// Generated from zengin/components.json by `zengin figma connect`. The Figma component's properties are
// named like the props; the values are the manifest's, title-cased.

import figma from "figma"

const size = figma.selectedInstance.getEnum("Size", {
  "Sm": "sm",
  "Md": "md",
})
const children = figma.selectedInstance.getString("Label")

export default {
  id: "Kbd",
  imports: ["import { Kbd } from \"@zenginui/ui\";"],
  example: figma.code`<Kbd${figma.helpers.react.renderProp("size", size)}${figma.helpers.react.renderProp("children", children)}/>`,
  metadata: { nestable: true },
}
