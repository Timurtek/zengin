import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createEngine, loadConfigFile, readProjectFiles, resolveConfig } from "@zengin/engine";
import { installItems, STYLES_INDEX_HEAD, type InstallResult } from "./install.js";
import type { RegistrySource } from "./load.js";
import { resolveItems } from "./resolve.js";
import { LAYOUT } from "./schema.js";
import { writeTokensCss } from "./tokens.js";

export interface CreateOptions {
  /** Directory to create; must not exist or must be empty. */
  dir: string;
  /** Package name; defaults to the directory's basename. */
  name?: string;
  template?: string;
  source: RegistrySource;
  /** Write the Storybook config and the stories that come with the components. Default true. */
  storybook?: boolean;
  /**
   * Path to a Zengin repository checkout. The Zengin packages are then linked with `file:` instead of
   * pulled from npm, which is how the generator is exercised before the first release.
   */
  local?: string;
}

export interface CreateResult {
  dir: string;
  name: string;
  template: string;
  version: string;
  install: InstallResult;
  tokens: { light: number; dark: number };
  /** The engine on the fresh project. Zero, or something is wrong with the registry. */
  violations: number;
}

/** Versions pinned into a generated package.json. One place to bump. */
export const VERSIONS = {
  react: "^19.3.0",
  "react-dom": "^19.3.0",
  "@types/react": "^19.3.0",
  "@types/react-dom": "^19.3.0",
  "@vitejs/plugin-react": "^6.1.1",
  typescript: "^5.9.2",
  vite: "^8.3.0",
  storybook: "^10.6.0",
  "@storybook/react-vite": "^10.6.0",
  "@storybook/addon-docs": "^10.6.0",
  "@storybook/addon-a11y": "^10.6.0",
  zengin: "^0.1.0",
} as const;

export async function createProject(opts: CreateOptions): Promise<CreateResult> {
  const dir = resolve(opts.dir);
  const name = opts.name ?? basename(dir);
  const template = opts.template ?? "blank";
  const storybook = opts.storybook ?? true;
  if (existsSync(dir) && readdirSync(dir).length > 0) throw new Error(`${dir} exists and is not empty.`);
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(name)) throw new Error(`"${name}" is not a valid package name. Use lowercase letters, digits, dots, dashes.`);

  const index = await opts.source.index();
  const version = index.version;
  const templateItem = index.items.find((i) => i.name === template && i.type === "template");
  if (!templateItem) {
    const templates = index.items.filter((i) => i.type === "template").map((i) => i.name);
    throw new Error(`No template "${template}". Templates: ${templates.join(", ")}.`);
  }

  mkdirSync(dir, { recursive: true });
  const write = (rel: string, content: string): void => {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), content);
  };

  // Base files first; the template may overwrite any of them (its own main.tsx, brand.css, index.html).
  write("index.html", INDEX_HTML(name));
  write("src/main.tsx", MAIN_TSX);
  write("src/theme/brand.css", BRAND_CSS);
  write(LAYOUT.stylesIndex, STYLES_INDEX_HEAD);
  write("vite.config.ts", VITE_CONFIG);
  write("tsconfig.json", TSCONFIG(storybook));
  write(".gitignore", GITIGNORE);
  write("zengin.config.yaml", ZENGIN_CONFIG(version));
  write(".mcp.json", MCP_JSON);
  write(".claude/settings.json", CLAUDE_SETTINGS);
  if (storybook) {
    write(".storybook/main.ts", STORYBOOK_MAIN);
    write(".storybook/preview.tsx", STORYBOOK_PREVIEW);
    write(`${LAYOUT.storiesDir}/manifest.ts`, STORIES_MANIFEST);
  }

  const items = await resolveItems(opts.source, [template]);
  const install = installItems({ projectDir: dir, items: storybook ? items : items.map((i) => ({ ...i, files: i.files.filter((f) => f.kind !== "story") })), version, force: true });

  write("package.json", packageJson({ name, install, storybook, local: opts.local }));
  write("README.md", README(name, template, install.components));

  const tokens = writeTokensCss(join(dir, LAYOUT.definitionsDir), join(dir, "src/styles/generated/tokens.css"));

  // The engine on the result. A fresh project must be clean; anything else is a registry defect.
  const { config, dir: projectDir } = loadConfigFile(join(dir, "zengin.config.yaml"));
  const resolved = resolveConfig(config, projectDir);
  const engine = await createEngine(resolved);
  const files = readProjectFiles(projectDir, resolved.scope.include, resolved.scope.exclude);
  const violations = engine.check(files).length;

  return { dir, name, template, version, install, tokens, violations };
}

