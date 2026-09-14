import type { Meta, StoryObj } from "@storybook/react-vite";
import { Kbd } from "../src";
import { argTypesFor, classNameAllow, values } from "./manifest";

const meta = {
  title: "Kbd",
  component: Kbd,
  tags: ["autodocs"],
  argTypes: argTypesFor("Kbd"),
  args: { keys: ["Ctrl", "K"], size: "md" },
  parameters: {
    docs: {
      description: {
        component: `A key or a chord, as the keyboard shows it. Always the same shape, which is the point: a shortcut written as plain text in one place and a styled span in another is how a product ends up with three different-looking \`Ctrl\`. ${classNameAllow("Kbd")}`,
      },
    },
  },
} satisfies Meta<typeof Kbd>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Chord: Story = {};

export const SingleKey: Story = { args: { keys: ["Esc"] } };

export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-4)" }}>
      {values("Kbd", "size").map((size) => (
        <Kbd key={size} {...args} size={size as "sm" | "md"} />
      ))}
    </div>
  ),
};

/** Where it usually appears: at the end of a line of text, or beside a menu item. */
export const InContext: Story = {
  render: () => (
    <p style={{ display: "flex", alignItems: "center", gap: "var(--spacing-2)", color: "var(--color-text-muted)" }}>
      Press <Kbd keys={["Ctrl", "K"]} size="sm" /> to search, or <Kbd keys={["Esc"]} size="sm" /> to close.
    </p>
  ),
};
