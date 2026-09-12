/** Position in a file. `line` and `col` are 1-based, matching editor conventions. */
export interface Pos {
  line: number;
  col: number;
}

export interface Range {
  start: Pos;
  end: Pos;
}

export type Severity = "error" | "warn" | "info";

export type FixConfidence = "exact" | "nearest" | "none";

export interface Fix {
  /** A code edit that replaces `range`, or null when the engine knows what is wrong but not what is right. */
  replace: string | null;
  confidence: FixConfidence;
  /** Token the fix references, when applicable. */
  token?: string;
  /** Alternative candidates when confidence is `nearest` and there is more than one plausible answer. */
  candidates?: string[];
  note?: string;
}

export type RuleId =
  | "color-literal"
  | "spacing-literal"
  | "token-reference"
  | "unknown-prop"
  | "unknown-prop-value"
  | "classname-policy"
  | "component-substitution";

export const RULE_IDS: readonly RuleId[] = [
  "color-literal",
  "spacing-literal",
  "token-reference",
  "unknown-prop",
  "unknown-prop-value",
  "classname-policy",
  "component-substitution",
];

export interface Violation {
  rule: RuleId;
  severity: Severity;
  file: string;
  range: Range;
  found: string;
  message: string;
  fix: Fix;
  /** The suppression comment that would silence this violation. */
  suppress: string;
  /** Extra information that is not part of the fix, e.g. why a suppression comment was ignored. */
  note?: string;
}

export interface FileInput {
  /** Path relative to the project root, forward slashes. */
  path: string;
  content: string;
}

export type FileKind = "consumer" | "owned" | "foundation" | "excluded";

// ---------------------------------------------------------------------------
// Config (consumer-authored policy)
// ---------------------------------------------------------------------------

export interface RuleConfig {
  severity?: Severity;
  /** color-literal only: `semantic` allows only system tokens; `palette` also allows the base palette scale. */
  allow?: "semantic" | "palette";
  /** Paths where this rule is off. */
  except?: string[];
  /** component-substitution only: extra `source#Name` -> SystemComponent entries. */
  map?: Record<string, string>;
}

export interface ZenginConfig {
  system: {
    package: string;
    /** Pinned version. Read from node_modules when omitted. */
    version?: string;
    /** Import sources that count as the system. Globs allowed. */
    sources?: string[];
    /** Directory holding tokens.json and components.json. Defaults to node_modules/<package>/zengin. */
    definitions?: string;
  };
  scope?: {
    include?: string[];
    exclude?: string[];
    foundations?: string[];
    ownership?: string[];
  };
  /** How class names are resolved to CSS. The project's own stylesheets are always read. */
  classes?: {
    /** Compile utility classes with Tailwind v4. `auto` (default) enables it when the project depends on tailwindcss. */
    tailwind?: "auto" | boolean;
  };
  rules?: Partial<Record<RuleId, RuleConfig | Severity | "off">>;
}

export interface ResolvedRuleConfig {
  enabled: boolean;
  severity: Severity;
  allow: "semantic" | "palette";
  except: string[];
  map: Record<string, string>;
}

export interface ResolvedConfig {
  system: {
    package: string;
    version: string;
    sources: string[];
    definitionsDir: string;
  };
  scope: {
    include: string[];
    exclude: string[];
    foundations: string[];
    ownership: string[];
  };
  classes: {
    tailwind: boolean;
  };
  rules: Record<RuleId, ResolvedRuleConfig>;
}

// ---------------------------------------------------------------------------
// Definitions (shipped by the system)
// ---------------------------------------------------------------------------

export type TokenType = "color" | "dimension" | "shadow" | "fontFamily" | "fontWeight" | "number" | "duration" | "cubicBezier" | "string";

export interface Token {
  /** Dotted path with a trailing `.DEFAULT` removed, e.g. `color.primary`. */
  name: string;
  /** Full dotted path including DEFAULT. */
  path: string;
  type: TokenType;
  /** Resolved value in the default theme, with aliases followed. */
  value: string;
  /** CSS custom property the token compiles to, e.g. `--color-primary`. */
  cssVar: string;
  /** Tailwind theme namespace, e.g. `color`, `spacing`. */
  namespace: string;
  /** Theme key after the namespace, e.g. `primary`, `primary-hover`, `3`. */
  key: string;
}

export interface PropManifest {
  type: "enum" | "boolean" | "string" | "number" | "node" | "function";
  values?: string[];
  default?: string | number | boolean;
  since?: string;
  valuesSince?: Record<string, string>;
}

export interface ComponentManifest {
  name: string;
  since?: string;
  export: { from: string; name: string };
  /** Intrinsic elements and `source#Name` exports this component replaces. */
  replaces?: string[];
  /** Intrinsic element whose attributes pass through. */
  extends?: string;
  props?: Record<string, PropManifest>;
  className?: { allow?: string[] };
  /** CSS properties the component owns, mapped to the prop that controls them (or null when no prop does). */
  owns?: Record<string, string | null>;
  slots?: string[];
  states?: string[];
  /** Human notes shown when substituting a replaced export, keyed by `source#Name`. */
  migrations?: Record<string, string>;
}

export interface SystemDefinitions {
  tokens: Token[];
  components: ComponentManifest[];
}
