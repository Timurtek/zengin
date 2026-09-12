import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { ComponentManifest } from "@zengin/engine";
import { LAYOUT, REGISTRY_SCHEMA, type Registry, type RegistryFile, type RegistryIndex, type RegistryItem } from "./schema.js";

/**
 * Builds the registry from the repository: every component in packages/ui, the shared lib and foundation
 * files, and the example apps as templates. Imports are rewritten from the package layout to the project
 * layout (`@/components/ui`, `@/lib/cx`), so what a project receives is what it would have written itself.
 */
export function buildRegistry(opts: { root: string; version?: string }): Registry {
  const ui = join(opts.root, "packages", "ui");
  const version = opts.version ?? (JSON.parse(read(join(ui, "package.json"))) as { version: string }).version;
  const uiPkg = JSON.parse(read(join(ui, "package.json"))) as { dependencies?: Record<string, string> };
  const manifests = JSON.parse(read(join(ui, "zengin", "components.json"))) as ComponentManifest[];

  const items: RegistryItem[] = [];

  items.push({
    name: "cx",
    type: "lib",
    title: "cx",
    description: "Joins class names, dropping falsy values. Every component imports it.",
    dependencies: {},
    devDependencies: {},
    registryDependencies: [],
    files: [{ path: `${LAYOUT.libDir}/cx.ts`, kind: "lib", content: read(join(ui, "src", "internal", "cx.ts")) }],
  });

  items.push({
    name: "foundation",
    type: "definitions",
    title: "Foundation",
    description: "The token definitions (light and dark) and the base stylesheet every component assumes.",
    dependencies: {},
    devDependencies: {},
    registryDependencies: [],
    files: [
      { path: `${LAYOUT.definitionsDir}/tokens.json`, kind: "definitions", content: read(join(ui, "zengin", "tokens.json")) },
      { path: `${LAYOUT.definitionsDir}/tokens.dark.json`, kind: "definitions", content: read(join(ui, "zengin", "tokens.dark.json")) },
      { path: "src/styles/base.css", kind: "style", content: read(join(ui, "src", "styles", "base.css")) },
    ],
  });

  const componentsDir = join(ui, "src", "components");
  for (const dir of readdirSync(componentsDir).sort()) {
    const tsxPath = join(componentsDir, dir, `${dir}.tsx`);
    if (!existsSync(tsxPath)) continue;
    const tsx = read(tsxPath);
    const manifest = manifests.find((m) => kebab(m.name) === dir);
    if (!manifest) throw new Error(`packages/ui component "${dir}" has no manifest entry`);

    const dependencies: Record<string, string> = {};
    for (const m of tsx.matchAll(/from\s+"(@radix-ui\/[^"]+|radix-ui)"/g)) {
      const pkg = m[1]!;
      const v = uiPkg.dependencies?.[pkg];
      if (!v) throw new Error(`packages/ui/package.json has no version for ${pkg}, used by ${dir}`);
      dependencies[pkg] = v;
    }
    const registryDependencies = ["cx", "foundation"];
    for (const m of tsx.matchAll(/from\s+"\.\.\/([\w-]+)\/[\w-]+\.js"/g)) registryDependencies.push(m[1]!);

    const files: RegistryFile[] = [
      { path: `${LAYOUT.componentsDir}/${dir}/${dir}.tsx`, kind: "component", content: rewriteComponent(tsx) },
    ];
    const cssPath = join(componentsDir, dir, `${dir}.css`);
    if (existsSync(cssPath)) files.push({ path: `${LAYOUT.componentsDir}/${dir}/${dir}.css`, kind: "style", content: read(cssPath) });
    const storyPath = join(ui, "stories", `${dir}.stories.tsx`);
    if (existsSync(storyPath)) files.push({ path: `${LAYOUT.storiesDir}/${dir}.stories.tsx`, kind: "story", content: rewriteStory(read(storyPath)) });

    items.push({
      name: dir,
      type: "component",
      title: manifest.name,
      description: describe(tsx) ?? `${manifest.name} from Zengin UI.`,
      dependencies,
      devDependencies: {},
      registryDependencies,
      files,
      manifest: { ...manifest, export: { ...manifest.export, from: LAYOUT.alias } },
    });
  }

  const componentNames = new Set(items.filter((i) => i.type === "component").map((i) => i.name));
  items.push(blankTemplate(componentNames));
  items.push(
    templateFrom({
      root: opts.root,
      dir: "examples/marketing-site",
      name: "marketing",
      title: "Marketing page",
      description: "A product page: hero with a live panel, tabs, a rules table, specimens, and a brand as one token file. Archivo, black rules, cobalt.",
      rootFiles: ["index.html", "vercel.json"],
      componentNames,
    }),
  );
  items.push(
    templateFrom({
      root: opts.root,
      dir: "examples/review-workspace",
      name: "review",
      title: "Review workspace",
      description: "An application workflow: a review queue with filtering, status badges, a confirmation dialog, and a theme toggle.",
      rootFiles: ["index.html"],
      componentNames,
    }),
  );

  // Themes: one directory each under packages/ui/themes, a theme.json beside a brand.css.
  const themesDir = join(ui, "themes");
  for (const dir of existsSync(themesDir) ? readdirSync(themesDir).sort() : []) {
    const meta = join(themesDir, dir, "theme.json");
    const css = join(themesDir, dir, "brand.css");
    if (!existsSync(meta) || !existsSync(css)) continue;
    const t = JSON.parse(read(meta)) as { title: string; description: string; fonts?: string[] };
    items.push({
      name: dir,
      type: "theme",
      title: t.title,
      description: t.description,
      dependencies: {},
      devDependencies: {},
      registryDependencies: [],
      files: [{ path: "src/theme/brand.css", kind: "theme", content: read(css) }],
      fonts: t.fonts ?? [],
    });
  }

  return { schema: REGISTRY_SCHEMA, name: "zengin", version, generatedAt: new Date().toISOString(), items };
}

