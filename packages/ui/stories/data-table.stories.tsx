import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { Badge, DataTable } from "../src";
import { argTypesFor, classNameAllow } from "./manifest";

interface Customer {
  id: string;
  name: string;
  plan: "Free" | "Team" | "Enterprise";
  seats: number;
  status: "active" | "past due" | "cancelled";
}

const CUSTOMERS: Customer[] = [
  { id: "c1", name: "Northwind", plan: "Enterprise", seats: 240, status: "active" },
  { id: "c2", name: "Acme", plan: "Team", seats: 18, status: "active" },
  { id: "c3", name: "Fieldware", plan: "Free", seats: 3, status: "past due" },
  { id: "c4", name: "Blue Harbour", plan: "Team", seats: 42, status: "active" },
  { id: "c5", name: "Kestrel", plan: "Enterprise", seats: 1180, status: "cancelled" },
  { id: "c6", name: "Meridian", plan: "Free", seats: 1, status: "active" },
  { id: "c7", name: "Larkspur", plan: "Team", seats: 26, status: "active" },
];

const TONE = { active: "success", "past due": "warning", cancelled: "neutral" } as const;

const columns = [
  { id: "name", header: "Customer", cell: (c: Customer) => c.name, sortable: true },
  { id: "plan", header: "Plan", cell: (c: Customer) => c.plan, sortable: true },
  // Sorted by the number, shown with a thousands separator: the column says what it sorts on.
  { id: "seats", header: "Seats", cell: (c: Customer) => c.seats.toLocaleString(), value: (c: Customer) => c.seats, align: "end" as const, sortable: true, width: "8rem" },
  {
    id: "status",
    header: "Status",
    cell: (c: Customer) => (
      <Badge size="sm" tone={TONE[c.status]}>
        {c.status}
      </Badge>
    ),
    value: (c: Customer) => c.status,
    sortable: true,
    width: "9rem",
  },
];

const meta = {
  title: "DataTable",
  component: DataTable<Customer>,
  tags: ["autodocs"],
  argTypes: argTypesFor("DataTable"),
  args: { label: "Customers", columns, rows: CUSTOMERS, rowKey: (c: Customer) => c.id, searchable: true },
  parameters: {
    docs: {
      description: {
        component: `A table that sorts, searches and pages. Table stays the styled element; the state above it is what every operator screen rewrites by hand. ${classNameAllow("DataTable")}`,
      },
    },
  },
} satisfies Meta<typeof DataTable<Customer>>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Paged: Story = { args: { pageSize: 3 } };

export const Compact: Story = { args: { density: "sm", searchable: false } };

/** Nothing yet and nothing matched are different states and read differently. */
export const NoRows: Story = { args: { rows: [] } };

/** Sorting a formatted column uses the value behind it, not the text in the cell. */
export const SortsByValueNotText: Story = {
  args: { searchable: false },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: /Seats/ }));
    const cells = canvasElement.querySelectorAll("tbody tr td:nth-child(3)");
    // Ascending by the number: 1 first, and 1,180 last rather than second as a string sort would have it.
    expect(cells[0]!.textContent).toBe("1");
    expect(cells[cells.length - 1]!.textContent).toBe("1,180");
  },
};

/** A search that matches nothing says so, and says what it searched for. */
export const SearchFindsNothing: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText("Search Customers"), "zzz");
    expect(await canvas.findByText(/Nothing matches/)).toBeTruthy();
  },
};
