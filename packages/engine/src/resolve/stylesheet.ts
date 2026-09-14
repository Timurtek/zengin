import postcss from "postcss";
import type { FileInput } from "../types.js";
import type { Declaration, StylesheetResolver } from "./resolver.js";

/**
 * Resolves class names against the project's own stylesheets. No dependency, no build step: a `.btn` rule
 * in any CSS file in scope tells the engine what `className="btn"` does.
 *
 * Only simple single-class selectors are indexed: `.btn`, `.btn:hover`, `.btn::before`. Descendant and
 * compound selectors (`.card .btn`, `.btn.primary`) are skipped because their effect depends on the DOM.
 */
export class StylesheetIndex implements StylesheetResolver {
  private readonly classes = new Map<string, { decls: Declaration[]; origin: string }>();
  /** Every custom property these stylesheets declare, so a rule can tell a project's own var from a typo. */
  readonly vars = new Set<string>();

  static from(files: FileInput[]): StylesheetIndex {
    const index = new StylesheetIndex();
    for (const f of files) if (/\.css$/.test(f.path)) index.add(f);
    return index;
  }

  add(file: FileInput): void {
    let root: postcss.Root;
    try {
      root = postcss.parse(file.content);
    } catch {
      return; // an unparsable stylesheet is the consumer's build's problem, not ours
    }
    // Every custom property this file declares, whatever the selector. Theme tokens live on `:root`, which
    // is not a class selector, so collecting these inside the class walk below would miss the one place
    // that matters most.
    root.walkDecls((d) => {
      if (d.prop.startsWith("--")) this.vars.add(d.prop);
    });
    root.walkRules((rule) => {
      for (const selector of rule.selectors) {
        const m = /^\.(-?[A-Za-z_][\w-]*)(?::{1,2}[\w-]+(?:\([^)]*\))?)*$/.exec(selector.trim());
        if (!m) continue;
        const name = m[1]!;
        const entry = this.classes.get(name) ?? { decls: [], origin: file.path };
        rule.walkDecls((d) => {
          if (d.parent !== rule) return; // nested rules are their own selectors
          if (!d.prop.startsWith("--")) entry.decls.push({ prop: d.prop, value: d.value });
        });
        this.classes.set(name, entry);
      }
    });
  }

  merge(other: StylesheetIndex): StylesheetIndex {
    const out = new StylesheetIndex();
    for (const [k, v] of this.classes) out.classes.set(k, v);
    for (const [k, v] of other.classes) out.classes.set(k, v);
    for (const v of this.vars) out.vars.add(v);
    for (const v of other.vars) out.vars.add(v);
    return out;
  }

  get size(): number {
    return this.classes.size;
  }

  resolve(candidate: string): { decls: Declaration[]; origin: string } | null {
    return this.classes.get(candidate) ?? null;
  }
}
