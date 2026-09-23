import { Badge, Button, Icon, Markdown, Sheet, TextField, Tooltip } from "@zenginui/ui";
import { useEffect, useMemo, useState } from "react";
import { DOCS, headingsOf, SECTIONS, type Doc } from "./content";

const SITE = "https://zengin.timurtek.com";
const REPO = "https://github.com/Timurtek/zengin";
const EXTERNAL = { target: "_blank", rel: "noreferrer" } as const;

type Theme = "light" | "dark";

/** The theme lives on <html> so the tokens reach every component. */
function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    const stamped = document.documentElement.dataset.theme;
    if (stamped === "light" || stamped === "dark") return stamped;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  return [theme, () => setTheme((t) => (t === "light" ? "dark" : "light"))];
}

/** `/docs/` in the build, `/` in dev. Every URL this file writes is built from it. */
const BASE = import.meta.env.BASE_URL;

/** The address of a page, which is also the href a crawler follows and a reader copies. */
export function hrefFor(slug: string): string {
  return `${BASE}${slug}/`;
}

function slugFromPath(): string | undefined {
  const rest = window.location.pathname.slice(BASE.length).replace(/^\/+|\/+$/g, "");
  return DOCS.some((d) => d.slug === rest) ? rest : undefined;
}

/**
 * The page is the path.
 *
 * It was the fragment, and a fragment is not a URL to a search engine: twenty-one pages of prose were one
 * indexable page with one title. Now each page has its own address, its own built HTML and its own metadata,
 * and the sidebar entries are real links rather than buttons — which is the half that makes them followable.
 */
