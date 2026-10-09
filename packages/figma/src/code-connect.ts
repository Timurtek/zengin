import type { ComponentManifest } from "@zenginui/engine";

/**
 * Code Connect files from the component manifest: one `<name>.figma.ts` template per component mapping the
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

/**
 * Props that wire a component into a form or into uncontrolled state and look like nothing on a canvas:
 * `defaultValue`, `defaultOpen`, `name`, `id`. A design file has no property for them, and a mapping to a
 * property the component does not have fails `figma connect publish`.
 */
const FORM_PLUMBING = /^(default[A-Z]\w*|name|id)$/;

export const PLACEHOLDER_URL ="https://www.figma.com/design/FILE_KEY/Zengin-UI?node-id=NODE_ID";

/**
 * Code Connect template files (CLI v2): one `<name>.figma.ts` per component, in the shape `figma connect
 * migrate` produces, plus a `figma.config.json` that sets the snippet language. The v1 `figma.connect()`
 * React-parser files are no longer read by the current CLI.
 */
export function codeConnectFiles(manifests: ComponentManifest[], opts: CodeConnectOptions = {}): Record<string, string> {
  const alias = opts.alias ?? "@/components/ui";
  const dir = opts.dir ?? "src/figma";
  const out: Record<string, string> = {};
  out["figma.config.json"] = JSON.stringify({ codeConnect: { include: [`${dir}/**/*.figma.ts`], label: "React", language: "tsx" } }, null, 2) + "\n";
  for (const m of manifests) {
    const url = opts.urls?.[m.name];
    out[`${dir}/${kebab(m.name)}.figma.ts`] = renderTemplate(m, url ?? PLACEHOLDER_URL, alias, url === undefined);
  }
  return out;
}

function renderTemplate(m: ComponentManifest, url: string, alias: string, placeholder: boolean): string {
  const reads: string[] = [];
  const props: string[] = [];
  for (const [name, p] of Object.entries(m.props ?? {})) {
    if (name === "asChild" || p.type === "function" || FORM_PLUMBING.test(name)) continue;
    if (p.type === "enum" && p.values) {
      const pairs = p.values.map((v) => `  ${JSON.stringify(title(v))}: ${JSON.stringify(v)},`).join("\n");
      reads.push(`const ${name} = figma.selectedInstance.getEnum(${JSON.stringify(title(name))}, {\n${pairs}\n})`);
    } else if (p.type === "boolean") {
      reads.push(`const ${name} = figma.selectedInstance.getBoolean(${JSON.stringify(title(name))})`);
    } else if (p.type === "string" || (p.type === "node" && /^(label|title|description|placeholder|content|name)$/.test(name))) {
      reads.push(`const ${name} = figma.selectedInstance.getString(${JSON.stringify(title(name))})`);
    } else continue;
    props.push(name);
  }
  const hasChildren = m.extends === "button" || m.extends === "span" || m.name === "Button" || m.name === "Badge";
  if (hasChildren) {
    reads.push(`const children = figma.selectedInstance.getString("Label")`);
    props.push("children");
  }
  const rendered = props.map((p) => `\${figma.helpers.react.renderProp(${JSON.stringify(p)}, ${p})}`).join("");
  const todo = placeholder ? `// TODO: replace the URL with the ${m.name} component's link in Figma (right-click the component, Copy link).\n` : "";
  return `// url=${url}
// component=${m.name}
${todo}// Generated from zengin/components.json by \`zengin figma connect\`. The Figma component's properties are
// named like the props; the values are the manifest's, title-cased.

import figma from "figma"

${reads.join("\n")}

export default {
  id: ${JSON.stringify(m.name)},
  imports: [${JSON.stringify(`import { ${m.name} } from "${alias}";`)}],
  example: figma.code\`<${m.name}${rendered}/>\`,
  metadata: { nestable: true },
}
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
