interface ImportMetaEnv {
  /** The PostHog project API key (phc_…). Set in Vercel; unset means no analytics. */
  readonly VITE_POSTHOG_KEY?: string;
  readonly VITE_POSTHOG_HOST?: string;
  /** The n8n webhook the footer's feedback form posts to ("zengin-feedback"). Unset means no form. */
  readonly VITE_FEEDBACK_ENDPOINT?: string;
}
