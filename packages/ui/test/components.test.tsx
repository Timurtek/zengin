import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Avatar, Badge, BarChart, Button, Card, Checkbox, CodeBlock, Combobox, Conversation, DataTable, Dialog, EmptyState, Kanban, Kbd, LineChart, Loader, Markdown, Menu, Message, Popover, Progress, PromptInput, Reasoning, Select, Separator, Sheet, Skeleton, Sources, Sparkline, StatTile, Suggestions, Switch, Table, Tabs, TextArea, TextField, Toast, ToolCall, Tooltip, initials, parseMarkdown, toast } from "../src/index.js";
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

describe("AI kit", () => {
  it("parses the markdown subset models produce", () => {
    const blocks = parseMarkdown("## Title\n\nOne `code` and **bold** with [a link](https://x.io/p).\n\n- first\n- second\n\n```ts\nconst a = 1;\n```\n\n> quoted\n\n---\n1. one\n2. two");
    expect(blocks.map((b) => b.kind)).toEqual(["heading", "paragraph", "list", "code", "quote", "rule", "list"]);
    expect(blocks[2]).toMatchObject({ kind: "list", ordered: false });
    expect(blocks[3]).toEqual({ kind: "code", language: "ts", code: "const a = 1;" });
    expect(blocks[6]).toMatchObject({ kind: "list", ordered: true });
    const para = blocks[1]!;
    expect(para.kind === "paragraph" && para.children.map((n) => n.kind)).toEqual(["text", "code", "text", "strong", "text", "link", "text"]);
    // An unclosed fence while streaming is still a code block.
    expect(parseMarkdown("```css\n.a { color: red; }")[0]).toEqual({ kind: "code", language: "css", code: ".a { color: red; }" });
  });

  it("renders markdown without raw HTML and shows a cursor while streaming", () => {
    const { container } = render(<Markdown text={"Hello **there** <b>x</b>\n\n```ts\nlet a\n```"} streaming />);
    expect(container.querySelector("strong")).toHaveTextContent("there");
    expect(container.querySelector("b")).toBeNull();
    expect(container.textContent).toContain("<b>x</b>");
    expect(container.querySelector(".z-codeblock code")).toHaveTextContent("let a");
    expect(container.querySelector(".z-markdown__cursor")).not.toBeNull();
  });

  it("code block shows its language and copies", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: write } });
    render(<CodeBlock code="npm i" language="bash" />);
    expect(screen.getByText("bash")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    expect(write).toHaveBeenCalledWith("npm i");
    await screen.findByText("Copied");
  });

  it("messages take a role and label themselves", () => {
    render(
      <Message role="user" name="Mina">
        <Message.Content>Hi</Message.Content>
      </Message>,
    );
    const m = screen.getByRole("article", { name: "Mina" });
    expect(m).toHaveAttribute("data-role", "user");
    expect(screen.getByRole("img", { name: "Mina" })).toHaveTextContent("M");
  });

  it("conversation exposes a live log and hides the jump button at the bottom", () => {
    render(
      <Conversation>
        <Conversation.Content>
          <Message role="assistant">
            <Message.Content>One</Message.Content>
          </Message>
        </Conversation.Content>
        <Conversation.ScrollButton />
      </Conversation>,
    );
    expect(screen.getByRole("log")).toHaveAttribute("aria-live", "polite");
    expect(screen.queryByRole("button", { name: "Jump to latest" })).toBeNull();
  });

  it("prompt input sends on Enter, keeps Shift+Enter, and swaps to stop while streaming", () => {
    const onSubmit = vi.fn();
    const onStop = vi.fn();
    const { rerender } = render(<PromptInput onSubmit={onSubmit} onStop={onStop} />);
    const field = screen.getByRole("textbox", { name: "Message" });
    expect(screen.getByRole("button", { name: "Send" })).toBeDisabled();
    fireEvent.change(field, { target: { value: "  hello  " } });
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
    fireEvent.keyDown(field, { key: "Enter", shiftKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
    fireEvent.keyDown(field, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledWith("hello");
    expect(field).toHaveValue("");
    rerender(<PromptInput onSubmit={onSubmit} onStop={onStop} status="streaming" />);
    fireEvent.click(screen.getByRole("button", { name: "Stop generating" }));
    expect(onStop).toHaveBeenCalled();
    expect(screen.getByRole("textbox").closest(".z-prompt")).toHaveAttribute("data-status", "streaming");
  });

  it("reasoning opens while streaming, summarises the duration, and toggles", () => {
    const { rerender } = render(<Reasoning text="thinking" streaming />);
    expect(screen.getByRole("button", { name: /Thinking/ })).toHaveAttribute("aria-expanded", "true");
    rerender(<Reasoning text="thought" duration={3.2} />);
    const summary = screen.getByRole("button", { name: /Thought for 3s/ });
    expect(summary).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(summary);
    expect(screen.getByText("thought")).toBeInTheDocument();
  });

  it("tool calls show the state and fold input and output", () => {
    render(<ToolCall name="getWeather" state="output-available" input={{ city: "Berlin" }} output={{ temp: 21 }} defaultOpen />);
    expect(screen.getByText("getWeather")).toBeInTheDocument();
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getByText(/"city": "Berlin"/)).toBeInTheDocument();
    expect(screen.getByText(/"temp": 21/)).toBeInTheDocument();
    const { container } = render(<ToolCall name="x" state="output-error" errorText="boom" defaultOpen />);
    expect(container.querySelector(".z-toolcall")).toHaveAttribute("data-state", "output-error");
    expect(screen.getByRole("alert")).toHaveTextContent("boom");
  });

  it("sources count, unfold, and show hosts; nothing renders for none", () => {
    const { container } = render(<Sources sources={[]} />);
    expect(container.firstChild).toBeNull();
    render(<Sources sources={[{ url: "https://www.w3.org/community/design-tokens/", title: "DTCG" }, { url: "https://example.com/a" }]} />);
    fireEvent.click(screen.getByRole("button", { name: "2 sources" }));
    expect(screen.getByRole("link", { name: /DTCG.*w3\.org/ })).toHaveAttribute("href", "https://www.w3.org/community/design-tokens/");
    expect(screen.getByRole("link", { name: /example\.com\/a.*example\.com/ })).toBeInTheDocument();
  });

  it("suggestions send their text, and the loader announces itself", () => {
    const onSelect = vi.fn();
    render(<Suggestions items={["One", "Two"]} onSelect={onSelect} layout="scroll" />);
    fireEvent.click(screen.getByRole("button", { name: "Two" }));
    expect(onSelect).toHaveBeenCalledWith("Two");
    expect(screen.getByRole("group", { name: "Suggestions" })).toHaveAttribute("data-layout", "scroll");
    render(<Loader label="Working" size="sm" />);
    expect(screen.getByRole("status", { name: "Working" })).toHaveAttribute("data-size", "sm");
  });
});

