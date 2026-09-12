import { forwardRef, useState, type HTMLAttributes } from "react";
import { cx } from "../../internal/cx.js";

export interface Source {
  url: string;
  title?: string;
}

export interface SourcesProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  sources: Source[];
  defaultOpen?: boolean;
}

/** Where an answer came from: a count that unfolds into links, each showing its host. */
export const Sources = forwardRef<HTMLDivElement, SourcesProps>(function Sources({ sources, defaultOpen = false, className, ...rest }, ref) {
  const [open, setOpen] = useState(defaultOpen);
  if (sources.length === 0) return null;
  return (
    <div ref={ref} className={cx("z-sources", className)} data-open={open || undefined} {...rest}>
      <button type="button" className="z-sources__summary z-focusable" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {sources.length} source{sources.length === 1 ? "" : "s"}
        <svg className="z-sources__chevron" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <ol className="z-sources__list">
          {sources.map((s, i) => (
            <li key={`${s.url}-${i}`}>
              <a className="z-sources__link z-focusable" href={s.url} target="_blank" rel="noreferrer">
                <span className="z-sources__title">{s.title ?? s.url}</span>
                <span className="z-sources__host">{host(s.url)}</span>
              </a>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
});

function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
