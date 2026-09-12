import { Badge, Button, Skeleton, Tabs } from "@zengin/ui";
import { useEffect, useRef, useState } from "react";
import { CodeBlock } from "../components/CodeBlock";

interface Item {
  name: string;
  type: string;
  title: string;
  description: string;
  registryDependencies: string[];
  fonts?: string[];
}

interface Index {
  version: string;
  items: Item[];
}

const AUTHORED = "authored";
/** The previews render at this width and are scaled to the card; .catalog__iframe sets the same size. */
const PREVIEW_WIDTH = 1280;

/**
 * The templates, as live previews of the apps they are derived from, served beside this page under
 * /templates/<name>/. The theme picker passes ?theme= to every preview, which fetches that brand file
 * from the registry at /r and applies it: the same swap `zengin theme` performs, watched happening.
 */
export function Catalog() {
  const [index, setIndex] = useState<Index | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState(AUTHORED);
  const embedded = typeof window !== "undefined" && window.self !== window.top;

  useEffect(() => {
    fetch("/r/index.json")
      .then((r) => (r.ok ? (r.json() as Promise<Index>) : Promise.reject(new Error(`the registry answered ${r.status}`))))
      .then(setIndex)
      .catch((e: Error) => setError(e.message));
  }, []);

  const templates = index?.items.filter((i) => i.type === "template") ?? [];
  const themes = index?.items.filter((i) => i.type === "theme") ?? [];
  const suffix = theme === AUTHORED ? "" : `?theme=${theme}`;

  return (
    <section className="section" id="templates">
      <div className="wrap">
        <div className="section__head">
          <span className="eyebrow">Templates</span>
          <div className="section__head-text">
            <h2 className="title">Start from something real</h2>
            <p className="lead">
              Every template is a working app on Zengin UI, served here from the same registry the CLI reads. Pick a theme and every preview changes, because a brand is one
              file.
            </p>
          </div>
        </div>

        {index && themes.length > 0 && (
          <Tabs value={theme} onValueChange={setTheme} variant="line" className="catalog__themes">
            <Tabs.List aria-label="Theme for the previews">
              <Tabs.Trigger value={AUTHORED}>As authored</Tabs.Trigger>
              {themes.map((t) => (
                <Tabs.Trigger key={t.name} value={t.name}>
                  {t.title}
                </Tabs.Trigger>
              ))}
            </Tabs.List>
          </Tabs>
        )}

        {error && <p className="catalog__error">The previews need the registry this site serves at /r, and {error}. On the deployed site they are live.</p>}

        <div className="catalog">
          {index
            ? templates.map((t) => (
                // index.html spelled out: a dev server's SPA fallback would answer the bare directory with this page.
                <TemplateCard key={t.name} template={t} src={`/templates/${t.name}/index.html${suffix}`} theme={theme === AUTHORED ? undefined : theme} embedded={embedded} />
              ))
            : !error && [0, 1, 2].map((i) => <SkeletonCard key={i} />)}
        </div>
      </div>
    </section>
  );
}

function TemplateCard({ template, src, theme, embedded }: { template: Item; src: string; theme?: string; embedded: boolean }) {
  const frame = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.4);

  // The preview renders at desktop width and is scaled to the card, so what you see is the real page.
  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / PREVIEW_WIDTH);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const components = template.registryDependencies.filter((d) => d !== "cx" && d !== "foundation").length;
  const command = `npx zengin create my-app --template ${template.name}${theme ? ` --theme ${theme}` : ""}`;

  return (
    <article className="catalog__card">
      <div className="catalog__frame" ref={frame}>
        {embedded ? (
          <p className="catalog__placeholder">Open the full page to try the previews.</p>
        ) : (
          <iframe className="catalog__iframe" src={src} title={`${template.title} template, live`} loading="lazy" style={{ transform: `scale(${scale})` }} />
        )}
      </div>
      <div className="catalog__body">
        <div className="catalog__head">
          <h3>{template.title}</h3>
          <Badge size="sm">
            {components} component{components === 1 ? "" : "s"}
          </Badge>
        </div>
        <p>{template.description}</p>
        <CodeBlock>{command}</CodeBlock>
        <div className="catalog__actions">
          <Button asChild variant="soft" size="sm">
            <a href={src} target="_blank" rel="noreferrer">
              Open full page
            </a>
          </Button>
        </div>
      </div>
    </article>
  );
}

function SkeletonCard() {
  return (
    <article className="catalog__card" aria-busy="true" aria-label="Loading template">
      <div className="catalog__frame">
        <Skeleton variant="rect" width="100%" height="100%" />
      </div>
      <div className="catalog__body">
        <Skeleton width="40%" />
        <Skeleton lines={2} />
      </div>
    </article>
  );
}
