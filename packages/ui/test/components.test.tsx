import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Badge, Button, Card, Checkbox, Dialog, TextField, Tooltip } from "../src/index.js";

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
