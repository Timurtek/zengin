import type { CaptureResult } from "posthog-js";
import { describe, expect, it, vi } from "vitest";
import { APP, config, createAnalytics, DEFAULT_HOST, describeCopy, prefersNoTracking } from "../src/measure";

function fakeClient() {
  return { init: vi.fn(), capture: vi.fn() };
}
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createAnalytics", () => {
  it("never loads PostHog without a key", async () => {
    const load = vi.fn();
    createAnalytics({ key: undefined, optedOut: false, load }).track("$pageview");
    createAnalytics({ key: "", optedOut: false, load }).track("$pageview");
    await flush();
    expect(load).not.toHaveBeenCalled();
  });

  it("never loads PostHog for a visitor who asked not to be tracked", async () => {
    const load = vi.fn();
    createAnalytics({ key: "phc_test", optedOut: true, load }).track("$pageview");
    await flush();
    expect(load).not.toHaveBeenCalled();
  });

  it("initialises with the key, the US host and the app stamp, and sends queued events in order", async () => {
    const client = fakeClient();
    const analytics = createAnalytics({ key: "phc_test", optedOut: false, load: async () => client });
    analytics.track("$pageview");
    analytics.track("install_command_copied", { template: "saas", section: "templates" });
    await flush();
    expect(client.init).toHaveBeenCalledWith("phc_test", expect.objectContaining({ api_host: DEFAULT_HOST, before_send: expect.any(Function) }));
    expect(client.capture.mock.calls).toEqual([
      ["$pageview", {}],
      ["install_command_copied", { template: "saas", section: "templates" }],
    ]);
    analytics.track("code_copied", { section: "surfaces" });
    expect(client.capture).toHaveBeenLastCalledWith("code_copied", { section: "surfaces" });
  });

  it("keeps the page working when PostHog fails to load", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const analytics = createAnalytics({ key: "phc_test", optedOut: false, load: () => Promise.reject(new Error("blocked")) });
    expect(() => analytics.track("$pageview")).not.toThrow();
    await flush();
    expect(warn).toHaveBeenCalledWith("Analytics did not load:", expect.any(Error));
    warn.mockRestore();
  });
});

describe("config", () => {
  const c = config(DEFAULT_HOST);

  it("collects nothing beyond the events the site sends", () => {
    expect(c).toMatchObject({
      autocapture: false,
      capture_pageview: false,
      disable_session_recording: true,
      persistence: "memory",
      person_profiles: "never",
      respect_dnt: true,
      disable_external_dependency_loading: true,
    });
  });

  it("stamps the app on every event PostHog sends, its own included", () => {
    const before = c.before_send as (event: CaptureResult | null) => CaptureResult | null;
    const event = { uuid: "1", event: "$pageview", properties: { $current_url: "https://zengin.timurtek.com/" } } as CaptureResult;
    expect(before(event)!.properties).toEqual({ $current_url: "https://zengin.timurtek.com/", app: APP });
    expect(before(null)).toBeNull();
  });
});

describe("prefersNoTracking", () => {
  it("reads Do Not Track and Global Privacy Control", () => {
    const nav = (n: object) => n as Navigator;
    expect(prefersNoTracking(nav({ doNotTrack: "1" }), {})).toBe(true);
    expect(prefersNoTracking(nav({}), { doNotTrack: "1" })).toBe(true);
    expect(prefersNoTracking(nav({ globalPrivacyControl: true }), {})).toBe(true);
    expect(prefersNoTracking(nav({ doNotTrack: "0" }), {})).toBe(false);
    expect(prefersNoTracking(nav({ doNotTrack: null }), { doNotTrack: null })).toBe(false);
  });
});

describe("describeCopy", () => {
  it("names the create command as the main action, with its template and theme", () => {
    expect(describeCopy("npm create zengin@latest my-app -- --template saas --theme meadow && cd my-app")).toEqual([
      "install_command_copied",
      { template: "saas", theme: "meadow" },
    ]);
    expect(describeCopy("# A new project\nnpm create zengin@latest acme -- --template marketing\ncd acme")).toEqual(["install_command_copied", { template: "marketing" }]);
    expect(describeCopy("npm create zengin@latest acme")).toEqual(["install_command_copied", { template: "default" }]);
  });

  it("names any other snippet as reading, and sends none of its text", () => {
    expect(describeCopy("npx zengin check --changed")).toEqual(["code_copied", {}]);
  });
});
