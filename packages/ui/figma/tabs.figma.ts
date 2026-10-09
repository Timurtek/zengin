// url=https://www.figma.com/design/CgJCRr7JbqYHm4U5WEtH1z/Zengin-Design-System?node-id=22-267
// component=Tabs
// Generated from zengin/components.json by `zengin figma connect`. The Figma component's properties are
// named like the props; the values are the manifest's, title-cased.

import figma from "figma"

const variant = figma.selectedInstance.getEnum("Variant", {
  "Line": "line",
  "Pill": "pill",
})
const size = figma.selectedInstance.getEnum("Size", {
  "Sm": "sm",
  "Md": "md",
})
const value = figma.selectedInstance.getString("Value")

export default {
  id: "Tabs",
  imports: ["import { Tabs } from \"@zenginui/ui\";"],
  example: figma.code`<Tabs${figma.helpers.react.renderProp("variant", variant)}${figma.helpers.react.renderProp("size", size)}${figma.helpers.react.renderProp("value", value)}/>`,
  metadata: { nestable: true },
}
