// url=https://www.figma.com/design/CgJCRr7JbqYHm4U5WEtH1z/Zengin-Design-System?node-id=18-221
// component=Table
// Generated from zengin/components.json by `zengin figma connect`. The Figma component's properties are
// named like the props; the values are the manifest's, title-cased.

import figma from "figma"

const density = figma.selectedInstance.getEnum("Density", {
  "Sm": "sm",
  "Md": "md",
})
const stickyHeader = figma.selectedInstance.getBoolean("Sticky header")

export default {
  id: "Table",
  imports: ["import { Table } from \"@zenginui/ui\";"],
  example: figma.code`<Table${figma.helpers.react.renderProp("density", density)}${figma.helpers.react.renderProp("stickyHeader", stickyHeader)}/>`,
  metadata: { nestable: true },
}
