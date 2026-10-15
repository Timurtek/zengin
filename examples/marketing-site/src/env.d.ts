interface ImportMetaEnv {
  /** The PostHog project API key (phc_…). Set in Vercel; unset means no analytics. */
  readonly VITE_POSTHOG_KEY?: string;
  readonly VITE_POSTHOG_HOST?: string;
}
