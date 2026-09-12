import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, Markdown, Message, Reasoning, Sources, ToolCall } from "../src";
import { argTypesFor, classNameAllow, values } from "./manifest";

const meta = {
  title: "Message",
  component: Message,
  tags: ["autodocs"],
  argTypes: argTypesFor("Message"),
  args: { role: "assistant", showAvatar: true },
  parameters: { docs: { description: { component: `One turn of a conversation. Users get a bubble on the right; the assistant gets plain text on the left with room for reasoning, tool calls and sources between its parts. Parts: Content, Actions. ${classNameAllow("Message")}` } } },
  render: (args) => (
    <div style={{ width: "36rem", maxWidth: "100%" }}>
      <Message {...args}>
        <Message.Content>
          <Markdown text="The engine found **eight violations** in that file. Three are color literals with exact token matches; the rest need a decision." />
        </Message.Content>
      </Message>
    </div>
  ),
} satisfies Meta<typeof Message>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Assistant: Story = {};

export const User: Story = {
  args: { role: "user", name: "Mina" },
  render: (args) => (
    <div style={{ width: "36rem", maxWidth: "100%" }}>
      <Message {...args}>
        <Message.Content>Check src/Actions.tsx against the system.</Message.Content>
      </Message>
    </div>
  ),
};

export const Roles: Story = {
  render: (args) => (
    <div style={{ display: "grid", gap: "var(--spacing-4)", width: "36rem", maxWidth: "100%" }}>
      {values("Message", "role").map((role) => (
        <Message key={role} {...args} role={role as never}>
          <Message.Content>{role === "system" ? "Model switched to Fable 5.1" : `A ${role} message.`}</Message.Content>
        </Message>
      ))}
    </div>
  ),
};

/** An assistant turn with every kind of part: thinking, a tool call, the answer, its sources, and actions. */
export const WithParts: Story = {
  render: (args) => (
    <div style={{ width: "36rem", maxWidth: "100%" }}>
      <Message {...args}>
        <Message.Content>
          <Reasoning text="The user wants the violations for one file. I should run the check on that path only, then summarise by rule." duration={2.4} />
          <ToolCall name="zengin_check_code" state="output-available" input={{ path: "src/Actions.tsx" }} output={{ violations: 8, byRule: { "color-literal": 3, "spacing-literal": 2 } }} />
          <Markdown text={'Eight violations, three of them color literals with exact token matches. Here is the first:\n\n```tsx\n<span style={{ color: "var(--color-text-muted)" }}>\n```'} />
          <Sources sources={[{ url: "https://zengin-marketing-site.vercel.app/#rules", title: "The seven rule kinds" }]} />
        </Message.Content>
        <Message.Actions>
          <Button variant="ghost" size="sm">
            Copy
          </Button>
          <Button variant="ghost" size="sm">
            Regenerate
          </Button>
        </Message.Actions>
      </Message>
    </div>
  ),
};
