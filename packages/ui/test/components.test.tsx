import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Avatar, Badge, BarChart, Button, Card, Checkbox, Dialog, LineChart, Menu, Popover, Progress, Select, Separator, Sheet, Skeleton, Sparkline, Switch, Table, Tabs, TextArea, TextField, Toast, Tooltip, initials, toast } from "../src/index.js";
import { axisLabelIndexes } from "../src/components/line-chart/line-chart.js";
import { extent, linePath, defaultFormat } from "../src/internal/chart.js";

describe("Button", () => {
  it("renders defaults as data attributes the stylesheet keys on", () => {
    render(<Button>Save</Button>);
    const b = screen.getByRole("button", { name: "Save" });
    expect(b).toHaveAttribute("data-variant", "solid");
    expect(b).toHaveAttribute("data-tone", "neutral");
    expect(b).toHaveAttribute("data-size", "md");
    expect(b).toHaveAttribute("type", "button");
    expect(b).toHaveClass("z-button", "z-focusable");
  });

  it("loading disables the control, announces busy, and keeps the label for width", () => {
    render(<Button loading>Save</Button>);
    const b = screen.getByRole("button");
    expect(b).toBeDisabled();
    expect(b).toHaveAttribute("aria-busy", "true");
    expect(b).toHaveAttribute("data-loading", "true");
    expect(b.querySelector(".z-button__label")).toHaveTextContent("Save");
    expect(b.querySelector(".z-button__spinner")).not.toBeNull();
  });

  it("asChild renders the child element with the button styling", () => {
    render(
      <Button asChild variant="link" tone="primary">
        <a href="/docs">Docs</a>
      </Button>,
    );
    const a = screen.getByRole("link", { name: "Docs" });
    expect(a).toHaveClass("z-button");
    expect(a).toHaveAttribute("data-variant", "link");
    expect(a).not.toHaveAttribute("type");
  });

  it("passes className through for placement", () => {
    render(<Button className="mt-4">x</Button>);
    expect(screen.getByRole("button")).toHaveClass("z-button", "mt-4");
  });
});

describe("Badge", () => {
  it("exposes tone, variant and size", () => {
    render(<Badge tone="success" variant="outline" size="sm">Approved</Badge>);
    const el = screen.getByText("Approved");
    expect(el.tagName).toBe("SPAN");
    expect(el).toHaveAttribute("data-tone", "success");
    expect(el).toHaveAttribute("data-variant", "outline");
    expect(el).toHaveAttribute("data-size", "sm");
  });
});

describe("Card", () => {
  it("renders parts and interactive state", () => {
    render(
      <Card variant="elevated" padding="lg" interactive tabIndex={0} role="button">
        <Card.Header>Title</Card.Header>
        <Card.Body>Body</Card.Body>
        <Card.Footer>Footer</Card.Footer>
      </Card>,
    );
    const card = screen.getByRole("button");
    expect(card).toHaveAttribute("data-variant", "elevated");
    expect(card).toHaveAttribute("data-padding", "lg");
    expect(card).toHaveAttribute("data-interactive", "true");
    expect(card).toHaveClass("z-focusable");
    expect(card.querySelector(".z-card__header")).toHaveTextContent("Title");
    expect(card.querySelector(".z-card__footer")).toHaveTextContent("Footer");
  });
});

describe("TextField", () => {
  it("wires label, description and error to the input", () => {
    render(<TextField label="Email" description="Work address" error="Required" required />);
    const input = screen.getByLabelText(/Email/);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toBeRequired();
    const described = input.getAttribute("aria-describedby")!.split(" ");
    expect(described).toHaveLength(2);
    expect(screen.getByText("Work address").id).toBe(described[0]);
    expect(screen.getByRole("alert")).toHaveTextContent("Required");
    expect(input.closest(".z-field")).toHaveAttribute("data-invalid", "true");
  });

  it("reflects disabled and readonly on the wrapper for styling", () => {
    render(<TextField label="A" disabled readOnly />);
    const wrap = screen.getByLabelText("A").closest(".z-field");
    expect(wrap).toHaveAttribute("data-disabled", "true");
    expect(wrap).toHaveAttribute("data-readonly", "true");
  });
});

