import { expect, it, vi } from "vitest";
import { startErrorReporting } from "../src/report";

const init = vi.hoisted(() => vi.fn());
vi.mock("posthog-js", () => ({ default: { init } }));

it("is a no-op without a key: posthog-js is never started, no listener is added, nothing is sent", async () => {
  const listen = vi.spyOn(window, "addEventListener");
  expect(await startErrorReporting({ surface: "site", key: "" })).toBeNull();

  expect(init).not.toHaveBeenCalled();
  expect(listen).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
});
