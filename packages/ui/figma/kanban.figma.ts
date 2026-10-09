// url=https://www.figma.com/design/CgJCRr7JbqYHm4U5WEtH1z/Zengin-Design-System?node-id=27-494
// component=Kanban
// Generated from zengin/components.json by `zengin figma connect`. The Figma component's properties are
// named like the props; the values are the manifest's, title-cased.

import figma from "figma"

const density = figma.selectedInstance.getEnum("Density", {
  "Sm": "sm",
  "Md": "md",
})
const label = figma.selectedInstance.getString("Label")

export default {
  id: "Kanban",
  imports: ["import { Kanban } from \"@zenginui/ui\";"],
  example: figma.code`<Kanban${figma.helpers.react.renderProp("density", density)}${figma.helpers.react.renderProp("label", label)}/>`,
  metadata: { nestable: true },
}
