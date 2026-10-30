// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Feedback, FeedbackForm, feedbackMessage, PRODUCT, sendFeedback } from "../src/feedback";
import { FEEDBACK_SENT } from "../src/measure";

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

const ENDPOINT = "https://n8n.example.com/webhook/zengin-feedback";

describe("feedbackMessage", () => {
  it("is what ORG Brain's feedback door reads: an id, the product, the text and the page", () => {
    expect(feedbackMessage("  The check is fast.  ", "", "/why/", "id-1")).toEqual({ id: "id-1", product: "ZenginUI", text: "The check is fast.", page: "/why/" });
    expect(PRODUCT).toBe("ZenginUI");
  });

  it("carries an email address only when the person gave one", () => {
    expect(feedbackMessage("Hi", " ada@example.com ", "/", "id-2")).toEqual({ id: "id-2", product: "ZenginUI", text: "Hi", contact: "ada@example.com", page: "/" });
    expect(feedbackMessage("Hi", "   ", "/", "id-3")).not.toHaveProperty("contact");
  });

  it("gives every message its own id", () => {
    expect(feedbackMessage("a", "", "/").id).not.toBe(feedbackMessage("a", "", "/").id);
  });
});

describe("sendFeedback", () => {
  it("posts the message as JSON to the endpoint", async () => {
    const post = vi.fn(async () => new Response(null, { status: 200 }));
    const message = feedbackMessage("Hi", "", "/", "id-4");
    await sendFeedback(ENDPOINT, message, post);
    expect(post).toHaveBeenCalledWith(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(message) });
  });

  it("fails when the endpoint does not accept it", async () => {
    const post = vi.fn(async () => new Response(null, { status: 500 }));
    await expect(sendFeedback(ENDPOINT, feedbackMessage("Hi", "", "/"), post)).rejects.toThrow("Feedback endpoint answered 500");
  });
});

function setup(send = vi.fn(async () => {})) {
  render(<FeedbackForm endpoint={ENDPOINT} send={send} />);
  const text = screen.getByLabelText(/What should we know/) as HTMLTextAreaElement;
  const email = screen.getByLabelText(/Your email, if you'd like a reply/) as HTMLInputElement;
  const button = screen.getByRole("button", { name: "Send feedback" });
  const status = screen.getByRole("status");
  return { send, text, email, button, status, submit: () => act(async () => fireEvent.submit(button.closest("form")!)) };
}

describe("FeedbackForm", () => {
  it("names every control for a screen reader and says what the email is for", () => {
    const { text, email, button, status } = setup();
    expect(screen.getByRole("form", { name: "Tell us what works and what does not" })).toBeTruthy();
    expect(text.required).toBe(true);
    expect(email.required).toBe(false);
    expect(email.type).toBe("email");
    expect(document.getElementById(email.getAttribute("aria-describedby")!)!.textContent).toBe("We use your email only to reply to this message.");
    expect(button.getAttribute("type")).toBe("submit");
    expect(status.getAttribute("aria-live")).toBe("polite");
  });

  it("asks for a few words, and moves focus there, when the message is empty", async () => {
    const { send, text, submit } = setup();
    await submit();
    expect(send).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe("Write a few words first.");
    expect(text.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(text);
  });

  it("asks to fix an email address that does not look right, and moves focus there", async () => {
    const { send, text, email, submit } = setup();
    fireEvent.change(text, { target: { value: "Hi" } });
    fireEvent.change(email, { target: { value: "not an address" } });
    await submit();
    expect(send).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe("That email address does not look right. Fix it, or leave it empty.");
    expect(document.activeElement).toBe(email);
  });

  it("sends the message, clears the form, thanks the person and tells the page it was sent", async () => {
    const sent = vi.fn();
    document.addEventListener(FEEDBACK_SENT, sent);
    const { send, text, email, status, submit } = setup();
    fireEvent.change(text, { target: { value: "The hook caught a hex I missed." } });
    fireEvent.change(email, { target: { value: "ada@example.com" } });
    await submit();
    document.removeEventListener(FEEDBACK_SENT, sent);
    expect(send).toHaveBeenCalledWith(ENDPOINT, expect.objectContaining({ product: "ZenginUI", text: "The hook caught a hex I missed.", contact: "ada@example.com", page: "/" }));
    expect(text.value).toBe("");
    expect(email.value).toBe("");
    expect(status.textContent).toBe("Thank you. We read every message.");
    expect(sent).toHaveBeenCalledTimes(1);
    // The page hears only that a message was sent: the event carries nothing the person wrote.
    expect((sent.mock.calls[0]![0] as Event & { detail?: unknown }).detail).toBeUndefined();
  });

  it("keeps the message and says so when it did not send", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const sent = vi.fn();
    document.addEventListener(FEEDBACK_SENT, sent);
    const { text, status, submit } = setup(vi.fn(async () => Promise.reject(new Error("offline"))));
    fireEvent.change(text, { target: { value: "Hi" } });
    await submit();
    document.removeEventListener(FEEDBACK_SENT, sent);
    expect(status.textContent).toBe("It did not send. Check your connection and try again.");
    expect(text.value).toBe("Hi");
    expect(sent).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith("Feedback did not send:", expect.any(Error));
    warn.mockRestore();
  });
});

describe("Feedback", () => {
  it("shows no form when the build has nowhere to send it", () => {
    vi.stubEnv("VITE_FEEDBACK_ENDPOINT", "");
    const { container } = render(<Feedback />);
    expect(container.innerHTML).toBe("");
  });

  it("shows the form when VITE_FEEDBACK_ENDPOINT is set", () => {
    vi.stubEnv("VITE_FEEDBACK_ENDPOINT", ENDPOINT);
    render(<Feedback />);
    expect(screen.getByRole("button", { name: "Send feedback" })).toBeTruthy();
  });
});
