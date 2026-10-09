// url=https://www.figma.com/design/CgJCRr7JbqYHm4U5WEtH1z/Zengin-Design-System?node-id=28-77
// component=Message
// Generated from zengin/components.json by `zengin figma connect`. The Figma component's properties are
// named like the props; the values are the manifest's, title-cased.

import figma from "figma"

const role = figma.selectedInstance.getEnum("Role", {
  "User": "user",
  "Assistant": "assistant",
  "System": "system",
})
const showAvatar = figma.selectedInstance.getBoolean("Show avatar")

export default {
  id: "Message",
  imports: ["import { Message } from \"@zenginui/ui\";"],
  example: figma.code`<Message${figma.helpers.react.renderProp("role", role)}${figma.helpers.react.renderProp("showAvatar", showAvatar)}/>`,
  metadata: { nestable: true },
}