/** Writes index.json and items/<name>.json so the registry can be served as static files. */
export function writeRegistry(registry: Registry, outDir: string): string[] {
  mkdirSync(join(outDir, "items"), { recursive: true });
  const index: RegistryIndex = {
    ...registry,
    items: registry.items.map(({ files: _f, manifest: _m, ...rest }) => rest),
  };
  const written = [join(outDir, "index.json")];
  writeFileSync(written[0]!, JSON.stringify(index, null, 2) + "\n");
  for (const item of registry.items) {
    const p = join(outDir, "items", `${item.name}.json`);
    writeFileSync(p, JSON.stringify(item, null, 2) + "\n");
    written.push(p);
  }
  return written;
}

function templateFrom(opts: { root: string; dir: string; name: string; title: string; description: string; rootFiles: string[]; componentNames: Set<string> }): RegistryItem {
  const base = join(opts.root, opts.dir);
  const files: RegistryFile[] = [];
  const used = new Set<string>();

  for (const f of opts.rootFiles) {
    const p = join(base, f);
    if (existsSync(p)) files.push({ path: f, kind: "template", content: read(p) });
  }
  for (const p of walk(join(base, "src"))) {
    const rel = relative(base, p).replace(/\\/g, "/");
    if (rel.startsWith("src/styles/generated/")) continue;
    let content = read(p);
    if (/\.(tsx?|css)$/.test(rel)) {
      for (const m of content.matchAll(/import\s*\{([^}]+)\}\s*from\s*"@zengin\/ui"/g)) {
        for (const name of m[1]!.split(",")) {
          const clean = name.replace(/^\s*type\s+/, "").trim();
          if (!clean) continue;
          const k = kebab(clean);
          if (opts.componentNames.has(k)) used.add(k);
        }
      }
      content = content.replace(/"@zengin\/ui\/styles\.css"/g, '"./styles/index.css"').replace(/"@zengin\/ui"/g, `"${LAYOUT.alias}"`);
    }
    // The entry point must load the brand file, or themes and brands change nothing. The examples that
    // consume the package have no brand file; the project has one.
    if (rel === "src/main.tsx" && !content.includes("theme/brand.css")) {
      content = content.includes('import "./styles/index.css";')
        ? content.replace('import "./styles/index.css";', 'import "./styles/index.css";\nimport "./theme/brand.css";')
        : `import "./theme/brand.css";\n${content}`;
    }
    files.push({ path: rel, kind: "template", content });
  }

  return {
    name: opts.name,
    type: "template",
    title: opts.title,
    description: opts.description,
    dependencies: {},
    devDependencies: {},
    registryDependencies: ["foundation", "cx", ...[...used].sort()],
    files,
  };
}

