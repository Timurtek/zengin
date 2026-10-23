import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

/**
 * What to check, from what the project already tells its tools to look at: Tailwind 3's `content` globs, Tailwind
 * 4's `@source` lines, and tsconfig's `include`. A fixed list of folders misses the ones a project names for
 * itself (Dub's `ui/`, Sim's `ee/` and `hooks/`). Anything that covers the whole project scopes the whole
 * project, minus build output, tests and stories.
 */
export interface DerivedScope {
  include: string[];
  exclude: string[];
  /** Where the folders came from, for the report. */
  from: string[];
}

const FILES = "{ts,tsx,css}";
const DEFAULT_DIRS = ["src", "app", "components", "styles"];
export const SCOPE_EXCLUDE = [
  "**/node_modules/**",
  "**/.next/**",
  "**/dist/**",
  "**/build/**",
  "**/out/**",
  "**/coverage/**",
  "**/*.d.ts",
  "**/*.test.{ts,tsx}",
  "**/*.spec.{ts,tsx}",
  "**/*.stories.{ts,tsx}",
];

export function deriveScope(projectDir: string): DerivedScope {
  const root = resolve(projectDir);
  const from: string[] = [];
  const globs: { glob: string; base: string }[] = [];

  const tsconfig = join(root, "tsconfig.json");
  const include = readJsonc(tsconfig)?.["include"];
  if (Array.isArray(include)) {
    globs.push(...include.filter((g): g is string => typeof g === "string").map((glob) => ({ glob, base: root })));
    from.push("tsconfig.json include");
  }
  for (const name of ["tailwind.config.ts", "tailwind.config.js", "tailwind.config.cjs", "tailwind.config.mjs", "tailwind.config.mts"]) {
    const p = join(root, name);
    if (!existsSync(p)) continue;
    const content = /content\s*:\s*\[([\s\S]*?)\]/.exec(readFileSync(p, "utf8"))?.[1] ?? "";
    const found = [...content.matchAll(/["'`]([^"'`]+)["'`]/g)].map((m) => m[1]!);
    if (found.length) {
      globs.push(...found.map((glob) => ({ glob, base: root })));
      from.push(`${name} content`);
    }
  }
  for (const css of stylesheets(root)) {
    const sources = [...readFileSync(css, "utf8").matchAll(/@source\s+(?!not\b)["']([^"']+)["']/g)].map((m) => m[1]!);
    if (sources.length) {
      globs.push(...sources.map((glob) => ({ glob, base: dirname(css) })));
      from.push(`@source in ${relative(root, css).replace(/\\/g, "/")}`);
    }
  }

  const dirs = new Set<string>();
  let everything = false;
  for (const { glob, base } of globs) {
    const abs = resolve(base, glob.replace(/^!/, ""));
    const rel = relative(root, abs).replace(/\\/g, "/");
    if (glob.startsWith("!") || rel.startsWith("..")) continue; // outside the project: another package's to check
    const head = rel.split("/")[0] ?? "";
    if (head === "" || /[*?{[]/.test(head)) {
      // `**/*.tsx`, or a pattern at the root: the whole project, unless it only names root files (`*.config.ts`)
      if (head.startsWith("**") || rel === "" || rel === "." || rel.startsWith("**")) everything = true;
      continue;
    }
    if (isDir(join(root, head))) dirs.add(head);
  }
  if (everything) return { include: [`**/*.${FILES}`], exclude: SCOPE_EXCLUDE, from };
  for (const d of DEFAULT_DIRS) if (isDir(join(root, d))) dirs.add(d);
  if (dirs.size === 0) return { include: [`**/*.${FILES}`], exclude: SCOPE_EXCLUDE, from };
  return { include: [...dirs].sort().map((d) => `${d}/**/*.${FILES}`), exclude: SCOPE_EXCLUDE, from };
}

function readJsonc(path: string): Record<string, unknown> | undefined {
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(stripJsonc(readFileSync(path, "utf8"))) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

/** tsconfig's JSON with comments and trailing commas, made JSON. Strings are skipped whole: `"@/*": ["./src/*"]`. */
export function stripJsonc(text: string): string {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === "\\" ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j;
    } else if (ch === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      out += "\n";
    } else if (ch === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      i = end < 0 ? text.length : end + 1;
    } else out += ch;
  }
  return out.replace(/,(\s*[}\]])/g, "$1");
}

function isDir(p: string): boolean {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

/** Stylesheets in the project, outside dependencies and build output. */
function stylesheets(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string, depth: number) => {
    if (depth > 6) return;
    let names: string[] = [];
    try {
      names = readdirSync(dir);
    } catch {
      return;
    }
    for (const name of names) {
      if (name === "node_modules" || name.startsWith(".") || name === "dist" || name === "build" || name === "out") continue;
      const abs = join(dir, name);
      if (isDir(abs)) walk(abs, depth + 1);
      else if (/\.css$/.test(name)) out.push(abs);
    }
  };
  walk(root, 0);
  return out;
}
