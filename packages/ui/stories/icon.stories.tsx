import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button, Icon, iconNames, TextField } from "../src";
import { argTypesFor } from "./manifest";

const meta = {
  title: "Icon",
  component: Icon.Search,
  tags: ["autodocs"],
  argTypes: argTypesFor("Icon"),
  parameters: {
    docs: {
      description: {
        component:
          "The icon vocabulary. Components and templates draw by name (Icon.Search, Icon.Close) and never import an icon package; the drawings are Zengin UI's own until `zengin icons <set>` points the same names at a react-icons set for the whole project. Sized by font-size (1em) unless `size` says otherwise.",
      },
    },
  },
} satisfies Meta<typeof Icon.Search>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Vocabulary: Story = {
  render: () => (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(112px, 1fr))", gap: "var(--spacing-3)" }}>
      {iconNames.map((name) => {
        const Glyph = Icon[name];
        return (
          <div key={name} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--spacing-2)", padding: "var(--spacing-3)", border: "var(--border-width) solid var(--color-border)", borderRadius: "var(--radius-md)" }}>
            <Glyph size={20} />
            <code style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>{name}</code>
          </div>
        );
      })}
    </div>
  ),
};

export const InComponents: Story = {
  render: () => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--spacing-3)", alignItems: "center" }}>
      <Button leadingIcon={<Icon.Plus />}>New customer</Button>
      <Button variant="soft" trailingIcon={<Icon.Download />}>
        Export
      </Button>
      <Button variant="ghost" size="sm" aria-label="Settings">
        <Icon.Settings />
      </Button>
      <TextField placeholder="Search customers" aria-label="Search" leadingIcon={<Icon.Search />} />
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div style={{ display: "flex", gap: "var(--spacing-4)", alignItems: "flex-end" }}>
      {[12, 16, 20, 24, 32].map((size) => (
        <div key={size} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "var(--spacing-1)" }}>
          <Icon.Bell size={size} />
          <code style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>{size}</code>
        </div>
      ))}
    </div>
  ),
};
