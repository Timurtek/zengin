// url=https://www.figma.com/design/CgJCRr7JbqYHm4U5WEtH1z/Zengin-Design-System?node-id=28-220
// component=Suggestions
// Generated from zengin/components.json by `zengin figma connect`. The Figma component's properties are
// named like the props; the values are the manifest's, title-cased.

import figma from "figma"

const layout = figma.selectedInstance.getEnum("Layout", {
  "Wrap": "wrap",
  "Scroll": "scroll",
})

export default {
  id: "Suggestions",
  imports: ["import { Suggestions } from \"@zenginui/ui\";"],
  example: figma.code`<Suggestions${figma.helpers.react.renderProp("layout", layout)}/>`,
  metadata: { nestable: true },
}
