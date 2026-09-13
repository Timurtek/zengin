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

/** The page is the hash, so every heading in the sidebar is a real link somebody can send. */
function useSlug(): [string, (slug: string) => void] {
  const read = () => window.location.hash.slice(1) || DOCS[0]!.slug;
  const [slug, setSlug] = useState(read);
  useEffect(() => {
    const onHash = () => setSlug(read());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  return [
    slug,
    (next: string) => {
      window.location.hash = next;
      setSlug(next);
      window.scrollTo({ top: 0 });
    },
  ];
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
                    variant={d.slug === doc.slug ? "soft" : "ghost"}
                    size="sm"
                    align="start"
                    className="nav__link"
                    aria-current={d.slug === doc.slug ? "page" : undefined}
                    onClick={() => {
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
            <article className="article z-rise">
              <Markdown text={doc.body} />
            </article>
            <nav className="docs__pager" aria-label="Previous and next">
              {prev ? (
                <Button variant="soft" align="start" leadingIcon={<Icon.ArrowLeft />} onClick={() => go(prev.slug)}>
                  {prev.title}
                </Button>
              ) : (
                <span />
              )}
              {next && (
                <Button variant="soft" trailingIcon={<Icon.ArrowRight />} onClick={() => go(next.slug)}>
                  {next.title}
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