function packageJson(opts: { name: string; install: InstallResult; storybook: boolean; local?: string }): string {
  // `link:` symlinks the checkout's package and uses its own node_modules, so workspace deps resolve. pnpm honors it; npm needs the release.
  const z = (pkg: string): string => (opts.local ? `link:${resolve(opts.local, "packages", pkg).replace(/\\/g, "/")}` : VERSIONS.zengin);
  const dependencies = sortKeys({ react: VERSIONS.react, "react-dom": VERSIONS["react-dom"], ...opts.install.dependencies });
  const devDependencies = sortKeys({
    "@types/react": VERSIONS["@types/react"],
    "@types/react-dom": VERSIONS["@types/react-dom"],
    "@vitejs/plugin-react": VERSIONS["@vitejs/plugin-react"],
    "@zengin/cli": z("cli"),
    "@zengin/hook": z("hook"),
    "@zengin/mcp": z("mcp"),
    typescript: VERSIONS.typescript,
    vite: VERSIONS.vite,
    ...(opts.storybook
      ? {
          storybook: VERSIONS.storybook,
          "@storybook/react-vite": VERSIONS["@storybook/react-vite"],
          "@storybook/addon-docs": VERSIONS["@storybook/addon-docs"],
          "@storybook/addon-a11y": VERSIONS["@storybook/addon-a11y"],
        }
      : {}),
    ...opts.install.devDependencies,
  });
  const scripts: Record<string, string> = {
    dev: "zengin tokens && vite",
    build: "zengin tokens && tsc -p tsconfig.json --noEmit && vite build",
    preview: "vite preview",
    tokens: "zengin tokens",
    check: "zengin check",
    add: "zengin add",
    ...(opts.storybook ? { storybook: "zengin tokens && storybook dev -p 6006 --no-open", "build-storybook": "zengin tokens && storybook build" } : {}),
  };
  return JSON.stringify({ name: opts.name, private: true, version: "0.1.0", type: "module", scripts, dependencies, devDependencies }, null, 2) + "\n";
}

function sortKeys(o: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
}

function basename(p: string): string {
  return p.replace(/[\\/]+$/, "").split(/[\\/]/).pop() ?? p;
}

const INDEX_HTML = (name: string): string => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;

const MAIN_TSX = `import "./styles/index.css";
import "./theme/brand.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
`;

const BRAND_CSS = `/*
 * Your brand, as token overrides. This is the one file in the project that may hold literals
 * (scope.foundations in zengin.config.yaml). Redefine tokens the system already has and every
 * component wears the result; there is nothing to change in src/components/ui.
 *
 * The full token list is zengin/tokens.json. Run \`zengin tokens\` (dev and build do it for you)
 * to regenerate src/styles/generated/tokens.css after editing the JSON.
 */

:root,
[data-theme="light"] {
  /* --color-primary: #1B3FE4; */
  /* --font-display: "Archivo", sans-serif; */
  /* --radius-md: 0px; */
}

[data-theme="dark"] {
  /* --color-primary: #7B90FF; */
}
`;

const VITE_CONFIG = `import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// "@" is src, matching tsconfig paths. A root-relative alias needs no Node imports, so the config typechecks without @types/node.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": "/src" } },
});
`;

const TSCONFIG = (storybook: boolean): string =>
  JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "Bundler",
        lib: ["ES2022", "DOM", "DOM.Iterable"],
        jsx: "react-jsx",
        strict: true,
        noUncheckedIndexedAccess: true,
        isolatedModules: true,
        skipLibCheck: true,
        resolveJsonModule: true,
        noEmit: true,
        types: ["vite/client"],
        baseUrl: ".",
        paths: { "@/*": ["./src/*"] },
      },
      include: ["src", "vite.config.ts", ...(storybook ? ["stories", ".storybook"] : [])],
    },
    null,
    2,
  ) + "\n";

const GITIGNORE = `node_modules/
dist/
storybook-static/
# Built from zengin/tokens*.json by \`zengin tokens\`
src/styles/generated/
`;

const ZENGIN_CONFIG = (version: string): string => `# The components in src/components/ui are this project's design system. The definitions the engine
# enforces against live in zengin/. Every rule is on; relax one here rather than around it.
system:
  package: "${LAYOUT.alias}"
  version: "${version}"           # the Zengin UI version the components were copied from
  definitions: ./${LAYOUT.definitionsDir}

scope:
  include: ["src/**/*.{ts,tsx,css}"]
  foundations: ["src/theme/**", "src/styles/**"]   # literals live here and nowhere else
  ownership: ["${LAYOUT.componentsDir}/**"]           # yours to style; the foundation rules still apply inside

rules:
  color-literal: { severity: error, allow: semantic }
  spacing-literal: error
  token-reference: error
  unknown-prop: error
  unknown-prop-value: error
  classname-policy: error
  component-substitution: error
`;