describe("Checkbox", () => {
  it("toggles through the label and supports indeterminate", () => {
    const onChange = vi.fn();
    render(<Checkbox label="Accept" description="Terms" onCheckedChange={onChange} />);
    const box = screen.getByRole("checkbox", { name: "Accept" });
    expect(box).toHaveAttribute("data-state", "unchecked");
    expect(box).toHaveAccessibleDescription("Terms");
    fireEvent.click(screen.getByText("Accept"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("renders indeterminate", () => {
    render(<Checkbox label="Some" checked="indeterminate" />);
    expect(screen.getByRole("checkbox")).toHaveAttribute("data-state", "indeterminate");
  });
});

describe("Dialog", () => {
  it("opens from the trigger, sizes the panel, and closes from the close button", () => {
    render(
      <Dialog size="lg">
        <Dialog.Trigger asChild>
          <Button>Open</Button>
        </Dialog.Trigger>
        <Dialog.Content>
          <Dialog.Title>Reject this item?</Dialog.Title>
          <Dialog.Description>It will be sent back.</Dialog.Description>
          <Dialog.Footer>
            <Dialog.Close asChild>
              <Button variant="ghost">Cancel</Button>
            </Dialog.Close>
            <Button tone="danger">Reject</Button>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog>,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    const dialog = screen.getByRole("dialog", { name: "Reject this item?" });
    expect(dialog).toHaveAttribute("data-size", "lg");
    expect(dialog).toHaveAccessibleDescription("It will be sent back.");
    expect(screen.getByRole("button", { name: "Close" })).toHaveClass("z-dialog__close");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("is controllable", () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <Dialog.Content showClose={false}>
          <Dialog.Title>T</Dialog.Title>
        </Dialog.Content>
      </Dialog>,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("Tooltip", () => {
  it("shows content on focus of the trigger", async () => {
    vi.useFakeTimers();
    try {
      render(
        <Tooltip.Provider>
          <Tooltip content="Delete item" side="bottom" delay={0}>
            <Button>Del</Button>
          </Tooltip>
        </Tooltip.Provider>,
      );
      const trigger = screen.getByRole("button", { name: "Del" });
      act(() => {
        trigger.focus();
      });
      act(() => {
        vi.runAllTimers();
      });
      expect(trigger.getAttribute("data-state")).toMatch(/open/);
      const tip = document.querySelector(".z-tooltip");
      expect(tip).not.toBeNull();
      expect(tip).toHaveAttribute("data-side", "bottom");
      expect(tip).toHaveTextContent("Delete item");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("Tabs", () => {
  function Surfaces(props: { variant?: "line" | "pill"; size?: "sm" | "md" }) {
    return (
      <Tabs defaultValue="mcp" {...props}>
        <Tabs.List aria-label="Surfaces">
          <Tabs.Trigger value="mcp">MCP</Tabs.Trigger>
          <Tabs.Trigger value="hook">Hook</Tabs.Trigger>
          <Tabs.Trigger value="cli" disabled>
            CLI
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="mcp">Tools the agent calls.</Tabs.Content>
        <Tabs.Content value="hook">Runs after every edit.</Tabs.Content>
        <Tabs.Content value="cli">Runs in CI.</Tabs.Content>
      </Tabs>
    );
  }

  it("renders the ARIA tab pattern with defaults as data attributes", () => {
    const { container } = render(<Surfaces />);
    const root = container.querySelector(".z-tabs")!;
    expect(root).toHaveAttribute("data-variant", "line");
    expect(root).toHaveAttribute("data-size", "md");
    expect(screen.getByRole("tablist", { name: "Surfaces" })).toBeInTheDocument();
    expect(screen.getAllByRole("tab")).toHaveLength(3);
    expect(screen.getByRole("tab", { name: "MCP" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Tools the agent calls.");
    expect(screen.getByRole("tab", { name: "CLI" })).toBeDisabled();
  });

  it("switches panels on click and hides the inactive ones", () => {
    render(<Surfaces variant="pill" size="sm" />);
    fireEvent.mouseDown(screen.getByRole("tab", { name: "Hook" }));
    expect(screen.getByRole("tab", { name: "Hook" })).toHaveAttribute("data-state", "active");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Runs after every edit.");
    expect(screen.queryByText("Tools the agent calls.")).not.toBeInTheDocument();
  });

  it("is controllable", () => {
    const onChange = vi.fn();
    render(
      <Tabs value="a" onValueChange={onChange}>
        <Tabs.List>
          <Tabs.Trigger value="a">A</Tabs.Trigger>
          <Tabs.Trigger value="b">B</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="a">Panel A</Tabs.Content>
        <Tabs.Content value="b">Panel B</Tabs.Content>
      </Tabs>,
    );
    fireEvent.mouseDown(screen.getByRole("tab", { name: "B" }));
    expect(onChange).toHaveBeenCalledWith("b");
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Panel A"); // still controlled by the parent
  });
});

describe("Select", () => {
  it("labels the trigger, shows the placeholder, and sizes the field", () => {
    render(
      <Select label="Environment" placeholder="Choose" size="lg" description="Where it deploys">
        <Select.Item value="prod">Production</Select.Item>
      </Select>,
    );
    const trigger = screen.getByRole("combobox", { name: "Environment" });
    expect(trigger).toHaveTextContent("Choose");
    expect(trigger).toHaveAccessibleDescription("Where it deploys");
    expect(trigger.closest(".z-select")).toHaveAttribute("data-size", "lg");
  });

  it("marks invalid and disabled", () => {
    render(
      <Select label="Env" error="Required" disabled>
        <Select.Item value="a">A</Select.Item>
      </Select>,
    );
    const trigger = screen.getByRole("combobox", { name: "Env" });
    expect(trigger).toHaveAttribute("aria-invalid", "true");
    expect(trigger).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Required");
  });
});

describe("Switch", () => {
  it("toggles through the label and reports the change", () => {
    const onChange = vi.fn();
    render(<Switch label="Notify" description="Once per review" onCheckedChange={onChange} size="sm" />);
    const control = screen.getByRole("switch", { name: "Notify" });
    expect(control).toHaveAttribute("data-state", "unchecked");
    expect(control).toHaveAccessibleDescription("Once per review");
    fireEvent.click(screen.getByText("Notify"));
    expect(onChange).toHaveBeenCalledWith(true);
    expect(control.closest(".z-switch")).toHaveAttribute("data-size", "sm");
  });
});

describe("Toast", () => {
  it("shows a toast from anywhere, with its tone, and dismisses it", () => {
    const { container } = render(<Toast.Provider position="top-left" />);
    expect(screen.getByRole("region", { name: "Notifications" })).toBeInTheDocument();
    expect(container.querySelector(".z-toast__viewport")).toHaveAttribute("data-position", "top-left");
    act(() => {
      toast({ title: "Saved", description: "Sent back to the author.", tone: "success" });
    });
    const item = screen.getByText("Saved").closest(".z-toast")!;
    expect(item).toHaveAttribute("data-tone", "success");
    expect(screen.getByText("Sent back to the author.")).toBeInTheDocument();
    act(() => {
      toast.dismiss();
    });
    expect(screen.queryByText("Saved")).toBeNull();
  });
});

describe("Menu", () => {
  it("opens from the trigger, lists items with tones, and selects one", () => {
    const onSelect = vi.fn();
    render(
      <Menu>
        <Menu.Trigger asChild>
          <Button>Actions</Button>
        </Menu.Trigger>
        <Menu.Content>
          <Menu.Item onSelect={onSelect} shortcut="E">
            Edit
          </Menu.Item>
          <Menu.Item tone="danger">Delete</Menu.Item>
        </Menu.Content>
      </Menu>,
    );
    fireEvent.pointerDown(screen.getByRole("button", { name: "Actions" }), { button: 0, ctrlKey: false, pointerType: "mouse" });
    const menu = screen.getByRole("menu");
    expect(menu).toHaveClass("z-menu");
    expect(screen.getByRole("menuitem", { name: /Delete/ })).toHaveAttribute("data-tone", "danger");
    fireEvent.click(screen.getByRole("menuitem", { name: /Edit/ }));
    expect(onSelect).toHaveBeenCalled();
  });
});

describe("Table", () => {
  it("renders the table pattern with density, alignment and selection as data attributes", () => {
    render(
      <Table density="sm" stickyHeader aria-label="Reviews" style={{ maxHeight: "10rem" }}>
        <Table.Head>
          <Table.Row>
            <Table.HeadCell>Title</Table.HeadCell>
            <Table.HeadCell align="end" numeric>
              Files
            </Table.HeadCell>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          <Table.Row selected interactive>
            <Table.Cell>Rename tokens</Table.Cell>
            <Table.Cell align="end" numeric>
              12
            </Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table>,
    );
    const table = screen.getByRole("table", { name: "Reviews" });
    const wrap = table.closest(".z-table")!;
    expect(wrap).toHaveAttribute("data-density", "sm");
    expect(wrap).toHaveAttribute("data-sticky", "true");
    expect((wrap as HTMLElement).style.maxHeight).toBe("10rem");
    expect(screen.getByRole("columnheader", { name: "Files" })).toHaveAttribute("data-align", "end");
    const row = screen.getByRole("row", { name: /Rename tokens/ });
    expect(row).toHaveAttribute("aria-selected", "true");
    expect(row).toHaveAttribute("data-interactive", "true");
    expect(screen.getByRole("cell", { name: "12" })).toHaveAttribute("data-numeric", "true");
  });
});

describe("Avatar", () => {
  it("falls back to initials with the name as its label", () => {
    render(<Avatar name="Ada Lovelace" size="lg" shape="square" />);
    const img = screen.getByRole("img", { name: "Ada Lovelace" });
    expect(img).toHaveTextContent("AL");
    expect(img.closest(".z-avatar")).toHaveAttribute("data-size", "lg");
    expect(img.closest(".z-avatar")).toHaveAttribute("data-shape", "square");
  });

  it("computes initials", () => {
    expect(initials("Ada Lovelace")).toBe("AL");
    expect(initials("Acme")).toBe("A");
    expect(initials("  ")).toBe("");
    expect(initials("grace brewster murray hopper")).toBe("GH");
  });
});

describe("Skeleton", () => {
  it("is hidden from assistive tech and renders lines", () => {
    const { container } = render(<Skeleton lines={3} />);
    const lines = container.querySelectorAll(".z-skeleton");
    expect(lines).toHaveLength(3);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect((lines[2] as HTMLElement).style.width).toBe("60%");
  });

  it("takes a variant and dimensions", () => {
    const { container } = render(<Skeleton variant="circle" width="2rem" height="2rem" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el).toHaveAttribute("data-variant", "circle");
    expect(el.style.width).toBe("2rem");
  });
});

describe("Sheet", () => {
  it("opens from the trigger on the chosen side and closes", () => {
    render(
      <Sheet side="left" size="lg">
        <Sheet.Trigger asChild>
          <Button>Open</Button>
        </Sheet.Trigger>
        <Sheet.Content>
          <Sheet.Title>Filters</Sheet.Title>
          <Sheet.Description>Narrow the queue.</Sheet.Description>
          <Sheet.Footer>
            <Sheet.Close asChild>
              <Button variant="ghost">Done</Button>
            </Sheet.Close>
          </Sheet.Footer>
        </Sheet.Content>
      </Sheet>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    const panel = screen.getByRole("dialog", { name: "Filters" });
    expect(panel).toHaveAttribute("data-side", "left");
    expect(panel).toHaveAttribute("data-size", "lg");
    expect(panel).toHaveAccessibleDescription("Narrow the queue.");
    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("Popover", () => {
  it("opens from the trigger with its size and closes from inside", () => {
    render(
      <Popover size="sm">
        <Popover.Trigger asChild>
          <Button>Filter</Button>
        </Popover.Trigger>
        <Popover.Content>
          Options
          <Popover.Close asChild>
            <Button>Apply</Button>
          </Popover.Close>
        </Popover.Content>
      </Popover>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Filter" }));
    const panel = screen.getByRole("dialog");
    expect(panel).toHaveClass("z-popover");
    expect(panel).toHaveAttribute("data-size", "sm");
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("Progress", () => {
  it("exposes the value, label and percentage", () => {
    render(<Progress value={30} max={60} label="Storage" showValue tone="warning" size="sm" />);
    const bar = screen.getByRole("progressbar", { name: "Storage" });
    expect(bar).toHaveAttribute("aria-valuenow", "30");
    expect(bar).toHaveAttribute("aria-valuemax", "60");
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(bar.closest(".z-progress")).toHaveAttribute("data-tone", "warning");
    expect(bar.closest(".z-progress")).toHaveAttribute("data-size", "sm");
  });

  it("is indeterminate without a value", () => {
    render(<Progress />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("data-state", "indeterminate");
  });
});

describe("Separator", () => {
  it("is decorative by default, semantic on request, and can carry a label", () => {
    const { container, rerender } = render(<Separator />);
    expect(container.querySelector(".z-separator")).toHaveAttribute("data-orientation", "horizontal");
    expect(screen.queryByRole("separator")).toBeNull();
    rerender(<Separator orientation="vertical" decorative={false} />);
    expect(screen.getByRole("separator")).toHaveAttribute("aria-orientation", "vertical");
    rerender(<Separator label="or" />);
    expect(screen.getByText("or")).toHaveClass("z-separator__label");
  });
});

describe("TextArea", () => {
  it("associates label, description and error, and exposes size and resize", () => {
    render(<TextArea label="Reason" description="Seen by the author" error="Required" size="lg" resize="none" rows={5} />);
    const area = screen.getByRole("textbox", { name: "Reason" });
    expect(area).toHaveAttribute("rows", "5");
    expect(area).toHaveAttribute("aria-invalid", "true");
    expect(area).toHaveAccessibleDescription("Seen by the author Required");
    const wrap = area.closest(".z-textarea")!;
    expect(wrap).toHaveAttribute("data-size", "lg");
    expect(wrap).toHaveAttribute("data-resize", "none");
  });
});

describe("charts", () => {
  it("describes the data for assistive tech and tones each series", () => {
    const { container } = render(
      <LineChart series={[{ name: "Revenue", values: [1, 2, 3] }, { name: "Refunds", values: [1, 1, 2], tone: "danger" }]} labels={["a", "b", "c"]} aria-label="Revenue" />,
    );
    const root = container.querySelector(".z-chart")!;
    expect(root).toHaveAttribute("aria-label", "Revenue");
    expect(root).toHaveAttribute("data-kind", "line");
    expect(root.querySelector(".z-sr-only")).toHaveTextContent("Revenue: 3 points from 1 to 3, latest 3. Refunds: 3 points from 1 to 2, latest 2");
    // Two series get a legend; the second keeps its explicit tone, the first takes the cycle's.
    const legend = root.querySelectorAll(".z-chart__legend li");
    expect(legend).toHaveLength(2);
    expect(legend[0]).toHaveAttribute("data-tone", "primary");
    expect(legend[1]).toHaveAttribute("data-tone", "danger");
  });

  it("renders bars and sparklines with their kinds and trends", () => {
    const { container } = render(
      <>
        <BarChart series={[{ name: "Signups", values: [5, 3] }]} labels={["Free", "Team"]} aria-label="Signups" />
        <Sparkline values={[1, 2, 3]} tone="success" aria-label="Up" />
        <Sparkline values={[3, 2, 1]} aria-label="Down" />
        <Sparkline values={[]} aria-label="Empty" />
      </>,
    );
    expect(container.querySelector(".z-chart[data-kind='bar']")).toHaveAttribute("aria-label", "Signups");
    const sparks = container.querySelectorAll(".z-sparkline");
    expect(sparks[0]).toHaveAttribute("data-trend", "up");
    expect(sparks[0]).toHaveAttribute("data-tone", "success");
    expect(sparks[1]).toHaveAttribute("data-trend", "down");
    expect(sparks[2]).toHaveAttribute("data-trend", "flat");
    expect(sparks[2]!.querySelector(".z-sr-only")).toHaveTextContent("no data");
  });

  it("computes tidy extents, paths, labels and formats", () => {
    expect(extent([{ name: "a", values: [3, 47, 12] }])).toEqual({ min: 0, max: 60, ticks: [0, 20, 40, 60] });
    expect(extent([{ name: "a", values: [-5, 5] }]).min).toBeLessThanOrEqual(-5);
    expect(linePath([[0, 0], [10, 10]], false)).toBe("M0.0 0.0 L10.0 10.0");
    expect(linePath([[0, 0], [10, 10], [20, 0]], true)).toMatch(/^M0\.0 0\.0 C/);
    expect(axisLabelIndexes(30, 5)).toEqual([0, 7, 15, 22, 29]);
    expect(axisLabelIndexes(1, 5)).toEqual([0]);
    expect(defaultFormat(1234)).toBe("1.2k");
    expect(defaultFormat(2_500_000)).toBe("2.5M");
    expect(defaultFormat(7)).toBe("7");
  });
});
