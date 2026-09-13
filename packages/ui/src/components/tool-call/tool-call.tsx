import { forwardRef, useState, type HTMLAttributes } from "react";
import { cx } from "../../internal/cx.js";
import { Icon } from "../../internal/icons.js";
import { Badge } from "../badge/badge.js";
import { CodeBlock } from "../code-block/code-block.js";

/** The states a tool part moves through in the AI SDK, plus approval. */
export type ToolCallState = "input-streaming" | "input-available" | "approval-requested" | "approval-responded" | "output-available" | "output-error" | "output-denied";

export interface ToolCallProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** The tool's name, e.g. `getWeather`. */
  name: string;
  state: ToolCallState;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  defaultOpen?: boolean;
}

const LABEL: Record<ToolCallState, string> = {
  "input-streaming": "Preparing",
  "input-available": "Running",
  "approval-requested": "Needs approval",
  "approval-responded": "Approved",
  "output-available": "Done",
  "output-error": "Failed",
  "output-denied": "Denied",
};

const TONE: Record<ToolCallState, "neutral" | "primary" | "warning" | "success" | "danger"> = {
  "input-streaming": "neutral",
  "input-available": "primary",
  "approval-requested": "warning",
  "approval-responded": "primary",
  "output-available": "success",
  "output-error": "danger",
  "output-denied": "neutral",
};

/** A tool the model called: its name, where it is, and the input and output folded underneath. */
export const ToolCall = forwardRef<HTMLDivElement, ToolCallProps>(function ToolCall({ name, state, input, output, errorText, defaultOpen = false, className, ...rest }, ref) {
  const [open, setOpen] = useState(defaultOpen);
  const busy = state === "input-streaming" || state === "input-available";
  return (
    <div ref={ref} className={cx("z-toolcall", className)} data-state={state} data-open={open || undefined} {...rest}>
      <button type="button" className="z-toolcall__summary z-focusable" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="z-toolcall__icon" data-busy={busy || undefined} aria-hidden="true" />
        <code className="z-toolcall__name">{name}</code>
        <Badge tone={TONE[state]} size="sm">
          {LABEL[state]}
        </Badge>
        <Icon.ChevronDown className="z-toolcall__chevron" />
      </button>
      {open && (
        <div className="z-toolcall__body">
          {input !== undefined && (
            <div className="z-toolcall__section">
              <span className="z-toolcall__label">Input</span>
              <CodeBlock code={pretty(input)} language="json" showCopy={false} />
            </div>
          )}
          {output !== undefined && (
            <div className="z-toolcall__section">
              <span className="z-toolcall__label">Output</span>
              <CodeBlock code={pretty(output)} language="json" showCopy={false} />
            </div>
          )}
          {errorText && (
            <p className="z-toolcall__error" role="alert">
              {errorText}
            </p>
          )}
        </div>
      )}
    </div>
  );
});

function pretty(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2) ?? String(value);
  } catch {
    return String(value);
  }
}
