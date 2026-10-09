// url=https://www.figma.com/design/CgJCRr7JbqYHm4U5WEtH1z/Zengin-Design-System?node-id=27-409
// component=DataTable
// Generated from zengin/components.json by `zengin figma connect`. The Figma component's properties are
// named like the props; the values are the manifest's, title-cased.

import figma from "figma"

const searchable = figma.selectedInstance.getBoolean("Searchable")
const searchPlaceholder = figma.selectedInstance.getString("Search placeholder")
const density = figma.selectedInstance.getEnum("Density", {
  "Sm": "sm",
  "Md": "md",
})
const label = figma.selectedInstance.getString("Label")

export default {
  id: "DataTable",
  imports: ["import { DataTable } from \"@zenginui/ui\";"],
  example: figma.code`<DataTable${figma.helpers.react.renderProp("searchable", searchable)}${figma.helpers.react.renderProp("searchPlaceholder", searchPlaceholder)}${figma.helpers.react.renderProp("density", density)}${figma.helpers.react.renderProp("label", label)}/>`,
  metadata: { nestable: true },
}
