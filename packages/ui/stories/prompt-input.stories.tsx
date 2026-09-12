import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fn, userEvent, within } from "storybook/test";
import { Button, PromptInput } from "../src";
import { argTypesFor, classNameAllow, values } from "./manifest";

const meta = {
  title: "PromptInput",
  component: PromptInput,
  tags: ["autodocs"],
  argTypes: argTypesFor("PromptInput"),
  args: { onSubmit: fn(), onStop: fn(), status: "ready", placeholder: "Ask about the system", maxRows: 8 },
  parameters: { docs: { description: { component: `Where the user types: a field that grows with the text, Enter to send and Shift+Enter for a new line, a send button that becomes stop while the answer streams, and a slot for tools beside it. ${classNameAllow("PromptInput")}` } } },
  render: (args) => (
    <div style={{ width: "36rem", maxWidth: "100%" }}>
      <PromptInput {...args} />
    </div>
  ),
} satisfies Meta<typeof PromptInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithToolbar: Story = {
  args: {
    toolbar: (
      <>
        <Button variant="ghost" size="sm">
          Attach
        </Button>
        <Button variant="ghost" size="sm">
          Fable 5.1
        </Button>
      </>
    ),
  },
};

export const Statuses: Story = {
  render: (args) => (
    <div style={{ display: "grid", gap: "var(--spacing-4)", width: "36rem", maxWidth: "100%" }}>
      {values("PromptInput", "status").map((status) => (
        <PromptInput key={status} {...args} status={status as never} defaultValue={`status: ${status}`} />
      ))}
    </div>
  ),
};

/** Enter sends the trimmed text and clears the field; Shift+Enter makes a new line. */
export const SendsOnEnter: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    const field = canvas.getByRole("textbox", { name: "Message" });
    await userEvent.type(field, "first line{Shift>}{Enter}{/Shift}second line  ");
    await userEvent.keyboard("{Enter}");
    await expect(args.onSubmit).toHaveBeenCalledWith("first line\nsecond line");
    await expect(field).toHaveValue("");
  },
};
