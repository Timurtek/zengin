// url=https://www.figma.com/design/CgJCRr7JbqYHm4U5WEtH1z/Zengin-Design-System?node-id=28-3
// component=CodeBlock
// Generated from zengin/components.json by `zengin figma connect`. The Figma component's properties are
// named like the props; the values are the manifest's, title-cased.

import figma from "figma"

const code = figma.selectedInstance.getString("Code")
const language = figma.selectedInstance.getString("Language")
const showCopy = figma.selectedInstance.getBoolean("Show copy")
const wrap = figma.selectedInstance.getBoolean("Wrap")

export default {
  id: "CodeBlock",
  imports: ["import { CodeBlock } from \"@zenginui/ui\";"],
  example: figma.code`<CodeBlock${figma.helpers.react.renderProp("code", code)}${figma.helpers.react.renderProp("language", language)}${figma.helpers.react.renderProp("showCopy", showCopy)}${figma.helpers.react.renderProp("wrap", wrap)}/>`,
  metadata: { nestable: true },
}
