import picomatch from "picomatch";
import type { FileKind, ResolvedConfig, RuleId } from "./types.js";

const OWNED_PRAGMA = /zengin-owned\b/;

export interface OwnedPragma {
  component?: string;
  forkedFrom?: string;
  /** Hash of the file as it was copied, so `zengin upgrade` can tell a local edit from an upstream change. */
  sha?: string;
}

/** Reads `/* zengin-owned Button, forked from @zengin/ui@1.2.0, sha 3f9a1c0b2d4e *\/` when present; the sha is optional. */
export function readOwnedPragma(content: string): OwnedPragma | undefined {
  const head = content.slice(0, 2000);
  const m = /zengin-owned\s+([\w.]+)?(?:,\s*forked from\s+([^\s,*]+))?(?:,\s*sha\s+([0-9a-f]+))?/.exec(head);
  if (!m) return undefined;
  return { component: m[1], forkedFrom: m[2], ...(m[3] ? { sha: m[3] } : {}) };
}

export class Scope {
  private readonly include: (p: string) => boolean;
  private readonly exclude: (p: string) => boolean;
  private readonly foundations: (p: string) => boolean;
  private readonly ownership: (p: string) => boolean;
  private readonly except: Record<RuleId, (p: string) => boolean>;

  constructor(config: ResolvedConfig) {
    const matcher = (globs: string[]) => (globs.length ? picomatch(globs, { dot: true }) : () => false);
    this.include = matcher(config.scope.include);
    this.exclude = matcher(config.scope.exclude);
    this.foundations = matcher(config.scope.foundations);
    this.ownership = matcher(config.scope.ownership);
    this.except = Object.fromEntries(
      Object.entries(config.rules).map(([id, r]) => [id, matcher(r.except)]),
    ) as unknown as Record<RuleId, (p: string) => boolean>;
  }

  kindOf(path: string, content: string): FileKind {
    if (!this.include(path) || this.exclude(path)) return "excluded";
    if (this.foundations(path)) return "foundation";
    if (this.ownership(path) || OWNED_PRAGMA.test(content.slice(0, 2000))) return "owned";
    return "consumer";
  }

  /** Whether a rule applies to a file, given the file kind and the rule's own path exceptions. */
  ruleApplies(rule: RuleId, kind: FileKind, path: string): boolean {
    if (kind === "excluded") return false;
    if (this.except[rule](path)) return false;
    const family = FAMILY[rule];
    if (kind === "foundation") return false; // literals live here; nothing to check yet
    if (kind === "owned") return family === "foundation";
    return true;
  }
}

export type RuleFamily = "foundation" | "contract" | "substitution";

export const FAMILY: Record<RuleId, RuleFamily> = {
  "color-literal": "foundation",
  "spacing-literal": "foundation",
  "token-reference": "foundation",
  "unknown-prop": "contract",
  "unknown-prop-value": "contract",
  "classname-policy": "contract",
  "component-substitution": "substitution",
};
