import type { ComponentManifest } from "@zengin/engine";

/**
 * Code Connect files from the component manifest: one `<name>.figma.tsx` per component mapping the
 * Figma component's properties (Variant, Size, Loading) to the React props by the same names, plus the
 * `figma.config.json` that tells the Code Connect CLI where they are. The manifest is the source of truth
 * for both the engine and the design file, which is the point.
 */

export interface CodeConnectOptions {
  /** Figma component URLs by component name. Missing ones get a placeholder to fill in. */
  urls?: Record<string, string>;
  /** Import alias for the components. Default `@/components/ui`. */
  alias?: string;
  /** Directory the files go in, relative to the project, for figma.config.json. Default `src/figma`. */
  dir?: string;
}

export const PLACEHOLDER_URL = "https://www.figma.com/design/FILE_KEY/Zengin-UI?node-id=NODE_ID";

export function codeConnectFiles(manifests: ComponentManifest[], opts: CodeConnectOptions = {}): Record<string, string> {
  const alias = opts.alias ?? "@/components/ui";
  const dir = opts.dir ?? "src/figma";
  const out: Record<string, string> = {};
  out["figma.config.json"] = JSON.stringify({ codeConnect: { include: [`${dir}/**/*.figma.tsx`], parser: "react" } }, null, 2) + "\n";
  for (const m of manifests) {
    const url = opts.urls?.[m.name];
    out[`${dir}/${kebab(m.name)}.figma.tsx`] = renderConnect(m, url ?? PLACEHOLDER_URL, alias, url === undefined);
  }
  return out;
}

function renderConnect(m: ComponentManifest, url: string, alias: string, placeholder: boolean): string {
  const props: string[] = [];
  for (const [name, p] of Object.entries(m.props ?? {})) {
    if (name === "asChild" || p.type === "function") continue;
    if (p.type === "enum" && p.values) {
      const pairs = p.values.map((v) => `${JSON.stringify(title(v))}: ${JSON.stringify(v)}`).join(", ");
      props.push(`    ${name}: figma.enum(${JSON.stringify(title(name))}, { ${pairs} }),`);
    } else if (p.type === "boolean") {
      props.push(`    ${name}: figma.boolean(${JSON.stringify(title(name))}),`);
    } else if (p.type === "string" || (p.type === "node" && /^(label|title|description|placeholder|content|name)$/.test(name))) {
      props.push(`    ${name}: figma.string(${JSON.stringify(title(name))}),`);
    }
  }
  const hasChildren = m.extends === "button" || m.extends === "span" || m.name === "Button" || m.name === "Badge";
  if (hasChildren) props.push(`    children: figma.string("Label"),`);
  const todo = placeholder ? `// TODO: replace the URL with the ${m.name} component's link in Figma (right-click the component, Copy link).\n` : "";
  return `import figma from "@figma/code-connect";
import { ${m.name} } from "${alias}";

/**
 * ${m.name}: generated from zengin/components.json by \`zengin figma connect\`. The Figma component's
 * properties are named like the props; the values are the manifest's, title-cased.
 */
${todo}figma.connect(${m.name}, ${JSON.stringify(url)}, {
  props: {
${props.join("\n")}
  },
  example: (props) => <${m.name} {...props} />,
});
`;
}

export function kebab(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
}

/** `ghost-danger` to `Ghost danger`, `showValue` to `Show value`, `sm` to `Sm`. */
export function title(s: string): string {
  const words = s.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[-_]/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
