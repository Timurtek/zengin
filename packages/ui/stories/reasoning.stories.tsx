import type { Meta, StoryObj } from "@storybook/react-vite";
import { Reasoning } from "../src";
import { argTypesFor, classNameAllow } from "./manifest";

const TEXT = "The user asked for violations in one file. Running the check on the whole scope would be slower and noisier, so I will pass the path.\n\nThe result should be grouped by rule, since that is how the CLI prints it and what the user will compare against.";

const meta = {
  title: "Reasoning",
  component: Reasoning,
  tags: ["autodocs"],
  argTypes: argTypesFor("Reasoning"),
  args: { text: TEXT, streaming: false, duration: 2.4 },
  parameters: { docs: { description: { component: `A model's thinking, folded under a one-line summary. Open while it streams, closed once the answer starts, unless the reader touched it. ${classNameAllow("Reasoning")}` } } },
  render: (args) => (
    <div style={{ width: "36rem", maxWidth: "100%" }}>
      <Reasoning {...args} />
    </div>
  ),
} satisfies Meta<typeof Reasoning>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Done: Story = {};

export const Streaming: Story = { args: { streaming: true, duration: undefined, text: "The user asked for violations in one file. Running the check on the whole scope would be" } };

export const Open: Story = { args: { defaultOpen: true } };
