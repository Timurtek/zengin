import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, vi } from "vitest";

afterEach(cleanup);

// Nothing in a test reaches the network: the tests read events in before_send, and a request is a call here.
beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(new Response("{}"))));
});

// Every browser the site supports has reportError(); jsdom does not. The standard's definition: report the
// error to the window's error handlers, as an error event, without throwing.
window.reportError ??= (error: unknown) => {
  window.dispatchEvent(new ErrorEvent("error", { error, message: error instanceof Error ? error.message : String(error) }));
};
