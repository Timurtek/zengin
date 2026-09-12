import { forwardRef, useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode, type TextareaHTMLAttributes } from "react";
import { cx } from "../../internal/cx.js";
import { Button } from "../button/button.js";

export type PromptStatus = "ready" | "submitted" | "streaming" | "error";

export interface PromptInputProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "onSubmit" | "value" | "defaultValue" | "onChange"> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Called with the trimmed text on Enter or the send button. Clears the field when uncontrolled. */
  onSubmit: (text: string) => void;
  /** `submitted` and `streaming` swap the send button for a stop button; `error` keeps the text. */
  status?: PromptStatus;
  onStop?: () => void;
  /** Lines the field grows to before it scrolls. Default 8. */
  maxRows?: number;
  /** Controls at the left of the send button: attach, model picker, tools. */
  toolbar?: ReactNode;
  /** Text for assistive tech on the send button. */
  sendLabel?: string;
}

/**
 * Where the user types: a field that grows with the text, Enter to send and Shift+Enter for a new line,
 * a send button that becomes stop while the answer streams, and a slot for tools beside it.
 */
export const PromptInput = forwardRef<HTMLTextAreaElement, PromptInputProps>(function PromptInput(
  { value, defaultValue = "", onValueChange, onSubmit, status = "ready", onStop, maxRows = 8, toolbar, sendLabel = "Send", className, placeholder = "Message", disabled, onKeyDown, rows = 1, ...rest },
  ref,
) {
  const [inner, setInner] = useState(defaultValue);
  const text = value ?? inner;
  const areaRef = useRef<HTMLTextAreaElement | null>(null);
  const busy = status === "submitted" || status === "streaming";
  const canSend = text.trim().length > 0 && !busy && !disabled;

  const setText = (next: string): void => {
    if (value === undefined) setInner(next);
    onValueChange?.(next);
  };

  // Grow to the content, up to maxRows, then scroll.
  useEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const line = parseFloat(getComputedStyle(el).lineHeight) || 20;
    const padding = el.offsetHeight - el.clientHeight;
    el.style.height = `${Math.min(el.scrollHeight, line * maxRows + padding)}px`;
  }, [text, maxRows]);

  const submit = useCallback(
    (e?: FormEvent) => {
      e?.preventDefault();
      if (!canSend) return;
      onSubmit(text.trim());
      if (value === undefined) setInner("");
    },
    [canSend, onSubmit, text, value],
  );

  const keyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <form className={cx("z-prompt", className)} data-status={status} onSubmit={submit}>
      <textarea
        ref={(el) => {
          areaRef.current = el;
          if (typeof ref === "function") ref(el);
          else if (ref) ref.current = el;
        }}
        className="z-prompt__field z-focusable"
        rows={rows}
        value={text}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={rest["aria-label"] ?? "Message"}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={keyDown}
        {...rest}
      />
      <div className="z-prompt__bar">
        <div className="z-prompt__toolbar">{toolbar}</div>
        {busy ? (
          <Button type="button" size="sm" variant="soft" onClick={onStop} aria-label="Stop generating">
            Stop
          </Button>
        ) : (
          <Button type="submit" size="sm" tone="primary" disabled={!canSend} aria-label={sendLabel}>
            {sendLabel}
          </Button>
        )}
      </div>
    </form>
  );
});