const MCP_JSON = `{
  "mcpServers": {
    "zengin": {
      "command": "zengin-mcp",
      "env": { "ZENGIN_CONFIG": "zengin.config.yaml" }
    }
  }
}
`;

const CLAUDE_SETTINGS = `{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit|MultiEdit",
        "hooks": [{ "type": "command", "command": "zengin-hook", "timeout": 30, "statusMessage": "Checking against the design system..." }]
      }
    ]
  }
}
`;

const STORYBOOK_MAIN = `import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  framework: "@storybook/react-vite",
  stories: ["../stories/**/*.stories.tsx"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y"],
  core: { disableTelemetry: true },
};

export default config;
`;

const STORYBOOK_PREVIEW = `import type { Decorator, Preview } from "@storybook/react-vite";
import "../src/styles/index.css";
import "../src/theme/brand.css";

/** Every story renders inside a themed surface. The toolbar switches data-theme, as a consumer would. */
const withTheme: Decorator = (Story, context) => {
  const theme = (context.globals["theme"] as string) ?? "light";
  return (
    <div data-theme={theme} style={{ minHeight: "100%", padding: "var(--spacing-6)", background: "var(--color-surface)", color: "var(--color-text)", fontFamily: "var(--font-sans)" }}>
      <Story />
    </div>
  );
};

const preview: Preview = {
  globalTypes: {
    theme: {
      description: "Theme",
      toolbar: { title: "Theme", icon: "mirror", items: [{ value: "light", title: "Light" }, { value: "dark", title: "Dark" }], dynamicTitle: true },
    },
  },
  initialGlobals: { theme: "light" },
  decorators: [withTheme],
  parameters: { backgrounds: { disable: true }, controls: { expanded: true }, a11y: { test: "error" } },
};

export default preview;
`;

const STORIES_MANIFEST = `import manifests from "../${LAYOUT.definitionsDir}/components.json";

/** The manifest the engine enforces against. Stories read it, so controls and variant matrices cannot drift from it. */
interface Prop {
  type: string;
  values?: string[];
  default?: unknown;
}

interface Manifest {
  name: string;
  props?: Record<string, Prop>;
  className?: { allow?: string[] };
}

const byName = new Map((manifests as unknown as Manifest[]).map((m) => [m.name, m]));

export function manifest(name: string): Manifest {
  const m = byName.get(name);
  if (!m) throw new Error(\`No manifest for \${name}\`);
  return m;
}

/** Enum values for a prop, in manifest order. */
export function values(component: string, prop: string): string[] {
  const p = manifest(component).props?.[prop];
  if (!p?.values) throw new Error(\`\${component}.\${prop} is not an enum prop\`);
  return p.values;
}

/** Storybook argTypes for every enum and boolean prop the manifest declares. */
export function argTypesFor(component: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, p] of Object.entries(manifest(component).props ?? {})) {
    if (p.type === "enum") out[name] = { control: "select", options: p.values, table: { defaultValue: p.default === undefined ? undefined : { summary: String(p.default) } } };
    else if (p.type === "boolean") out[name] = { control: "boolean" };
    else if (p.type === "number") out[name] = { control: "number" };
    else if (p.type === "string") out[name] = { control: "text" };
    else out[name] = { control: false };
  }
  return out;
}

/** What className may set, for the docs description. */
export function classNameAllow(component: string): string {
  const allow = manifest(component).className?.allow ?? [];
  return allow.length ? \`className may set: \${allow.join(", ")}.\` : "className is not a styling API on this component.";
}
`;

const README = (name: string, template: string, components: string[]): string => `# ${name}

Created with \`zengin create\` from the **${template}** template. The components in \`src/components/ui\` are yours: edit them, the engine keeps everything else on the system they define.

\`\`\`bash
npm install
npm run dev          # http://localhost:5173
npm run storybook    # http://localhost:6006
npm run check        # zengin check: every file in src against zengin/
npm run add -- select switch   # more components from the registry
\`\`\`

## Where things are

| Path | What |
| --- | --- |
| \`src/components/ui/\` | ${components.join(", ")}. Each file carries a \`zengin-owned\` pragma with the version it was copied from, so a rollup can tell how far it has drifted. |
| \`zengin/\` | \`tokens.json\`, \`tokens.dark.json\`, \`components.json\`: the definitions the engine enforces against. |
| \`src/theme/brand.css\` | Your brand as token overrides. The one place literals are allowed. |
| \`src/styles/\` | The base stylesheet and the component imports. \`generated/tokens.css\` is built by \`zengin tokens\`. |
| \`zengin.config.yaml\` | The policy. Every rule at error. |
| \`.mcp.json\`, \`.claude/settings.json\` | The MCP server and the edit hook, so agents working here are checked as they write. |
`;
