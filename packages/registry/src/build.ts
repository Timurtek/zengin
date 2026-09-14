import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { ComponentManifest } from "@zenginui/engine";
import { LAYOUT, REGISTRY_SCHEMA, type Registry, type RegistryFile, type RegistryIndex, type RegistryItem, type FontRole } from "./schema.js";
import { ICON_SETS, REACT_ICONS_VERSION, renderIconsModule } from "./icons.js";
import { buildTokensCss } from "./tokens.js";

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

  // Every file in src/internal is a lib item; components depend on the ones they import.
  const LIB_DESCRIPTIONS: Record<string, string> = {
    cx: "Joins class names, dropping falsy values. Every component imports it.",
    icons: "The icon vocabulary: one component per name, drawn by Zengin UI until zengin icons <set> points the names at a react-icons set.",
    chart: "Scales, paths and the width hook the chart components share.",
    markdown: "The markdown subset models produce, parsed into blocks for the Markdown component.",
  };
  for (const file of readdirSync(join(ui, "src", "internal")).sort()) {
    if (!/\.tsx?$/.test(file)) continue;
    const name = file.replace(/\.tsx?$/, "");
    // The icons lib carries the Icon manifest: it shadows the icon packages, so the project draws from the vocabulary.
    const manifest = name === "icons" ? manifests.find((m) => m.name === "Icon") : undefined;
    items.push({
      name: `lib-${name}`,
      type: "lib",
      title: name,
      description: LIB_DESCRIPTIONS[name] ?? `${name} helpers from Zengin UI.`,
      dependencies: {},
      devDependencies: {},
      registryDependencies: [],
      files: [{ path: `${LAYOUT.libDir}/${file}`, kind: "lib", content: rewriteComponent(read(join(ui, "src", "internal", file))) }],
      ...(manifest ? { manifest: { ...manifest, export: { from: "@/lib/icons", name: "Icon" } } } : {}),
    });
  }

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
      { path: "src/styles/chart.css", kind: "style", content: read(join(ui, "src", "styles", "chart.css")) },
      { path: "src/styles/motion.css", kind: "style", content: read(join(ui, "src", "styles", "motion.css")) },
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
    const registryDependencies = ["foundation"];
    for (const m of tsx.matchAll(/from\s+"\.\.\/\.\.\/internal\/([\w-]+)\.js"/g)) registryDependencies.push(`lib-${m[1]!}`);
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
  items.push(
    templateFrom({
      root: opts.root,
      dir: "examples/blank",
      name: "blank",
      title: "Blank",
      description: "A page with one card and one button, ready to be replaced.",
      rootFiles: ["index.html"],
      componentNames,
    }),
  );
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
      rootFiles: ["index.html", "mock.json"],
      componentNames,
    }),
  );

  items.push(
    templateFrom({
      root: opts.root,
      dir: "examples/saas",
      name: "saas",
      title: "SaaS dashboard",
      description: "An admin app: overview with stat cards and charts, a customers table with row actions and a detail sheet, billing with quotas, settings that save with a toast. Sidebar, top bar, both schemes.",
      rootFiles: ["index.html", "mock.json"],
      componentNames,
    }),
  );
  items.push(
    templateFrom({
      root: opts.root,
      dir: "examples/chat",
      name: "chat",
      title: "AI chat",
      description: "An assistant: conversation with streamed markdown, reasoning, tool calls and sources, a prompt with suggestions, a model picker. On the Vercel AI SDK, with a scripted transport so it runs without a key.",
      rootFiles: ["index.html", "mock.json"],
      componentNames,
    }),
  );

  items.push(
    templateFrom({
      root: opts.root,
      dir: "examples/auth",
      name: "auth",
      title: "Auth",
      description: "Sign in, create account, reset and verify, one card on @zenginui/ui with real validation against mock accounts.",
      rootFiles: ["index.html", "mock.json"],
      componentNames,
    }),
  );
  items.push(
    templateFrom({
      root: opts.root,
      dir: "examples/docs",
      name: "docs",
      title: "Docs",
      description: "A sidebar of sections, markdown pages with code and tables, an on-this-page outline, search, previous and next, on @zenginui/ui.",
      rootFiles: ["index.html", "mock.json"],
      componentNames,
    }),
  );
  items.push(
    templateFrom({
      root: opts.root,
      dir: "examples/storefront",
      name: "storefront",
      title: "Storefront",
      description: "A product grid with search, filters and sort, a cart sheet with quantities and totals, and a checkout dialog that places the order, on @zenginui/ui.",
      rootFiles: ["index.html", "mock.json"],
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
    // The default theme is the system's own tokens, spelled out, so applying it over any brand is a real reset.
    const content =
      dir === "default"
        ? `/*\n * The default theme: Zengin UI's own tokens, every one, so that applying it over another brand resets\n * everything. Generated from zengin/tokens.json and tokens.dark.json. Edit freely, or run \`zengin brand\`.\n */\n\n${buildTokensCss(join(ui, "zengin")).css.replace(/^\/\*.*\*\/\n\n/, "")}`
        : read(css);
    items.push({
      name: dir,
      type: "theme",
      title: t.title,
      description: t.description,
      dependencies: {},
      devDependencies: {},
      registryDependencies: [],
      files: [{ path: "src/theme/brand.css", kind: "theme", content }],
      fonts: t.fonts ?? [],
    });
  }

  // Font pairings: one directory each under packages/ui/fonts, a fonts.json naming the three roles.
  const fontsDir = join(ui, "fonts");
  for (const dir of existsSync(fontsDir) ? readdirSync(fontsDir).sort() : []) {
    const meta = join(fontsDir, dir, "fonts.json");
    if (!existsSync(meta)) continue;
    const f = JSON.parse(read(meta)) as { title: string; description: string; display: FontRole; sans: FontRole; mono: FontRole };
    items.push({
      name: `fonts-${dir}`,
      type: "fonts",
      title: f.title,
      description: f.description,
      dependencies: {},
      devDependencies: {},
      registryDependencies: [],
      files: [],
      pairing: { display: f.display, sans: f.sans, mono: f.mono },
    });
  }

  // Icon sets: the vocabulary drawn by a react-icons module. Installing one replaces src/lib/icons.tsx.
  for (const [name, set] of Object.entries(ICON_SETS)) {
    items.push({
      name: `icons-${name}`,
      type: "icons",
      title: set.title,
      description: set.description,
      dependencies: { "react-icons": REACT_ICONS_VERSION },
      devDependencies: {},
      registryDependencies: [],
      files: [{ path: `${LAYOUT.libDir}/icons.tsx`, kind: "lib", content: renderIconsModule(name, set) }],
      iconSet: { module: set.module, names: set.names },
    });
  }

  // What each story needs beyond its own item, so install can decide whether to write it.
  recordStoryRequirements(items);
  // A template answers those requirements itself, so a new project's Storybook is whole on the first run.
  closeTemplateStoryRequirements(items);

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
    if (rel === "src/preview-theme.ts") continue; // the site's preview harness, not part of the template
    let content = read(p);
    if (rel === "src/main.tsx") content = content.replace(/import "\.\/preview-theme";\r?\n/, "");
    if (/\.(tsx?|css)$/.test(rel)) {
      for (const m of content.matchAll(/import\s*\{([^}]+)\}\s*from\s*"@zenginui\/ui"/g)) {
        for (const name of m[1]!.split(",")) {
          const clean = name.replace(/^\s*type\s+/, "").replace(/\s+as\s+\w+\s*$/, "").trim(); // `type X` and `X as Y` both name X
          if (!clean) continue;
          const k = kebab(clean);
          if (opts.componentNames.has(k)) used.add(k);
        }
      }
      content = content.replace(/"@zenginui\/ui\/styles\.css"/g, '"./styles/index.css"').replace(/"@zenginui\/ui"/g, `"${LAYOUT.alias}"`);
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
    registryDependencies: ["foundation", "lib-cx", ...[...used].sort()],
    files,
    source: opts.dir,
  };
}

