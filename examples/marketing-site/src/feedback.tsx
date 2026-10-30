import { Button, TextArea, TextField } from "@zenginui/ui";
import { useRef, useState, type FormEvent } from "react";
import "./feedback.css";
import { FEEDBACK_SENT } from "./measure";

/**
 * The footer's feedback form: ORG Brain's feedback snippet (orgbrain docs/feedback-snippet.html) on Zengin UI.
 * It posts to the n8n webhook named by VITE_FEEDBACK_ENDPOINT, which forwards each message to ORG Brain's
 * Feedback page. Without that variable (dev, CI, a preview build) there is no form and nothing is sent.
 * Like measure.ts, this is the site's own plumbing: packages/registry/src/build.ts leaves it, and the Footer's
 * use of it, out of the `marketing` template.
 */

export const PRODUCT = "ZenginUI";

export interface FeedbackMessage {
  /** One id per message, so a retry is never counted twice. */
  id: string;
  product: typeof PRODUCT;
  text: string;
  /** Only when the person chose to give one. */
  contact?: string;
  page: string;
}

export function feedbackMessage(text: string, contact: string, page: string, id: string = crypto.randomUUID()): FeedbackMessage {
  const email = contact.trim();
  return { id, product: PRODUCT, text: text.trim(), ...(email ? { contact: email } : {}), page };
}

export async function sendFeedback(endpoint: string, message: FeedbackMessage, post: typeof fetch = fetch): Promise<void> {
  const response = await post(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(message) });
  if (!response.ok) throw new Error(`Feedback endpoint answered ${response.status}`);
}

type Status = { kind: "idle" | "sending" | "sent" | "failed"; text: string };

export interface FeedbackFormProps {
  endpoint: string;
  send?: (endpoint: string, message: FeedbackMessage) => Promise<void>;
}

export function FeedbackForm({ endpoint, send = sendFeedback }: FeedbackFormProps) {
  const textRef = useRef<HTMLTextAreaElement>(null);
  const contactRef = useRef<HTMLInputElement>(null);
  const [textError, setTextError] = useState<string>();
  const [contactError, setContactError] = useState<string>();
  const [status, setStatus] = useState<Status>({ kind: "idle", text: "" });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const text = textRef.current!.value;
    const contact = contactRef.current!;
    setTextError(undefined);
    setContactError(undefined);
    if (!text.trim()) {
      setTextError("Write a few words first.");
      textRef.current!.focus();
      return;
    }
    if (contact.value.trim() && !contact.checkValidity()) {
      setContactError("That email address does not look right. Fix it, or leave it empty.");
      contact.focus();
      return;
    }
    setStatus({ kind: "sending", text: "Sending…" });
    try {
      await send(endpoint, feedbackMessage(text, contact.value, window.location.pathname));
      form.reset();
      setStatus({ kind: "sent", text: "Thank you. We read every message." });
      document.dispatchEvent(new Event(FEEDBACK_SENT));
    } catch (error) {
      console.warn("Feedback did not send:", error);
      setStatus({ kind: "failed", text: "It did not send. Check your connection and try again." });
    }
  }

  return (
    <form className="wrap feedback" aria-labelledby="feedback-title" noValidate onSubmit={submit}>
      <h2 id="feedback-title" className="feedback__title">
        Tell us what works and what does not
      </h2>
      <TextArea ref={textRef} name="text" label="What should we know? An idea, a problem, anything." rows={4} maxLength={4000} required error={textError} />
      <TextField
        ref={contactRef}
        name="contact"
        type="email"
        autoComplete="email"
        inputMode="email"
        label="Your email, if you'd like a reply (optional)"
        description="We use your email only to reply to this message."
        error={contactError}
      />
      <div className="feedback__actions">
        <Button type="submit" variant="soft" tone="primary" loading={status.kind === "sending"}>
          Send feedback
        </Button>
        <p className="feedback__status" role="status" aria-live="polite">
          {status.text}
        </p>
      </div>
    </form>
  );
}

/** The form, when this build has somewhere to send it. */
export function Feedback() {
  const endpoint = import.meta.env.VITE_FEEDBACK_ENDPOINT;
  return endpoint ? <FeedbackForm endpoint={endpoint} /> : null;
}
