import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import postcss from "postcss";
import type { Declaration, UtilityResolver } from "./resolver.js";

const require = createRequire(import.meta.url);

/** Declarations inside `@property` rules. Bookkeeping, not styling. */
const PROPERTY_RULE_DECLS = new Set(["syntax", "inherits", "initial-value"]);

/**
 * Tailwind v4 adapter. Optional: loaded only when the consumer's project uses Tailwind. Utility classes
 * are compiled through Tailwind's own design system so resolution is exactly what their build produces.
 * `themeCss` is the `@theme` block generated from the system tokens; Tailwind's default theme is loaded
 * underneath it so the rules can tell "references the default palette" apart from "references nothing".
 */
/**
 * Extracts the at-rules a project adds to Tailwind that change what compiles: custom variants, utilities, and
 * `@theme` blocks. A design system's `@theme inline { --color-muted-foreground: var(--muted-foreground) }` is
 * what makes `text-muted-foreground` a utility at all; without it the class compiles to nothing and reads as
 * a reference to no token.
 */
export function projectTailwindRules(css: string): string {
  const out: string[] = [];
  const re = /@(?:(?:custom-variant|utility)\s+[^;{]+|theme\b[^;{]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css)) !== null) {
    const start = m.index;
    let i = start + m[0].length;
    if (css[i] === ";") {
      out.push(css.slice(start, i + 1));
      continue;
    }
    if (css[i] !== "{") continue;
    // Balanced braces: @utility bodies nest (&::-webkit-scrollbar { ... }).
    let depth = 0;
    for (; i < css.length; i++) {
      if (css[i] === "{") depth++;
      else if (css[i] === "}" && --depth === 0) break;
    }
    out.push(css.slice(start, i + 1));
    re.lastIndex = i + 1;
  }
  return out.join("\n");
}

/** Where the project's Tailwind is: its root, and its Tailwind 3 config when it has one. */
export interface TailwindSource {
  /** The project root. Tailwind is loaded from here first, so the version is the project's. */
  root?: string;
  /** Tailwind 3: the config file. Default: tailwind.config.{ts,js,cjs,mjs} at the root. */
  config?: string;
}

/**
 * The Tailwind the project builds with: resolved from the project first, so `npx` and a global install check
 * against the project's own version, then from beside the engine.
 */
export function loadTailwind(root: string | undefined): { require: NodeRequire; version: string; from: "project" | "zengin" } | undefined {
  const attempts: [NodeRequire, "project" | "zengin"][] = [];
  if (root) attempts.push([createRequire(join(root, "package.json")), "project"]);
  attempts.push([require, "zengin"]);
  for (const [req, from] of attempts) {
    try {
      const pkg = JSON.parse(readFileSync(req.resolve("tailwindcss/package.json"), "utf8")) as { version: string };
      return { require: req, version: pkg.version, from };
    } catch {
      // not installed there
    }
  }
  return undefined;
}

export async function createTailwindResolver(themeCss: string, projectRules = "", source: TailwindSource = {}): Promise<UtilityResolver> {
  const found = loadTailwind(source.root);
  if (!found) {
    throw new Error(
      "classes.tailwind is enabled but the tailwindcss package could not be loaded from the project or from zengin. Install the project's dependencies, or set classes.tailwind: false in zengin.config.yaml.",
    );
  }
  if (Number(found.version.split(".")[0]) === 3) return createTailwind3Resolver(found.require, source);
  const req = found.require;
  const tailwind = req("tailwindcss") as typeof import("tailwindcss");

  const themePath = req.resolve("tailwindcss/theme.css");
  const defaultVars = new Set<string>();
  const defaultVarValues = new Map<string, string>();
  postcss.parse(readFileSync(themePath, "utf8")).walkDecls((d) => {
    if (!d.prop.startsWith("--")) return;
    defaultVars.add(d.prop);
    defaultVarValues.set(d.prop, d.value);
  });

  // A variable the project's own @theme sets is the project's, not Tailwind's default: `rounded-md` against a
  // system that defines `--radius-md` there is on-system. Only the top-level declarations of @theme blocks count.
  for (const block of projectRules.matchAll(/@theme\b[^{]*\{([^}]*)\}/g)) {
    for (const d of block[1]!.matchAll(/(--[\w-]+)\s*:/g)) defaultVars.delete(d[1]!);
  }

  const css = `@import "tailwindcss/theme.css";\n${themeCss}\n${projectRules}`;
  const designSystem = await tailwind.__unstable__loadDesignSystem(css, {
    base: dirname(themePath),
    loadStylesheet: async (id: string, base: string) => {
      let resolved: string;
      try {
        resolved = req.resolve(id);
      } catch {
        resolved = req.resolve(id, { paths: [base] });
      }
      return { path: resolved, content: readFileSync(resolved, "utf8"), base: dirname(resolved) };
    },
  });

  const cache = new Map<string, Declaration[] | null>();

  return {
    defaultVars,
    defaultVarValues,
    resolve(candidate: string): Declaration[] | null {
      const hit = cache.get(candidate);
      if (hit !== undefined) return hit;
      let result: Declaration[] | null = null;
      try {
        const [cssText] = designSystem.candidatesToCss([candidate]);
        if (cssText) {
          const decls: Declaration[] = [];
          postcss.parse(cssText).walkDecls((d) => {
            if (!d.prop.startsWith("--tw-") && !PROPERTY_RULE_DECLS.has(d.prop)) decls.push({ prop: d.prop, value: d.value });
          });
          result = decls;
        }
      } catch {
        result = null;
      }
      cache.set(candidate, result);
      return result;
    },
  };
}