/** Package-relative imports become project-alias imports; `.js` suffixes on relative imports go. */
function rewriteComponent(tsx: string): string {
  return tsx.replace(/"\.\.\/\.\.\/internal\/([\w-]+)\.js"/g, '"@/lib/$1"').replace(/from\s+"(\.\.?\/[^"]+)\.js"/g, 'from "$1"');
}

/**
 * Every component a story names, read from its imports of the project's barrel.
 *
 * A story is the item's documentation and it ships with the item, so it lands in projects that may have
 * nothing else. The component's own imports say what the component needs; nothing said what its *story*
 * needed, so a Loader story demonstrating a Loader inside a Message shipped to projects without Message and
 * broke `tsc` the moment it arrived. `zengin check` passed the whole time, correctly, because a missing
 * import is not a design-system violation.
 */
function storyImports(tsx: string): string[] {
  const out = new Set<string>();
  const alias = LAYOUT.alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const m of tsx.matchAll(new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*"${alias}"`, "g"))) {
    for (const part of m[1]!.split(",")) {
      // A type-only import is erased at build time, so it can never be a missing component at runtime, and
      // a story's types come from the same barrel whether or not the component beside them is installed.
      if (/^\s*type\s/.test(part)) continue;
      const name = part.split(" as ")[0]!.trim();
      if (name && /^[A-Z]/.test(name)) out.add(name);
    }
  }
  return [...out];
}

/**
 * What an item actually delivers: itself, and everything it declares it depends on, followed through.
 * Anything a story names beyond this set is a broken install waiting to happen.
 */
function deliveredComponents(name: string, byName: Map<string, RegistryItem>, seen = new Set<string>()): Set<string> {
  const out = new Set<string>();
  if (seen.has(name)) return out;
  seen.add(name);
  const item = byName.get(name);
  if (!item) return out;
  if (item.manifest?.name) out.add(item.manifest.name);
  for (const f of item.files ?? []) {
    const m = /components\/ui\/([\w-]+)\//.exec(f.path);
    if (m && f.kind === "component") out.add(m[1]!);
  }
  for (const dep of item.registryDependencies ?? []) for (const d of deliveredComponents(dep, byName, seen)) out.add(d);
  return out;
}

/**
 * Records, per item, which components its story needs beyond what the item delivers.
 *
 * The alternative was to make every story self-contained, which makes worse documentation: a Tooltip is
 * best shown on a real Button, and a Skeleton inside a real Card. The other alternative was to pull those
 * in as dependencies, which would drag Button into a dozen installs that do not otherwise need it. So the
 * story ships with its requirements declared, and install writes it only where they are met.
 */
export function recordStoryRequirements(items: RegistryItem[]): void {
  const byName = new Map(items.map((i) => [i.name, i]));
  for (const item of items) {
    if (item.type !== "component") continue;
    const story = (item.files ?? []).find((f) => f.kind === "story");
    if (!story) continue;
    const exported = new Set<string>();
    for (const d of deliveredComponents(item.name, byName)) {
      exported.add(d);
      exported.add(d.replace(/(^|-)([a-z])/g, (_, __, c: string) => c.toUpperCase()));
    }
    const needs = storyImports(story.content).filter((n) => !exported.has(n));
    if (needs.length) item.storyRequires = needs.sort();
  }
}

/**
 * Adds to each template the components its own components' stories demonstrate.
 *
 * `add` deliberately does not do this — see `recordStoryRequirements` — because someone who asks for one
 * component should not receive three. A template is the other case: it is a whole project someone opens,
 * and its Storybook is that project's documentation of the system it owns. A scaffold whose first output
 * is "1 story was left out" is reporting a hole the person did not make. Across the eight templates this
 * adds two components in total: Badge to blank, Checkbox to saas.
 *
 * The loop runs to a fixpoint because a component pulled in this way brings its own story.
 */
export function closeTemplateStoryRequirements(items: RegistryItem[]): void {
  const byName = new Map(items.map((i) => [i.name, i]));
  for (const item of items) {
    if (item.type !== "template") continue;
    const deps = [...item.registryDependencies];
    const seen = new Set(deps);
    // Order is preserved and additions go on the end: foundation and the lib items lead for a reason.
    for (let i = 0; i < deps.length; i++) {
      for (const need of byName.get(deps[i]!)?.storyRequires ?? []) {
        const name = kebab(need);
        if (seen.has(name) || byName.get(name)?.type !== "component") continue;
        seen.add(name);
        deps.push(name);
      }
    }
    item.registryDependencies = deps;
  }
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
