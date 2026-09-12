import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname } from "node:path";
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
/** Extracts the at-rules a project adds to Tailwind that change what compiles: custom variants and utilities. */
export function projectTailwindRules(css: string): string {
  const out: string[] = [];
  const re = /@(custom-variant|utility)\s+[^;{]+/g;
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

export async function createTailwindResolver(themeCss: string, projectRules = ""): Promise<UtilityResolver> {
  let tailwind: typeof import("tailwindcss");
  try {
    tailwind = await import("tailwindcss");
  } catch {
    throw new Error(
      "classes.tailwind is enabled but the tailwindcss package could not be loaded. Install tailwindcss@^4 in the project, or set classes.tailwind: false in zengin.config.yaml.",
    );
  }

  const themePath = require.resolve("tailwindcss/theme.css");
  const defaultVars = new Set<string>();
  const defaultVarValues = new Map<string, string>();
  postcss.parse(readFileSync(themePath, "utf8")).walkDecls((d) => {
    if (!d.prop.startsWith("--")) return;
    defaultVars.add(d.prop);
    defaultVarValues.set(d.prop, d.value);
  });

  const css = `@import "tailwindcss/theme.css";\n${themeCss}\n${projectRules}`;
  const designSystem = await tailwind.__unstable__loadDesignSystem(css, {
    base: dirname(themePath),
    loadStylesheet: async (id: string, base: string) => {
      let resolved: string;
      try {
        resolved = require.resolve(id);
      } catch {
        resolved = require.resolve(id, { paths: [base] });
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
