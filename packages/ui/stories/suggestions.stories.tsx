import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { Suggestions } from "../src";
import { argTypesFor, classNameAllow, values } from "./manifest";

const ITEMS = ["What does color-literal catch?", "Check src/Actions.tsx", "Explain the owned pragma", "How do I add a theme?"];

const meta = {
  title: "Suggestions",
  component: Suggestions,
  tags: ["autodocs"],
  argTypes: argTypesFor("Suggestions"),
  args: { items: ITEMS, onSelect: fn(), layout: "wrap" },
  parameters: { docs: { description: { component: `Prompts to start from, as a row of chips. ${classNameAllow("Suggestions")}` } } },
  render: (args) => (
    <div style={{ width: "32rem", maxWidth: "100%" }}>
      <Suggestions {...args} />
    </div>
  ),
} satisfies Meta<typeof Suggestions>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Wrap: Story = {};

export const Layouts: Story = {
  render: (args) => (
    <div style={{ display: "grid", gap: "var(--spacing-4)", width: "32rem", maxWidth: "100%" }}>
      {values("Suggestions", "layout").map((layout) => (
        <Suggestions key={layout} {...args} layout={layout as never} />
      ))}
    </div>
  ),
};
