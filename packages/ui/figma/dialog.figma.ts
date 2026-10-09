// url=https://www.figma.com/design/CgJCRr7JbqYHm4U5WEtH1z/Zengin-Design-System?node-id=17-134
// component=Dialog
// Generated from zengin/components.json by `zengin figma connect`. The Figma component's properties are
// named like the props; the values are the manifest's, title-cased.

import figma from "figma"

const open = figma.selectedInstance.getBoolean("Open")
const size = figma.selectedInstance.getEnum("Size", {
  "Sm": "sm",
  "Md": "md",
  "Lg": "lg",
})
const modal = figma.selectedInstance.getBoolean("Modal")

export default {
  id: "Dialog",
  imports: ["import { Dialog } from \"@zenginui/ui\";"],
  example: figma.code`<Dialog${figma.helpers.react.renderProp("open", open)}${figma.helpers.react.renderProp("size", size)}${figma.helpers.react.renderProp("modal", modal)}/>`,
  metadata: { nestable: true },
}
