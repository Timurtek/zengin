import type { CaptureResult } from "posthog-js";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { startErrorReporting } from "../src";

// The real posthog-js, initialised the way the site does it. before_send is the last step before the request,
// so what it receives is the event PostHog would be sent; it records it and returns null so nothing leaves.
const events: CaptureResult[] = [];

beforeAll(async () => {
  const posthog = await startErrorReporting({
    surface: "site",
    key: "phc_test",
    release: "0123abc",
    options: {
      before_send: (event) => {
        if (event) events.push(event);
        return null;
      },
    },
  });
  expect(posthog).not.toBeNull();
});

/** The $exception event whose first exception carries this message, once posthog-js has built it. */
async function exceptionFor(message: string): Promise<CaptureResult> {
  return vi.waitFor(() => {
    const found = events.find((e) => e.event === "$exception" && e.properties["$exception_list"]?.[0]?.value === message);
    if (!found) throw new Error(`no $exception for "${message}" among ${events.length} events`);
    return found;
  });
}

describe("startErrorReporting", () => {
  it("captures an uncaught error, tagged with the release and the surface", async () => {
    window.dispatchEvent(new ErrorEvent("error", { error: new Error("uncaught on the page"), message: "uncaught on the page" }));
    const event = await exceptionFor("uncaught on the page");
    expect(event.properties).toMatchObject({ release: "0123abc", surface: "site" });
  });

  it("captures an unhandled promise rejection", async () => {
    const rejection = Object.assign(new Event("unhandledrejection"), { reason: new Error("a promise nobody caught") });
    window.dispatchEvent(rejection);
    const event = await exceptionFor("a promise nobody caught");
    expect(event.properties).toMatchObject({ release: "0123abc", surface: "site" });
  });

  it("captures an error the code caught and passed to the standard reportError()", async () => {
    // What the catalog does when the registry does not answer: the page recovers, and the error is still read.
    window.reportError(new Error("the registry answered 503"));
    const event = await exceptionFor("the registry answered 503");
    expect(event.properties).toMatchObject({ release: "0123abc", surface: "site" });
  });

  it("sends nothing that identifies the reader", async () => {
    window.dispatchEvent(new ErrorEvent("error", { error: new Error("privacy check"), message: "privacy check" }));
    const event = await exceptionFor("privacy check");
    expect(event.properties["$process_person_profile"]).toBe(false);
    expect(document.cookie).toBe("");
    expect(Object.keys(localStorage).filter((k) => k.includes("ph_"))).toEqual([]);
  });
});