function blankTemplate(componentNames: Set<string>): RegistryItem {
  const deps = ["button", "card"].filter((n) => componentNames.has(n));
  return {
    name: "blank",
    type: "template",
    title: "Blank",
    description: "A page with one card and one button, ready to be replaced.",
    dependencies: {},
    devDependencies: {},
    registryDependencies: ["foundation", "cx", ...deps],
    files: [
      {
        path: "src/App.tsx",
        kind: "template",
        content: `import { Button, Card } from "${LAYOUT.alias}";

export function App() {
  return (
    <main className="app">
      <Card padding="lg">
        <h1 className="app__title">It runs.</h1>
        <p className="app__lead">Components live in src/components/ui and are yours to edit. The brand is src/theme/brand.css. The engine checks everything else.</p>
        <Button tone="primary" onClick={() => alert("Still on the system.")}>
          Get started
        </Button>
      </Card>
    </main>
  );
}
`,
      },
      {
        path: "src/app.css",
        kind: "template",
        content: `/* Layout only. Every value is a token; the components own their own appearance. */
body {
  margin: 0;
  font-family: var(--font-sans);
  background-color: var(--color-surface-sunken);
  color: var(--color-text);
}

.app {
  display: grid;
  place-items: center;
  min-height: 100vh;
  padding: var(--spacing-8);
}

.app__title {
  margin: 0 0 var(--spacing-3);
  font-family: var(--font-display);
  font-size: var(--text-3xl);
  font-weight: var(--font-weight-semibold);
  line-height: var(--leading-tight);
}

.app__lead {
  max-width: 32rem;
  margin: 0 0 var(--spacing-6);
  color: var(--color-text-muted);
}
`,
      },
      {
        path: "src/main.tsx",
        kind: "template",
        content: `import "./styles/index.css";
import "./theme/brand.css";
import "./app.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
`,
      },
    ],
  };
}

/** Package-relative imports become project-alias imports; `.js` suffixes on relative imports go. */
function rewriteComponent(tsx: string): string {
  return tsx.replace(/"\.\.\/\.\.\/internal\/cx\.js"/g, '"@/lib/cx"').replace(/from\s+"(\.\.?\/[^"]+)\.js"/g, 'from "$1"');
}

function rewriteStory(tsx: string): string {
  return tsx.replace(/from\s+"\.\.\/src"/g, `from "${LAYOUT.alias}"`);
}

/** The first doc comment in the file, one paragraph. */
function describe(tsx: string): string | undefined {
  const m = /\/\*\*\s*([\s\S]*?)\*\//.exec(tsx);
  if (!m) return undefined;
  const text = m[1]!
    .split("\n")
    .map((l) => l.replace(/^\s*\*\s?/, "").trim())
    .filter(Boolean)
    .join(" ");
  return text.length > 220 ? `${text.slice(0, 217)}...` : text;
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir).sort()) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function read(p: string): string {
  return readFileSync(p, "utf8").replace(/\r\n/g, "\n");
}

export function kebab(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

export function pascal(name: string): string {
  return name
    .split(/[-_]/)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join("");
}
