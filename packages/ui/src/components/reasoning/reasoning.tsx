import { forwardRef, useEffect, useState, type HTMLAttributes } from "react";
import { cx } from "../../internal/cx.js";
import { Icon } from "../../internal/icons.js";
import { Markdown } from "../markdown/markdown.js";

export interface ReasoningProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** The reasoning text so far. */
  text: string;
  /** Still arriving. The panel opens itself while streaming and closes when done, unless the reader touched it. */
  streaming?: boolean;
  /** Seconds the model spent, shown in the summary when known. */
  duration?: number;
  defaultOpen?: boolean;
}

/** A model's thinking, folded under a one-line summary. Open while it streams, closed once the answer starts. */
export const Reasoning = forwardRef<HTMLDivElement, ReasoningProps>(function Reasoning({ text, streaming = false, duration, defaultOpen, className, ...rest }, ref) {
  const [open, setOpen] = useState(defaultOpen ?? streaming);
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!touched && defaultOpen === undefined) setOpen(streaming);
  }, [streaming, touched, defaultOpen]);

  const summary = streaming ? "Thinking" : duration !== undefined ? `Thought for ${duration < 1 ? "under a second" : `${Math.round(duration)}s`}` : "Thought";

  return (
    <div ref={ref} className={cx("z-reasoning", className)} data-open={open || undefined} data-streaming={streaming || undefined} {...rest}>
      <button
        type="button"
        className="z-reasoning__summary z-focusable"
        aria-expanded={open}
        onClick={() => {
          setTouched(true);
          setOpen((o) => !o);
        }}
      >
        <span className="z-reasoning__dot" aria-hidden="true" />
        {summary}
        <Icon.ChevronDown className="z-reasoning__chevron" />
      </button>
      {open && (
        <div className="z-reasoning__body">
          <Markdown text={text} streaming={streaming} />
        </div>
      )}
    </div>
  );
});