/**
 * Tailwind 3: the theme is the project's tailwind.config, loaded the way Tailwind's own build loads it (it is
 * code, so this is the one place the engine runs the project's files), and each class is generated on its own
 * through Tailwind's synchronous rule generator, the path its language server uses. Tailwind 3 writes no theme
 * variables, so there are no default variables to tell apart: a default-palette class compiles to a literal,
 * which the literal rules judge.
 */
function createTailwind3Resolver(req: NodeRequire, source: TailwindSource): UtilityResolver {
  const configPath = source.config ?? findTailwindConfig(source.root);
  let userConfig: Record<string, unknown> = {};
  if (configPath) {
    try {
      const loadConfig = req("tailwindcss/loadConfig") as (path: string) => Record<string, unknown>;
      userConfig = loadConfig(configPath);
    } catch (e) {
      throw new Error(
        `Tailwind 3: could not load ${configPath} (${e instanceof Error ? e.message.split("\n")[0] : String(e)}). It imports what the project installs; install the project's dependencies, or set classes.tailwind: false.`,
      );
    }
  }
  const resolveConfig = req("tailwindcss/resolveConfig") as (c: unknown) => unknown;
  const { createContext } = req("tailwindcss/lib/lib/setupContextUtils.js") as { createContext: (c: unknown) => unknown };
  const { generateRules } = req("tailwindcss/lib/lib/generateRules.js") as { generateRules: (c: Set<string>, ctx: unknown) => [unknown, postcss.Node][] };
  const context = createContext(resolveConfig({ ...userConfig, content: [{ raw: "" }] }));

  const cache = new Map<string, Declaration[] | null>();
  return {
    defaultVars: new Set<string>(),
    defaultVarValues: new Map<string, string>(),
    resolve(candidate: string): Declaration[] | null {
      const hit = cache.get(candidate);
      if (hit !== undefined) return hit;
      let result: Declaration[] | null = null;
      try {
        const rules = generateRules(new Set([candidate]), context);
        if (rules.length) {
          const decls: Declaration[] = [];
          for (const [, node] of rules) {
            const walk = (n: postcss.Node): void => {
              if (n.type === "decl") {
                const d = n as postcss.Declaration;
                // `rgb(239 68 68 / var(--tw-bg-opacity, 1))` is Tailwind 3 carrying its own opacity utility; the
                // color is `rgb(239 68 68)`, and `rgb(var(--bg-default) / ...)` is the token's reference.
                if (!d.prop.startsWith("--tw-")) decls.push({ prop: d.prop, value: d.value.replace(/\s*\/\s*var\(--tw-[\w-]*opacity(?:\s*,\s*1)?\)/g, "") });
              } else if ("each" in n) (n as postcss.Container).each((c) => walk(c));
            };
            walk(node);
          }
          // `ring-neutral-500` compiles to Tailwind's own `--tw-ring-color` and nothing else: it exists, with
          // nothing to judge. As the Tailwind 4 path does, that is an empty list, not "renders nothing".
          result = decls;
        }
      } catch {
        result = null;
      }
      cache.set(candidate, result);
      return result;
    },
  };
}

function findTailwindConfig(root: string | undefined): string | undefined {
  if (!root) return undefined;
  for (const name of ["tailwind.config.ts", "tailwind.config.js", "tailwind.config.cjs", "tailwind.config.mjs", "tailwind.config.mts", "tailwind.config.cts"]) {
    const p = join(root, name);
    if (existsSync(p)) return p;
  }
  return undefined;
}

/** Splits a class string into candidates, preserving each candidate's offset within the string. */
export function splitClasses(value: string): { candidate: string; offset: number }[] {
  const out: { candidate: string; offset: number }[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(value)) !== null) out.push({ candidate: m[0], offset: m.index });
  return out;
}

/** Strips variants (`hover:`), important (`!`) and negative (`-`) prefixes to get the base utility. */
export function baseUtility(candidate: string): string {
  let depth = 0;
  let lastColon = -1;
  for (let i = 0; i < candidate.length; i++) {
    const ch = candidate[i];
    if (ch === "[") depth++;
    else if (ch === "]") depth--;
    else if (ch === ":" && depth === 0) lastColon = i;
  }
  let base = lastColon === -1 ? candidate : candidate.slice(lastColon + 1);
  if (base.startsWith("!")) base = base.slice(1);
  if (base.startsWith("-")) base = base.slice(1);
  return base;
}
