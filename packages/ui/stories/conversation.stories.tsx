import type { Meta, StoryObj } from "@storybook/react-vite";
import { Conversation, Markdown, Message } from "../src";
import { argTypesFor, classNameAllow } from "./manifest";

const TURNS = Array.from({ length: 8 }, (_, i) => ({
  role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
  text: i % 2 === 0 ? `Question ${i / 2 + 1}: what does rule ${i / 2 + 1} check?` : `**Rule ${(i - 1) / 2 + 1}** checks one thing and reports it with the fix attached. Scroll up and the column stops following; a button brings you back.`,
}));

const meta = {
  title: "Conversation",
  component: Conversation,
  tags: ["autodocs"],
  argTypes: argTypesFor("Conversation"),
  parameters: { docs: { description: { component: `The scrolling column of messages. It follows new content while the reader is at the bottom and stops the moment they scroll up. Parts: Content, ScrollButton. ${classNameAllow("Conversation")}` } } },
  render: (args) => (
    <div style={{ height: "24rem", width: "36rem", maxWidth: "100%", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)" }}>
      <Conversation {...args} style={{ height: "100%" }}>
        <Conversation.Content>
          {TURNS.map((t, i) => (
            <Message key={i} role={t.role}>
              <Message.Content>
                <Markdown text={t.text} />
              </Message.Content>
            </Message>
          ))}
        </Conversation.Content>
        <Conversation.ScrollButton />
      </Conversation>
    </div>
  ),
} satisfies Meta<typeof Conversation>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
