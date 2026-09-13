import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Sources } from "../src";
import { argTypesFor, classNameAllow } from "./manifest";

const meta = {
  title: "Sources",
  component: Sources,
  tags: ["autodocs"],
  argTypes: argTypesFor("Sources"),
  args: {
    sources: [
      { url: "https://zengin.timurtek.com/#rules", title: "The seven rule kinds" },
      { url: "https://github.com/Timurtek/zengin/blob/main/docs/field-tests/2026-09-12-vercel-ai-chatbot.md", title: "Field test: vercel/ai-chatbot" },
      { url: "https://www.w3.org/community/design-tokens/" },
    ],
    defaultOpen: false,
  },
  parameters: { docs: { description: { component: `Where an answer came from: a count that unfolds into links, each showing its host. ${classNameAllow("Sources")}` } } },
  render: (args) => (
    <div style={{ width: "36rem", maxWidth: "100%" }}>
      <Sources {...args} />
    </div>
  ),
} satisfies Meta<typeof Sources>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {};

export const Open: Story = { args: { defaultOpen: true } };

/** The summary toggles the list; a source without a title shows its URL. */
export const Unfolds: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "3 sources" }));
    await expect(canvas.getByRole("link", { name: /w3.org/ })).toBeInTheDocument();
  },
};
