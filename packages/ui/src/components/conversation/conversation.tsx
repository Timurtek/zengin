import { createContext, forwardRef, useCallback, useContext, useEffect, useRef, useState, type HTMLAttributes, type MutableRefObject } from "react";
import { cx } from "../../internal/cx.js";
import { Button } from "../button/button.js";

interface ConversationContextValue {
  scroller: MutableRefObject<HTMLDivElement | null>;
  atBottom: boolean;
  scrollToBottom: () => void;
}

const Ctx = createContext<ConversationContextValue | null>(null);

export interface ConversationProps extends HTMLAttributes<HTMLDivElement> {}

/**
 * The scrolling column of messages. It follows new content while the reader is at the bottom and stops
 * following the moment they scroll up, so nothing yanks the page while they read. Parts: Content, ScrollButton.
 */
const Root = forwardRef<HTMLDivElement, ConversationProps>(function Conversation({ className, children, ...rest }, ref) {
  const scroller = useRef<HTMLDivElement | null>(null);
  const [atBottom, setAtBottom] = useState(true);
  const scrollToBottom = useCallback(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);
  return (
    <Ctx.Provider value={{ scroller, atBottom, scrollToBottom }}>
      <div ref={ref} className={cx("z-conversation", className)} data-at-bottom={atBottom || undefined} {...rest}>
        <ScrollTracker onChange={setAtBottom} />
        {children}
      </div>
    </Ctx.Provider>
  );
});

/** Watches the scroller for position and for growth, and follows growth only while at the bottom. */
function ScrollTracker({ onChange }: { onChange: (atBottom: boolean) => void }) {
  const ctx = useContext(Ctx)!;
  const atBottomRef = useRef(true);
  useEffect(() => {
    const el = ctx.scroller.current;
    if (!el) return;
    const measure = () => {
      const near = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
      atBottomRef.current = near;
      onChange(near);
    };
    el.addEventListener("scroll", measure, { passive: true });
    measure();
    if (typeof ResizeObserver === "undefined" || typeof MutationObserver === "undefined") return () => el.removeEventListener("scroll", measure);
    const follow = () => {
      if (atBottomRef.current) el.scrollTop = el.scrollHeight;
    };
    const mo = new MutationObserver(follow);
    mo.observe(el, { childList: true, subtree: true, characterData: true });
    const ro = new ResizeObserver(follow);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", measure);
      mo.disconnect();
      ro.disconnect();
    };
  }, [ctx.scroller, onChange]);
  return null;
}

const Content = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function ConversationContent({ className, ...rest }, ref) {
  const ctx = useContext(Ctx);
  return (
    <div
      ref={(el) => {
        if (ctx) ctx.scroller.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) (ref as MutableRefObject<HTMLDivElement | null>).current = el;
      }}
      className={cx("z-conversation__content", className)}
      role="log"
      aria-live="polite"
      {...rest}
    />
  );
});

/** Appears when the reader has scrolled up and new content is below. */
function ScrollButton({ label = "Jump to latest" }: { label?: string }) {
  const ctx = useContext(Ctx);
  if (!ctx || ctx.atBottom) return null;
  return (
    <div className="z-conversation__jump">
      <Button size="sm" variant="soft" onClick={ctx.scrollToBottom}>
        {label}
      </Button>
    </div>
  );
}

export const Conversation = Object.assign(Root, { Content, ScrollButton });
