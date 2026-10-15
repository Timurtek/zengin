import type { PostHog, PostHogConfig } from "posthog-js";

export interface ReportingOptions {
  /** Which page set the error came from, so the site and the docs can be told apart: "site", "docs". */
  surface: string;
  /** The PostHog project key. Without one, reporting is off: posthog-js is never loaded and nothing is sent. */
  key?: string;
  /** PostHog's ingestion host, for a project outside the US cloud. */
  host?: string;
  /** The build the error happened in, set at build time from Vercel's commit sha. */
  release?: string;
  /** Extra posthog-js options. The tests pass a before_send that records the event instead of sending it. */
  options?: Partial<PostHogConfig>;
}

const NAME = "zengin-site-errors";

/**
 * Sends the page's errors to PostHog's error tracking, each tagged with its release and surface. A no-op
 * without VITE_POSTHOG_KEY, so a local build, a fork or a preview without the key sends nothing.
 *
 * It reads the window's own error events: an error nothing caught, a promise nobody handled, and an error
 * the code caught and passed to the standard `reportError()`, which is how caught errors are recorded here
 * without the page's code depending on this package.
 *
 * Errors only, and nothing that identifies the reader: no autocapture, no pageviews, no recordings, no
 * cookie or storage (the id lives for one page load), and Do Not Track is honoured.
 */
export function startErrorReporting({
  surface,
  key = import.meta.env["VITE_POSTHOG_KEY"],
  host = import.meta.env["VITE_POSTHOG_HOST"] || "https://us.i.posthog.com",
  release = import.meta.env["VITE_RELEASE"] || "local",
  options,
}: ReportingOptions): Promise<PostHog | null> {
  if (!key) return Promise.resolve(null);
  const client = import("posthog-js").then(({ default: posthog }) => {
    const instance = posthog.init(
      key,
      {
        api_host: host,
        persistence: "memory",
        person_profiles: "never",
        respect_dnt: true,
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        disable_session_recording: true,
        disable_surveys: true,
        advanced_disable_flags: true,
        disable_external_dependency_loading: true,
        // The listeners below report every error; PostHog's own autocapture would send each one twice.
        capture_exceptions: false,
        ...options,
      },
      NAME,
    );
    instance?.register({ release, surface });
    return instance ?? null;
  });
  const send = (error: unknown) => void client.then((posthog) => posthog?.captureException(error));
  // Attached at once, so an error thrown while posthog-js is still loading is sent when it arrives.
  window.addEventListener("error", (event) => send(event.error ?? new Error(event.message)));
  window.addEventListener("unhandledrejection", (event) => send(event.reason));
  return client;
}
