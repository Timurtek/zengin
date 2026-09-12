import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname } from "node:path";
import postcss from "postcss";
import type { Declaration, UtilityResolver } from "./resolver.js";

const require = createRequire(import.meta.url);

/**
 * Tailwind v4 adapter. Optional: loaded only when the consumer's project uses Tailwind. Utility classes
 * are compiled through Tailwind's own design system so resolution is exactly what their build produces.
 * `themeCss` is the `@theme` block generated from the system tokens; Tailwind's default theme is loaded
 * underneath it so the rules can tell "references the default palette" apart from "references nothing".
 */
export async function createTailwindResolver(themeCss: string): Promise<UtilityResolver> {
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

  const css = `@import "tailwindcss/theme.css";\n${themeCss}`;
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
