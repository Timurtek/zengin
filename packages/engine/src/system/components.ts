import picomatch from "picomatch";
import type { ComponentManifest } from "../types.js";

export interface SubstitutionTarget {
  component: ComponentManifest;
  /** Migration note from the manifest, when the replaced export has one. */
  migration?: string;
}

export class ComponentIndex {
  readonly byName = new Map<string, ComponentManifest>();
  /** intrinsic element -> component that replaces it */
  readonly intrinsic = new Map<string, ComponentManifest>();
  /** `source#Name` or `source#*` -> component */
  private readonly externals: { source: string; name: string; component: ComponentManifest }[] = [];
  private readonly isSystemSource: (s: string) => boolean;

  constructor(
    readonly components: ComponentManifest[],
    sources: string[],
    extraMap: Record<string, string> = {},
  ) {
    this.isSystemSource = picomatch(sources);
    for (const c of components) {
      this.byName.set(c.name, c);
      for (const r of c.replaces ?? []) this.addReplacement(r, c);
    }
    for (const [pattern, name] of Object.entries(extraMap)) {
      const c = this.byName.get(name);
      if (!c) throw new Error(`component-substitution map points to unknown component "${name}"`);
      this.addReplacement(pattern, c);
    }
  }

  private addReplacement(pattern: string, component: ComponentManifest): void {
    const hash = pattern.indexOf("#");
    if (hash === -1) {
      this.intrinsic.set(pattern, component);
    } else {
      this.externals.push({ source: pattern.slice(0, hash), name: pattern.slice(hash + 1), component });
    }
  }

  /** Resolves an import to a system component when the source is a system source. */
  resolveImport(source: string, importedName: string): ComponentManifest | undefined {
    if (!this.isSystemSource(source)) return undefined;
    return this.byName.get(importedName);
  }

  /** Resolves an import to the system component that replaces it, when the source is shadowed. */
  replacementFor(source: string, importedName: string): SubstitutionTarget | undefined {
    for (const e of this.externals) {
      if (e.source !== source) continue;
      if (e.name === "*" || e.name === importedName) {
        const migration =
          e.component.migrations?.[`${source}#${importedName}`] ?? e.component.migrations?.[`${source}#*`];
        return { component: e.component, migration };
      }
    }
    return undefined;
  }
}
