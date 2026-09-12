import type { Meta, StoryObj } from "@storybook/react-vite";
import { Loader, Message } from "../src";
import { argTypesFor, classNameAllow, values } from "./manifest";

const meta = {
  title: "Loader",
  component: Loader,
  tags: ["autodocs"],
  argTypes: argTypesFor("Loader"),
  args: { label: "Thinking", showLabel: false, size: "md" },
  parameters: { docs: { description: { component: `Three dots for the moment between a question and the first token. ${classNameAllow("Loader")}` } } },
} satisfies Meta<typeof Loader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithLabel: Story = { args: { showLabel: true } };

export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: "grid", gap: "var(--spacing-3)" }}>
      {values("Loader", "size").map((size) => (
        <Loader key={size} {...args} size={size as never} showLabel label={`Size ${size}`} />
      ))}
    </div>
  ),
};

/** Where it lives: an assistant turn that has not started yet. */
export const InAMessage: Story = {
  render: () => (
    <div style={{ width: "36rem", maxWidth: "100%" }}>
      <Message role="assistant">
        <Message.Content>
          <Loader />
        </Message.Content>
      </Message>
    </div>
  ),
};
