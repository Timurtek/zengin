import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cx } from "../../internal/cx.js";
import { Avatar } from "../avatar/avatar.js";

export type MessageRole = "user" | "assistant" | "system";

export interface MessageProps extends HTMLAttributes<HTMLDivElement> {
  role: MessageRole;
  /** Who wrote it, for the avatar initials and assistive tech. */
  name?: string;
  /** A picture for the avatar; initials from `name` otherwise. */
  avatarSrc?: string;
  /** Replace the avatar entirely, e.g. with a product mark. */
  avatar?: ReactNode;
  /** Hide the avatar column. */
  showAvatar?: boolean;
}

/**
 * One turn of a conversation. Users get a bubble on the right; the assistant gets plain text on the left
 * with room for reasoning, tool calls and sources between its parts. Parts: Content, Actions.
 */
const Root = forwardRef<HTMLDivElement, MessageProps>(function Message({ role, name, avatarSrc, avatar, showAvatar = true, className, children, ...rest }, ref) {
  const label = name ?? (role === "user" ? "You" : role === "assistant" ? "Assistant" : "System");
  return (
    <div ref={ref} className={cx("z-message", className)} data-role={role} role="article" aria-label={label} {...rest}>
      {showAvatar && role !== "system" && <div className="z-message__avatar">{avatar ?? <Avatar name={label} size="sm" src={avatarSrc} />}</div>}
      <div className="z-message__main">{children}</div>
    </div>
  );
});

/** The body: text, or a sequence of parts. */
const Content = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function MessageContent({ className, ...rest }, ref) {
  return <div ref={ref} className={cx("z-message__content", className)} {...rest} />;
});

/** Buttons under an assistant message: copy, regenerate, rate. Shown on hover and focus. */
const Actions = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function MessageActions({ className, ...rest }, ref) {
  return <div ref={ref} className={cx("z-message__actions", className)} {...rest} />;
});

export const Message = Object.assign(Root, { Content, Actions });
