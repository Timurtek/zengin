import type { Meta, StoryObj } from "@storybook/react-vite";
import { ToolCall } from "../src";
import { argTypesFor, classNameAllow, values } from "./manifest";

const meta = {
  title: "ToolCall",
  component: ToolCall,
  tags: ["autodocs"],
  argTypes: argTypesFor("ToolCall"),
  args: { name: "zengin_check_code", state: "output-available", input: { path: "src/Actions.tsx" }, output: { violations: 8, byRule: { "color-literal": 3, "spacing-literal": 2, "unknown-prop": 1 } }, defaultOpen: true },
  parameters: { docs: { description: { component: `A tool the model called: its name, where it is, and the input and output folded underneath. States follow the AI SDK's tool parts. ${classNameAllow("ToolCall")}` } } },
  render: (args) => (
    <div style={{ width: "36rem", maxWidth: "100%" }}>
      <ToolCall {...args} />
    </div>
  ),
} satisfies Meta<typeof ToolCall>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Done: Story = {};

export const Failed: Story = { args: { state: "output-error", output: undefined, errorText: "ENOENT: src/Actions.tsx does not exist" } };

export const States: Story = {
  render: (args) => (
    <div style={{ display: "grid", gap: "var(--spacing-3)", width: "36rem", maxWidth: "100%" }}>
      {values("ToolCall", "state").map((state) => (
        <ToolCall key={state} {...args} state={state as never} defaultOpen={false} errorText={state === "output-error" ? "Timed out after 30s" : undefined} />
      ))}
    </div>
  ),
};
