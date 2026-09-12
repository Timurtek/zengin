import { forwardRef, type HTMLAttributes } from "react";
import { cx } from "../../internal/cx.js";
import { Button } from "../button/button.js";

export interface SuggestionsProps extends Omit<HTMLAttributes<HTMLDivElement>, "children" | "onSelect"> {
  /** Prompts the user can send with one click. */
  items: string[];
  onSelect: (text: string) => void;
  /** `wrap` for a starting screen; `scroll` for a single row above the prompt. */
  layout?: "wrap" | "scroll";
}

/** Prompts to start from, as a row of chips. */
export const Suggestions = forwardRef<HTMLDivElement, SuggestionsProps>(function Suggestions({ items, onSelect, layout = "wrap", className, ...rest }, ref) {
  return (
    <div ref={ref} className={cx("z-suggestions", className)} data-layout={layout} role="group" aria-label="Suggestions" {...rest}>
      {items.map((text) => (
        <Button key={text} variant="soft" size="sm" onClick={() => onSelect(text)}>
          {text}
        </Button>
      ))}
    </div>
  );
});