describe("EmptyState", () => {
  it("draws the title, and the description and action only when given", () => {
    const { rerender } = render(<EmptyState title="No customers yet" />);
    expect(screen.getByText("No customers yet")).toBeTruthy();
    expect(document.querySelector(".z-empty__description")).toBeNull();
    expect(document.querySelector(".z-empty__action")).toBeNull();
    rerender(<EmptyState title="No customers yet" description="They appear here." action={<Button>Invite</Button>} />);
    expect(screen.getByText("They appear here.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Invite" })).toBeTruthy();
  });

  it("carries size and tone as data attributes, and hides the icon from assistive tech", () => {
    render(<EmptyState title="Could not load" tone="danger" size="sm" icon={<span>!</span>} />);
    const el = document.querySelector(".z-empty")!;
    expect(el).toHaveAttribute("data-tone", "danger");
    expect(el).toHaveAttribute("data-size", "sm");
    expect(document.querySelector(".z-empty__icon")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("Kbd", () => {
  it("renders one kbd element per key, in order", () => {
    render(<Kbd keys={["Ctrl", "K"]} />);
    const keys = [...document.querySelectorAll(".z-kbd__key")].map((k) => k.textContent);
    expect(keys).toEqual(["Ctrl", "K"]);
  });
});

describe("DataTable", () => {
  interface Row {
    id: string;
    name: string;
    seats: number;
  }
  const rows: Row[] = [
    { id: "a", name: "Northwind", seats: 240 },
    { id: "b", name: "Acme", seats: 18 },
    { id: "c", name: "Kestrel", seats: 1180 },
  ];
  const columns = [
    { id: "name", header: "Customer", cell: (r: Row) => r.name, sortable: true },
    // Formatted for reading, sorted on the number underneath.
    { id: "seats", header: "Seats", cell: (r: Row) => r.seats.toLocaleString(), value: (r: Row) => r.seats, sortable: true },
  ];
  const seatsColumn = () => [...document.querySelectorAll("tbody tr td:nth-child(2)")].map((c) => c.textContent);

  it("sorts on the column's value, not on the text in the cell", () => {
    render(<DataTable label="Customers" columns={columns} rows={rows} rowKey={(r) => r.id} />);
    fireEvent.click(screen.getByRole("button", { name: /Seats/ }));
    // A string sort would put "1,180" second, between "18" and "240".
    expect(seatsColumn()).toEqual(["18", "240", "1,180"]);
  });

  it("cycles ascending, descending, then back to the original order", () => {
    render(<DataTable label="Customers" columns={columns} rows={rows} rowKey={(r) => r.id} />);
    const header = screen.getByRole("button", { name: /Seats/ });
    fireEvent.click(header);
    expect(seatsColumn()).toEqual(["18", "240", "1,180"]);
    fireEvent.click(header);
    expect(seatsColumn()).toEqual(["1,180", "240", "18"]);
    fireEvent.click(header);
    expect(seatsColumn()).toEqual(["240", "18", "1,180"]);
  });

  it("announces the sort direction on the header cell", () => {
    render(<DataTable label="Customers" columns={columns} rows={rows} rowKey={(r) => r.id} />);
    fireEvent.click(screen.getByRole("button", { name: /Customer/ }));
    const cells = [...document.querySelectorAll("thead th")];
    expect(cells[0]).toHaveAttribute("aria-sort", "ascending");
    expect(cells[1]).not.toHaveAttribute("aria-sort");
  });

  it("searches across every column that can produce a value", () => {
    render(<DataTable label="Customers" columns={columns} rows={rows} rowKey={(r) => r.id} searchable />);
    fireEvent.change(screen.getByLabelText("Search Customers"), { target: { value: "acme" } });
    expect(document.querySelectorAll("tbody tr")).toHaveLength(1);
    expect(screen.getByText("Acme")).toBeTruthy();
  });

  it("tells the difference between no rows and no matches", () => {
    const { rerender } = render(<DataTable label="Customers" columns={columns} rows={[]} searchable />);
    expect(screen.getByText("Nothing here yet")).toBeTruthy();
    rerender(<DataTable label="Customers" columns={columns} rows={rows} rowKey={(r) => r.id} searchable />);
    fireEvent.change(screen.getByLabelText("Search Customers"), { target: { value: "zzz" } });
    expect(screen.getByText(/Nothing matches/)).toBeTruthy();
  });

  it("pages, and only shows the pager when there is more than one page", () => {
    const { rerender } = render(<DataTable label="Customers" columns={columns} rows={rows} rowKey={(r) => r.id} pageSize={2} />);
    expect(document.querySelectorAll("tbody tr")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    expect(document.querySelectorAll("tbody tr")).toHaveLength(1);
    rerender(<DataTable label="Customers" columns={columns} rows={rows} rowKey={(r) => r.id} pageSize={10} />);
    expect(screen.queryByRole("button", { name: /Next/ })).toBeNull();
  });

  it("sorts missing values last whichever way the column points", () => {
    const sparse = [{ id: "a", name: "A", seats: 5 }, { id: "b", name: "B", seats: undefined as unknown as number }];
    // A column whose cell copes with a missing value, which is the realistic case.
    const sparseColumns = [
      { id: "name", header: "Customer", cell: (r: Row) => r.name, sortable: true },
      { id: "seats", header: "Seats", cell: (r: Row) => r.seats?.toLocaleString() ?? "—", value: (r: Row) => r.seats, sortable: true },
    ];
    render(<DataTable label="Customers" columns={sparseColumns} rows={sparse} rowKey={(r) => r.id} />);
    const header = screen.getByRole("button", { name: /Seats/ });
    fireEvent.click(header);
    expect([...document.querySelectorAll("tbody tr td:first-child")].map((c) => c.textContent)).toEqual(["A", "B"]);
    fireEvent.click(header);
    expect([...document.querySelectorAll("tbody tr td:first-child")].map((c) => c.textContent)).toEqual(["A", "B"]);
  });
});

describe("StatTile", () => {
  it("colours a fall by what the metric means, not by the sign", () => {
    // The same -6.2%: bad for revenue, good for churn. Nothing but higherIsBetter separates them.
    const { rerender } = render(<StatTile label="Revenue" value="£41,880" delta={-6.2} />);
    expect(document.querySelector(".z-stat")).toHaveAttribute("data-tone", "danger");
    rerender(<StatTile label="Churn" value="1.8%" delta={-6.2} higherIsBetter={false} />);
    expect(document.querySelector(".z-stat")).toHaveAttribute("data-tone", "success");
  });

  it("says nothing about direction when there is nothing to compare to", () => {
    render(<StatTile label="Seats" value="1,180" />);
    expect(document.querySelector(".z-stat")).toHaveAttribute("data-tone", "neutral");
    expect(document.querySelector(".z-stat__delta")).toBeNull();
  });

  it("signs the change and draws the trend only when there is a shape to draw", () => {
    const { rerender } = render(<StatTile label="Revenue" value="£48,210" delta={12.4} series={[1, 2, 3]} seriesLabel="Revenue, last 30 days" />);
    expect(screen.getByText("+12.4%")).toBeTruthy();
    expect(document.querySelector(".z-stat__spark")).not.toBeNull();
    rerender(<StatTile label="Revenue" value="£48,210" delta={12.4} series={[1]} />);
    expect(document.querySelector(".z-stat__spark")).toBeNull();
  });
});

describe("Kanban", () => {
  interface Ticket {
    id: string;
    title: string;
    column: string;
  }
  const columns = [
    { id: "todo", title: "To do" },
    { id: "doing", title: "Doing" },
    { id: "done", title: "Done" },
  ];
  const cards: Ticket[] = [
    { id: "t1", title: "Parser", column: "todo" },
    { id: "t2", title: "Tokens", column: "todo" },
    { id: "t3", title: "Audit", column: "doing" },
  ];
  const board = (onMove?: (m: { cardId: string; from: string; to: string; index: number }) => void) => (
    <Kanban
      label="Board"
      columns={columns}
      cards={cards}
      cardId={(t: Ticket) => t.id}
      cardColumn={(t: Ticket) => t.column}
      cardLabel={(t: Ticket) => t.title}
      renderCard={(t: Ticket) => t.title}
      {...(onMove ? { onMove } : {})}
    />
  );

  it("leaves a control inside a card to handle its own keys", () => {
    // renderCard is the extension point and a per-card menu is the common thing to put in it. Space on that
    // button used to open the menu and lift the card from one keypress, and Escape afterwards was ambiguous.
    render(
      <Kanban
        label="Board"
        columns={columns}
        cards={cards}
        cardId={(t: Ticket) => t.id}
        cardColumn={(t: Ticket) => t.column}
        cardLabel={(t: Ticket) => t.title}
        renderCard={(t: Ticket) => (
          <div>
            {t.title}
            <button type="button">Move {t.title}</button>
          </div>
        )}
      />,
    );

    const inner = screen.getByRole("button", { name: "Move Parser" });
    inner.focus();
    fireEvent.keyDown(inner, { key: " ", bubbles: true });
    expect(screen.getByRole("status").textContent).toBe("");

    // The card still handles the keys that are its own.
    const card = screen.getByRole("article", { name: "Parser" });
    card.focus();
    fireEvent.keyDown(card, { key: " " });
    expect(screen.getByRole("status").textContent).toContain("Parser lifted");
  });

  it("moves a card to the next column with the keyboard alone", () => {
    const onMove = vi.fn();
    render(board(onMove));
    const card = screen.getByRole("article", { name: "Parser" });
    card.focus();
    fireEvent.keyDown(card, { key: " " });
    fireEvent.keyDown(card, { key: "ArrowRight" });
    fireEvent.keyDown(card, { key: "Enter" });
    expect(onMove).toHaveBeenCalledWith({ cardId: "t1", from: "todo", to: "doing", index: 0 });
  });

  it("announces the lift and the landing, because the move cannot be seen", () => {
    render(board());
    const card = screen.getByRole("article", { name: "Parser" });
    card.focus();
    fireEvent.keyDown(card, { key: " " });
    expect(screen.getByRole("status").textContent).toContain("Parser lifted");
    fireEvent.keyDown(card, { key: "ArrowRight" });
    expect(screen.getByRole("status").textContent).toContain("Doing");
  });

  it("Escape puts the card back and reports nothing", () => {
    const onMove = vi.fn();
    render(board(onMove));
    const card = screen.getByRole("article", { name: "Parser" });
    card.focus();
    fireEvent.keyDown(card, { key: " " });
    fireEvent.keyDown(card, { key: "ArrowRight" });
    fireEvent.keyDown(card, { key: "Escape" });
    expect(onMove).not.toHaveBeenCalled();
    expect(screen.getByRole("status").textContent).toContain("put back");
  });

  it("does not report a move that changes nothing", () => {
    const onMove = vi.fn();
    render(board(onMove));
    const card = screen.getByRole("article", { name: "Parser" });
    card.focus();
    fireEvent.keyDown(card, { key: " " });
    fireEvent.keyDown(card, { key: "Enter" });
    expect(onMove).not.toHaveBeenCalled();
  });

  it("will not walk a card off the end of the board", () => {
    const onMove = vi.fn();
    render(board(onMove));
    const card = screen.getByRole("article", { name: "Parser" });
    card.focus();
    fireEvent.keyDown(card, { key: " " });
    fireEvent.keyDown(card, { key: "ArrowLeft" });
    fireEvent.keyDown(card, { key: "Enter" });
    expect(onMove).not.toHaveBeenCalled();
  });

  it("marks a column over its limit", () => {
    render(
      <Kanban
        label="Board"
        columns={[{ id: "doing", title: "Doing", limit: 1 }]}
        cards={cards.map((c) => ({ ...c, column: "doing" }))}
        cardId={(t: Ticket) => t.id}
        cardColumn={() => "doing"}
        cardLabel={(t: Ticket) => t.title}
        renderCard={(t: Ticket) => t.title}
      />,
    );
    expect(screen.getByText("3/1")).toBeTruthy();
  });
});

describe("Combobox", () => {
  it("gives options ids that are valid IDREFs, whatever the values are", () => {
    // A value with a space is ordinary — a company name, a person's name. It used to produce an id with a
    // space in it, so `aria-activedescendant` stopped resolving and a screen reader read nothing, while the
    // highlight kept moving because it is drawn from an index. Nothing looked wrong.
    const options = [
      { value: "Assembly AI", label: "Assembly AI" },
      { value: "north wind", label: "Northwind" },
    ];
    render(<Combobox label="Company" options={options} />);
    const input = screen.getByRole("combobox");
    input.focus();
    fireEvent.keyDown(input, { key: "ArrowDown" });

    const active = input.getAttribute("aria-activedescendant")!;
    expect(active).toBeTruthy();
    expect(active).not.toMatch(/\s/);
    // The strict path, not the lenient getElementById that hid this: one IDREF, one element.
    expect(document.querySelectorAll(`#${CSS.escape(active)}`)).toHaveLength(1);
    expect(document.getElementById(active)).toHaveAttribute("data-value", "Assembly AI");
  });

  const options = [
    { value: "mina", label: "Mina Okafor", hint: "mina@x.dev" },
    { value: "rafa", label: "Rafa Silva", hint: "rafa@x.dev" },
    { value: "arun", label: "Arun Patel", disabled: true },
  ];

  it("keeps focus in the input and points at the active option instead", () => {
    render(<Combobox label="Assignee" options={options} />);
    const input = screen.getByRole("combobox");
    // A real focus, not just the event: the point of the test is where focus ends up.
    input.focus();
    fireEvent.keyDown(input, { key: "ArrowDown" });
    // The WAI-ARIA pattern: focus never enters the list, so the input says which option is current.
    expect(document.activeElement).toBe(input);
    expect(input).toHaveAttribute("aria-activedescendant");
    expect(input).toHaveAttribute("aria-expanded", "true");
  });

  it("filters on the label and on the hint", () => {
    render(<Combobox label="Assignee" options={options} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "rafa@" } });
    expect(screen.getAllByRole("option")).toHaveLength(1);
    expect(screen.getByRole("option", { name: /Rafa/ })).toBeTruthy();
  });

  it("says so when nothing matches, rather than showing an empty box", () => {
    render(<Combobox label="Assignee" options={options} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "zzz" } });
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("No matches")).toBeTruthy();
  });

  it("steps over a disabled option rather than stopping on it", () => {
    render(<Combobox label="Assignee" options={options} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowDown" }); // Rafa
    fireEvent.keyDown(input, { key: "ArrowDown" }); // skips Arun, wraps to Mina
    // Read the value off the element, not out of the id: ids are positions now, which is the fix for #8.
    const active = document.getElementById(input.getAttribute("aria-activedescendant")!);
    expect(active).toHaveAttribute("data-value", "mina");
  });

  it("reports the chosen value and closes", () => {
    const onValueChange = vi.fn();
    render(<Combobox label="Assignee" options={options} onValueChange={onValueChange} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onValueChange).toHaveBeenCalledWith("mina");
    expect(input).toHaveAttribute("aria-expanded", "false");
  });

  it("adds and removes in multiple mode, and stays open", () => {
    const onValueChange = vi.fn();
    render(<Combobox multiple label="Reviewers" options={options} value={["mina"]} onValueChange={onValueChange} />);
    const input = screen.getByRole("combobox");
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onValueChange).toHaveBeenCalledWith(["mina", "rafa"]);
    // Backspace on an empty field takes the last chip, as every tag input does.
    fireEvent.keyDown(input, { key: "Backspace" });
    expect(onValueChange).toHaveBeenLastCalledWith([]);
  });

  it("ties the error to the input for anyone not looking at it", () => {
    render(<Combobox label="Assignee" options={options} error="Pick someone." />);
    const input = screen.getByRole("combobox");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input.getAttribute("aria-describedby")).toBeTruthy();
    expect(screen.getByText("Pick someone.")).toBeTruthy();
  });
});
