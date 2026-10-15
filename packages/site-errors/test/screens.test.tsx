import { render, screen } from "@testing-library/react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { NotFoundScreen, showErrorScreenOnCrash } from "../src";

describe("showErrorScreenOnCrash", () => {
  let el: HTMLElement;

  beforeAll(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    // Rendered the way a browser runs the page, not inside act(), which rethrows a render error to the test
    // instead of letting React report it to the window.
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false;
    showErrorScreenOnCrash({ home: "/docs/", container: "app" });
  });

  afterEach(() => el.remove());

  function mount(): HTMLElement {
    el = document.body.appendChild(Object.assign(document.createElement("div"), { id: "app" }));
    return el;
  }

  it("puts the error screen where a page was when an error takes the page down", async () => {
    function Broken(): never {
      throw new Error("a section failed to render");
    }
    createRoot(mount()).render(<Broken />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("This page stopped working");
    expect(screen.getByRole("button", { name: "Reload the page" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to the start" })).toHaveAttribute("href", "/docs/");
  });

  it("leaves a page that is still standing alone", async () => {
    createRoot(mount()).render(<p>The page</p>);
    await screen.findByText("The page");

    window.reportError(new Error("a failed click handler"));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(screen.getByText("The page")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

it("the not-found page says the address is wrong and links to the home page and the docs", () => {
  render(<NotFoundScreen />);
  expect(screen.getByText("There is no page at this address")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Go to the home page" })).toHaveAttribute("href", "/");
  expect(screen.getByRole("link", { name: "Read the docs" })).toHaveAttribute("href", "/docs/");
});
