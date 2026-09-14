import type { Meta, StoryObj } from "@storybook/react-vite";
import { Card, StatTile } from "../src";
import { argTypesFor, classNameAllow, values } from "./manifest";

const SERIES = [12, 14, 13, 17, 16, 19, 22, 21, 24, 26, 25, 29, 31, 30, 34];

const meta = {
  title: "StatTile",
  component: StatTile,
  tags: ["autodocs"],
  argTypes: argTypesFor("StatTile"),
  args: { label: "Monthly revenue", value: "£48,210", delta: 12.4, series: SERIES, caption: "vs previous 30 days", size: "md" },
  parameters: {
    docs: {
      description: {
        component: `One number, its direction, and its recent shape. The colour of the change is a judgment about the metric rather than the sign of the number, so the tile asks which it is. ${classNameAllow("StatTile")}`,
      },
    },
  },
  render: (args) => (
    <Card padding="md" style={{ maxWidth: "22rem" }}>
      <StatTile {...args} />
    </Card>
  ),
} satisfies Meta<typeof StatTile>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/**
 * The same fall, read two ways. Revenue down is bad news; churn down is the goal. Nothing but
 * `higherIsBetter` separates them, which is why it is a prop and not an inference.
 */
export const DirectionIsAJudgment: Story = {
  render: () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "var(--spacing-4)" }}>
      <Card padding="md">
        <StatTile label="Monthly revenue" value="£41,880" delta={-6.2} series={[...SERIES].reverse()} caption="vs previous 30 days" />
      </Card>
      <Card padding="md">
        <StatTile label="Churn" value="1.8%" delta={-6.2} higherIsBetter={false} series={[...SERIES].reverse()} caption="vs previous 30 days" />
      </Card>
    </div>
  ),
};

/** A figure with nothing to compare to says nothing about direction, rather than saying zero. */
export const NoComparison: Story = {
  args: { delta: undefined, series: undefined, caption: "as of today", value: "1,180", label: "Seats in use" },
};

export const Sizes: Story = {
  render: (args) => (
    <div style={{ display: "grid", gap: "var(--spacing-4)" }}>
      {values("StatTile", "size").map((size) => (
        <Card key={size} padding="md" style={{ maxWidth: "22rem" }}>
          <StatTile {...args} size={size as "sm" | "md"} />
        </Card>
      ))}
    </div>
  ),
};
