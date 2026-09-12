import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The Tailwind half: which major version the project runs, where the ui directory is, and what the
 * Tailwind 3 config says about fonts and about extending versus replacing the default scales.
 * The config file is read as text, never executed: a project's config can import anything.
 */

export interface TailwindInfo {
  major: 3 | 4 | undefined;
  /** Project-relative path to the shadcn ui directory. */
  uiDir: string | undefined;
  /** Import alias for the ui directory, e.g. `@/components/ui`. */
  uiAlias: string;
  /** fontFamily entries from a Tailwind 3 config (`sans`, `heading`), value as written. */
  fontFamilies: Record<string, string>;
  /** Namespaces the Tailwind 3 config sets under `theme` directly (replacing defaults) rather than `theme.extend`. */
  replacedNamespaces: Set<string>;
  configPath: string | undefined;
}

const UI_CANDIDATES = ["components/ui", "src/components/ui", "app/components/ui", "src/app/components/ui"];

export function readTailwind(projectDir: string): TailwindInfo {
  const pkg = readJson(join(projectDir, "package.json")) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } | undefined;
  const spec = pkg?.dependencies?.["tailwindcss"] ?? pkg?.devDependencies?.["tailwindcss"];
  const majorMatch = spec ? /(\d+)/.exec(spec) : null;
  const major = majorMatch ? ((Number(majorMatch[1]) >= 4 ? 4 : 3) as 3 | 4) : undefined;

  // shadcn's own components.json names the ui alias; tsconfig paths map the alias to a directory.
  const shadcn = readJson(join(projectDir, "components.json")) as { aliases?: { ui?: string; components?: string } } | undefined;
  const uiAlias = shadcn?.aliases?.ui ?? (shadcn?.aliases?.components ? `${shadcn.aliases.components}/ui` : "@/components/ui");
  let uiDir: string | undefined;
  const tsconfig = readJson(join(projectDir, "tsconfig.json")) as { compilerOptions?: { paths?: Record<string, string[]> } } | undefined;
  const paths = tsconfig?.compilerOptions?.paths ?? {};
  for (const [pattern, targets] of Object.entries(paths)) {
    const prefix = pattern.replace(/\*$/, "");
    if (uiAlias.startsWith(prefix) && targets[0]) {
      const candidate = (targets[0].replace(/\*$/, "") + uiAlias.slice(prefix.length)).replace(/^\.\//, "");
      if (existsSync(join(projectDir, candidate))) uiDir = candidate;
    }
  }
  uiDir ??= UI_CANDIDATES.find((c) => existsSync(join(projectDir, c)));

  const configPath = ["tailwind.config.ts", "tailwind.config.js", "tailwind.config.cjs", "tailwind.config.mjs"].map((f) => join(projectDir, f)).find(existsSync);
  const fontFamilies: Record<string, string> = {};
  const replacedNamespaces = new Set<string>();
  if (configPath) {
    const text = readFileSync(configPath, "utf8");
    // fontFamily: { sans: ["var(--font-sans)", ...fontFamily.sans], heading: [...] }
    const ff = /fontFamily\s*:\s*\{([\s\S]*?)\n\s*\}/.exec(text);
    if (ff) {
      for (const m of ff[1]!.matchAll(/(\w+)\s*:\s*\[([^\]]*)\]/g)) {
        const first = /["'`]([^"'`]+)["'`]/.exec(m[2]!);
        if (first) fontFamilies[m[1]!] = `${first[1]}, ui-sans-serif, system-ui, sans-serif`;
      }
    }
    // Keys set directly under `theme:` (not inside `extend:`) replace the default scale.
    const themeBody = /theme\s*:\s*\{([\s\S]*)\}\s*,?\s*plugins/.exec(text)?.[1] ?? "";
    const extendIdx = themeBody.indexOf("extend");
    const direct = extendIdx === -1 ? themeBody : themeBody.slice(0, extendIdx);
    for (const ns of ["colors", "borderRadius", "fontFamily", "spacing", "boxShadow", "fontSize"]) {
      if (new RegExp(`^\\s*${ns}\\s*:`, "m").test(direct)) replacedNamespaces.add(NS_MAP[ns]!);
    }
  }

  return { major, uiDir, uiAlias, fontFamilies, replacedNamespaces, configPath: configPath ? configPath.slice(projectDir.length + 1).replace(/\\/g, "/") : undefined };
}

const NS_MAP: Record<string, string> = { colors: "color", borderRadius: "radius", fontFamily: "font", spacing: "spacing", boxShadow: "shadow", fontSize: "text" };

function readJson(path: string): unknown {
  if (!existsSync(path)) return undefined;
  try {
    // tsconfig files often carry comments and trailing commas.
    const text = readFileSync(path, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/,(\s*[}\]])/g, "$1");
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