function useSlug(): [string, (slug: string) => void] {
  const [slug, setSlug] = useState(() => slugFromPath() ?? DOCS[0]!.slug);

  useEffect(() => {
    // Links shared before this change point at /docs/#rules. Send them where that page lives now.
    const legacy = window.location.hash.slice(1);
    if (legacy && DOCS.some((d) => d.slug === legacy)) {
      window.history.replaceState({}, "", hrefFor(legacy));
      setSlug(legacy);
    }
    const onPop = () => setSlug(slugFromPath() ?? DOCS[0]!.slug);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  return [
    slug,
    (next: string) => {
      window.history.pushState({}, "", hrefFor(next));
      setSlug(next);
      window.scrollTo({ top: 0 });
    },
  ];
}

/** A link that navigates in place, unless the reader asked for a new tab or window. */
function linkTo(e: React.MouseEvent, slug: string, go: (slug: string) => void): void {
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
  e.preventDefault();
  go(slug);
}

export function App() {
  const [theme, toggleTheme] = useTheme();
  const [slug, go] = useSlug();
  const [query, setQuery] = useState("");
  const [drawer, setDrawer] = useState(false);

  const doc = DOCS.find((d) => d.slug === slug) ?? DOCS[0]!;
  const index = DOCS.indexOf(doc);
  const prev = DOCS[index - 1];
  const next = DOCS[index + 1];
  const headings = useMemo(() => headingsOf(doc.body), [doc]);
  // The prose links to other pages as `(#add)`, which was an address when the page was a fragment and is not
  // one now. Rewritten to the page's real URL, and clicks on those links stay client-side.
  const body = useMemo(() => doc.body.replace(/\]\(#([a-z0-9-]+)\)/g, (m, slug: string) => (DOCS.some((d) => d.slug === slug) ? `](${hrefFor(slug)})` : m)), [doc]);
  const q = query.trim().toLowerCase();
  const matches = (d: Doc) => !q || d.title.toLowerCase().includes(q) || d.summary.toLowerCase().includes(q) || d.body.toLowerCase().includes(q);

  const nav = (
    <nav className="nav" aria-label="Documentation">
      {SECTIONS.map((section) => {
        const docs = DOCS.filter((d) => d.section === section && matches(d));
        if (docs.length === 0) return null;
        return (
          <div className="nav__section" key={section}>
            <h2>{section}</h2>
            <ul>
              {docs.map((d) => (
                <li key={d.slug}>
                  <Button
                    asChild
                    variant={d.slug === doc.slug ? "soft" : "ghost"}
                    size="sm"
                    align="start"
                    className="nav__link"
                  >
                    {/* A real href, so the page can be opened in a tab, sent to someone, and followed by a
                        crawler. The click is intercepted only to keep the navigation instant. */}
                    <a
                      href={hrefFor(d.slug)}
                      aria-current={d.slug === doc.slug ? "page" : undefined}
                      onClick={(e) => {
                        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                        e.preventDefault();
                        go(d.slug);
                        setDrawer(false);
                      }}
                    >
                      {d.title}
                      {d.isNew && (
                        <Badge size="sm" tone="primary">
                          New
                        </Badge>
                      )}
                    </a>
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
      {q && DOCS.every((d) => !matches(d)) && <p className="nav__empty">Nothing mentions “{query.trim()}”.</p>}
    </nav>
  );

  return (
    <Tooltip.Provider>
      <div className="docs">
        <header className="docs__bar">
          <Sheet open={drawer} onOpenChange={setDrawer} side="left" size="sm">
            <Sheet.Trigger asChild>
              <Button className="docs__menu" variant="ghost" size="sm" aria-label="Open navigation" leadingIcon={<Icon.Menu />} />
            </Sheet.Trigger>
            <Sheet.Content>
              <Sheet.Title>Documentation</Sheet.Title>
              <div className="docs__drawer">{nav}</div>
            </Sheet.Content>
          </Sheet>
          <a className="docs__brand" href={SITE} aria-label="Zengin, home">
            <Mark />
            <strong>Zengin</strong>
            <span>Docs</span>
          </a>
          <TextField
            className="docs__search"
            size="sm"
            placeholder="Search the docs"
            aria-label="Search the documentation"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            leadingIcon={<Icon.Search />}
          />
          <div className="docs__actions">
            <Badge tone="neutral" variant="outline" size="sm">
              v0.2
            </Badge>
            <Tooltip content={theme === "light" ? "Switch to dark" : "Switch to light"}>
              <Button variant="ghost" size="sm" onClick={toggleTheme} aria-label="Toggle theme" leadingIcon={theme === "light" ? <Icon.Moon /> : <Icon.Sun />} />
            </Tooltip>
            <Button className="docs__github" asChild variant="soft" size="sm" leadingIcon={<Icon.Code />}>
              <a href={REPO} {...EXTERNAL}>
                GitHub
              </a>
            </Button>
          </div>
        </header>

        <div className="docs__body">
          <aside className="docs__side">{nav}</aside>

          <main className="docs__main" key={doc.slug}>
            <p className="docs__crumbs">
              <span>{doc.section}</span>
              <Icon.ChevronRight />
              <span>{doc.title}</span>
            </p>
            <article
              className="article z-rise"
              onClick={(e) => {
                const a = (e.target as HTMLElement).closest("a");
                const href = a?.getAttribute("href");
                if (!href?.startsWith(BASE) || e.metaKey || e.ctrlKey || e.shiftKey) return;
                const slug = href.slice(BASE.length).replace(/\/+$/, "");
                if (!DOCS.some((d) => d.slug === slug)) return;
                e.preventDefault();
                go(slug);
              }}
            >
              <Markdown text={body} />
            </article>
            <nav className="docs__pager" aria-label="Previous and next">
              {prev ? (
                <Button asChild variant="soft" align="start" leadingIcon={<Icon.ArrowLeft />}>
                  <a href={hrefFor(prev.slug)} onClick={(e) => linkTo(e, prev.slug, go)}>
                    {prev.title}
                  </a>
                </Button>
              ) : (
                <span />
              )}
              {next && (
                <Button asChild variant="soft" trailingIcon={<Icon.ArrowRight />}>
                  <a href={hrefFor(next.slug)} onClick={(e) => linkTo(e, next.slug, go)}>
                    {next.title}
                  </a>
                </Button>
              )}
            </nav>
          </main>

          <aside className="docs__toc" aria-label="On this page">
            {headings.length > 0 && (
              <>
                <h2>On this page</h2>
                <ul>
                  {headings.map((h) => (
                    <li key={h.id} data-level={h.level}>
                      <a
                        href={`#${doc.slug}`}
                        onClick={(e) => {
                          e.preventDefault();
                          // The markdown renders plain headings; find the one with this text.
                          const el = [...document.querySelectorAll<HTMLElement>(".article h2, .article h3")].find((n) => n.textContent?.trim() === h.text);
                          el?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }}
                      >
                        {h.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </aside>
        </div>
      </div>
    </Tooltip.Provider>
  );
}

/** The Z: three modules, a bar, a diagonal, a bar. Simple modules, stronger systems. */
function Mark() {
  return (
    <svg className="docs__mark" viewBox="0 0 64 64" aria-hidden="true">
      <polygon points="12,6 62,6 54,20 4,20" fill="currentColor" />
      <polygon points="44,22 58,22 20,42 6,42" fill="currentColor" />
      <polygon points="10,44 60,44 52,58 2,58" fill="currentColor" />
    </svg>
  );
}
