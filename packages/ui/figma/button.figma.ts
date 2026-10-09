// url=https://www.figma.com/design/CgJCRr7JbqYHm4U5WEtH1z/Zengin-Design-System?node-id=12-651
// component=Button
// Generated from zengin/components.json by `zengin figma connect`. The Figma component's properties are
// named like the props; the values are the manifest's, title-cased.

import figma from "figma"

const variant = figma.selectedInstance.getEnum("Variant", {
  "Solid": "solid",
  "Soft": "soft",
  "Ghost": "ghost",
  "Link": "link",
})
const tone = figma.selectedInstance.getEnum("Tone", {
  "Neutral": "neutral",
  "Primary": "primary",
  "Danger": "danger",
})
const size = figma.selectedInstance.getEnum("Size", {
  "Sm": "sm",
  "Md": "md",
  "Lg": "lg",
})
const loading = figma.selectedInstance.getBoolean("Loading")
const align = figma.selectedInstance.getEnum("Align", {
  "Center": "center",
  "Start": "start",
})
const children = figma.selectedInstance.getString("Label")

export default {
  id: "Button",
  imports: ["import { Button } from \"@zenginui/ui\";"],
  example: figma.code`<Button${figma.helpers.react.renderProp("variant", variant)}${figma.helpers.react.renderProp("tone", tone)}${figma.helpers.react.renderProp("size", size)}${figma.helpers.react.renderProp("loading", loading)}${figma.helpers.react.renderProp("align", align)}${figma.helpers.react.renderProp("children", children)}/>`,
  metadata: { nestable: true },
}
