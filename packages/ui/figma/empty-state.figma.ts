// url=https://www.figma.com/design/CgJCRr7JbqYHm4U5WEtH1z/Zengin-Design-System?node-id=23-253
// component=EmptyState
// Generated from zengin/components.json by `zengin figma connect`. The Figma component's properties are
// named like the props; the values are the manifest's, title-cased.

import figma from "figma"

const title = figma.selectedInstance.getString("Title")
const description = figma.selectedInstance.getString("Description")
const size = figma.selectedInstance.getEnum("Size", {
  "Sm": "sm",
  "Md": "md",
})
const tone = figma.selectedInstance.getEnum("Tone", {
  "Neutral": "neutral",
  "Danger": "danger",
})

export default {
  id: "EmptyState",
  imports: ["import { EmptyState } from \"@zenginui/ui\";"],
  example: figma.code`<EmptyState${figma.helpers.react.renderProp("title", title)}${figma.helpers.react.renderProp("description", description)}${figma.helpers.react.renderProp("size", size)}${figma.helpers.react.renderProp("tone", tone)}/>`,
  metadata: { nestable: true },
}
