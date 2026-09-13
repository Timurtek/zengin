export interface Declaration {
  prop: string;
  value: string;
}

export interface Resolution {
  decls: Declaration[];
  /**
   * `utility` when a class compiler (Tailwind) produced it, `stylesheet` when it came from the project's own CSS,
   * `external` when it came from a stylesheet named in classes.css (a system's precompiled utilities, outside scope).
   */
  source: "utility" | "stylesheet" | "external";
  /** File the class is defined in, for stylesheet resolutions. */
  origin?: string;
}

/**
 * Turns a class name into the CSS declarations it applies. The engine core never knows how a class is
 * styled; adapters do. Rules judge declarations.
 */
export interface ClassResolver {
  resolve(candidate: string): Resolution | null;
  /** True when a utility-class compiler is active. Rules that reason about utility namespaces check this. */
  readonly utilities: boolean;
  /** Custom properties defined by the utility compiler's default theme, when one is active. */
  readonly defaultVars: ReadonlySet<string>;
  readonly defaultVarValues: ReadonlyMap<string, string>;
}

/** A resolver that compiles utility classes, e.g. the Tailwind adapter. */
export interface UtilityResolver {
  resolve(candidate: string): Declaration[] | null;
  readonly defaultVars: ReadonlySet<string>;
  readonly defaultVarValues: ReadonlyMap<string, string>;
}

export interface StylesheetResolver {
  resolve(candidate: string): { decls: Declaration[]; origin: string } | null;
}

const EMPTY_SET: ReadonlySet<string> = new Set();
const EMPTY_MAP: ReadonlyMap<string, string> = new Map();

/** Project stylesheets win over utilities: a consumer's `.btn` is theirs even if a utility of that name exists. */
export function combineResolvers(stylesheets: StylesheetResolver, utility?: UtilityResolver, external?: StylesheetResolver): ClassResolver {
  return {
    utilities: utility !== undefined,
    defaultVars: utility?.defaultVars ?? EMPTY_SET,
    defaultVarValues: utility?.defaultVarValues ?? EMPTY_MAP,
    resolve(candidate) {
      const own = stylesheets.resolve(candidate);
      if (own) return { decls: own.decls, source: "stylesheet", origin: own.origin };
      const ext = external?.resolve(candidate);
      if (ext) return { decls: ext.decls, source: "external", origin: ext.origin };
      const compiled = utility?.resolve(candidate);
      if (compiled) return { decls: compiled, source: "utility" };
      return null;
    },
  };
}
