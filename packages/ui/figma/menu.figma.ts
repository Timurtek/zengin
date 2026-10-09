// url=https://www.figma.com/design/CgJCRr7JbqYHm4U5WEtH1z/Zengin-Design-System?node-id=24-34
// component=Menu
// Generated from zengin/components.json by `zengin figma connect`. The Figma component's properties are
// named like the props; the values are the manifest's, title-cased.

import figma from "figma"

const open = figma.selectedInstance.getBoolean("Open")
const modal = figma.selectedInstance.getBoolean("Modal")

export default {
  id: "Menu",
  imports: ["import { Menu } from \"@zenginui/ui\";"],
  example: figma.code`<Menu${figma.helpers.react.renderProp("open", open)}${figma.helpers.react.renderProp("modal", modal)}/>`,
  metadata: { nestable: true },
}
