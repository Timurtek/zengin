import { forwardRef, type HTMLAttributes } from "react";
import { cx } from "../../internal/cx.js";

export type KbdSize = "sm" | "md";

export interface KbdProps extends HTMLAttributes<HTMLElement> {
  /** The keys, in press order: `["Ctrl", "K"]`. Rendered with a separator between them. */
  keys: string[];
  size?: KbdSize;
}

/**
 * A key or a chord, as the keyboard shows it. Small, and always the same shape, which is the point: a
 * shortcut written as plain text in one place and a styled span in another is how a product ends up with
 * three different-looking `Ctrl` in one screen.
 */
export const Kbd = forwardRef<HTMLElement, KbdProps>(function Kbd({ keys, size = "md", className, ...rest }, ref) {
  return (
    <span ref={ref} className={cx("z-kbd", className)} data-size={size} {...rest}>
      {keys.map((key, i) => (
        <kbd key={`${key}-${i}`} className="z-kbd__key">
          {key}
        </kbd>
      ))}
    </span>
  );
});
