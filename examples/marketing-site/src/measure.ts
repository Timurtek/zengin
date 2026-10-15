import type { PostHog, PostHogConfig } from "posthog-js";

/**
 * The site's product analytics, sent to the org's PostHog project. docs/analytics.md lists every event and
 * what it proves. Three rules hold here, tested in test/measure.test.ts and, in the built pages, by
 * scripts/check-measure.mjs:
 * - no key, no analytics: without VITE_POSTHOG_KEY (dev, CI, a preview build) PostHog is never even loaded;
 * - Do Not Track and Global Privacy Control are honoured before anything loads;
 * - every event carries `app: "ZenginUI"`, so one project can hold every product.
 * Nothing personal is sent: no autocapture, no recordings, no identify, and memory persistence (no cookie, no
 * localStorage), since the site has no consent screen to ask with.
 * The file is not called analytics.ts on purpose: the bundler names the chunk both pages share after it, and
 * blockers drop any script called analytics-*.js, which would take the whole page down with it.
 */

export const APP = "ZenginUI";
export const DEFAULT_HOST = "https://us.i.posthog.com";

export type AnalyticsEvent = "$pageview" | "install_command_copied" | "code_copied";
export type EventProperties = Record<string, string>;

type Client = Pick<PostHog, "init" | "capture">;

export interface AnalyticsOptions {
  key: string | undefined;
  host?: string;
  /** The visitor asked not to be tracked (Do Not Track or Global Privacy Control). */
  optedOut: boolean;
  load: () => Promise<Client>;
}

export interface Analytics {
  track(event: AnalyticsEvent, properties?: EventProperties): void;
}

export function config(host: string): Partial<PostHogConfig> {
  return {
    api_host: host,
    // Pageviews are sent by start(), once per page, so they go through the same path as every other event.
    capture_pageview: false,
    capture_pageleave: false,
    autocapture: false,
    capture_dead_clicks: false,
    capture_heatmaps: false,
    capture_exceptions: false,
    capture_performance: false,
    disable_session_recording: true,
    disable_surveys: true,
    disable_product_tours: true,
    disable_conversations: true,
    disable_web_experiments: true,
    // No feature flags and no scripts fetched from PostHog's CDN: the site sends events and nothing else.
    advanced_disable_flags: true,
    disable_external_dependency_loading: true,
    persistence: "memory",
    person_profiles: "never",
    respect_dnt: true,
    // The one place `app` is set, so it is on every event, PostHog's own included.
    before_send: (event) => (event ? { ...event, properties: { ...event.properties, app: APP } } : event),
  };
}

/** Events tracked before PostHog has loaded are held and sent in order once it has. */
export function createAnalytics({ key, host = DEFAULT_HOST, optedOut, load }: AnalyticsOptions): Analytics {
  if (!key || optedOut) return { track: () => {} };
  const queue: Array<[AnalyticsEvent, EventProperties]> = [];
  let client: Client | undefined;
  load()
    .then((posthog) => {
      posthog.init(key, config(host));
      client = posthog;
      for (const [event, properties] of queue.splice(0)) posthog.capture(event, properties);
    })
    .catch((error: unknown) => {
      // Analytics never breaks the page; a blocked script is the visitor's choice too.
      console.warn("Analytics did not load:", error);
    });
  return {
    track(event, properties = {}) {
      if (client) client.capture(event, properties);
      else queue.push([event, properties]);
    },
  };
}

export function prefersNoTracking(nav: Navigator & { globalPrivacyControl?: boolean }, win: { doNotTrack?: string | null }): boolean {
  return nav.doNotTrack === "1" || win.doNotTrack === "1" || nav.globalPrivacyControl === true;
}

/** What a copy button press means: the create command is the site's main action, anything else is reading. */
export function describeCopy(code: string): [AnalyticsEvent, EventProperties] {
  const create = /npm create zengin@latest\b(.*)/.exec(code);
  if (!create) return ["code_copied", {}];
  const options = create[1] ?? "";
  const template = /--template\s+(\S+)/.exec(options)?.[1];
  const theme = /--theme\s+(\S+)/.exec(options)?.[1];
  return ["install_command_copied", { template: template ?? "default", ...(theme ? { theme } : {}) }];
}

/**
 * Called once by each page's entry point: sends that page's pageview and measures every CodeBlock copy button.
 * The copy listener sits on the document rather than in the components, because src/ is also the `marketing`
 * template and must ship without any of this (packages/registry/src/build.ts strips this file and its call).
 */
export function startMeasuring(): void {
  const analytics = createAnalytics({
    key: import.meta.env.VITE_POSTHOG_KEY,
    host: import.meta.env.VITE_POSTHOG_HOST || DEFAULT_HOST,
    optedOut: prefersNoTracking(navigator, window as { doNotTrack?: string | null }),
    load: () => import("posthog-js").then((module) => module.default),
  });
  analytics.track("$pageview");
  document.addEventListener(
    "click",
    (event) => {
      const button = (event.target as Element | null)?.closest?.(".z-codeblock__copy");
      const code = button?.closest(".z-codeblock")?.querySelector("pre code")?.textContent;
      if (!button || !code) return;
      const [name, properties] = describeCopy(code);
      analytics.track(name, { ...properties, section: button.closest("section[id]")?.id ?? "none" });
    },
    { capture: true },
  );
}
