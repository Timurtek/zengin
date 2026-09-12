import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import postcss from "postcss";
import { __unstable__loadDesignSystem } from "tailwindcss";

export interface Declaration {
  prop: string;
  value: string;
}

export interface ClassResolver {
  /** CSS declarations a utility class compiles to, or null when the class does not exist at all. */
  resolve(candidate: string): Declaration[] | null;
  /** Custom properties defined by Tailwind's default theme (the palette and default scales). */
  defaultVars: Set<string>;
  /** Their values, so a palette reference can be matched against system tokens by value. */
  defaultVarValues: Map<string, string>;
}

const require = createRequire(import.meta.url);

/**
 * Builds a class resolver from Tailwind v4's own compiler, so utility resolution is exactly what a
 * Tailwind build produces. `themeCss` is the `@theme` block generated from the system tokens.
 *
 * The Tailwind default theme is always loaded underneath the system theme. That lets the rules tell
 * "references the default palette" (a policy question) apart from "references nothing" (a typo).
 */
export async function createTailwindResolver(themeCss: string): Promise<ClassResolver> {
  const themePath = require.resolve("tailwindcss/theme.css");
  const defaultTheme = readFileSync(themePath, "utf8");
  const defaultVars = new Set<string>();
  const defaultVarValues = new Map<string, string>();
  postcss.parse(defaultTheme).walkDecls((d) => {
    if (!d.prop.startsWith("--")) return;
    defaultVars.add(d.prop);
    defaultVarValues.set(d.prop, d.value);
  });

  const css = `@import "tailwindcss/theme.css";\n${themeCss}`;
  const designSystem = await __unstable__loadDesignSystem(css, {
    base: process.cwd(),
    loadStylesheet: async (id: string, base: string) => {
      const resolved = require.resolve(id, { paths: [base, process.cwd()] });
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
            // Tailwind emits internal `--tw-*` bookkeeping; the consumer-facing declaration is what we judge.
            if (!d.prop.startsWith("--tw-")) decls.push({ prop: d.prop, value: d.value });
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
