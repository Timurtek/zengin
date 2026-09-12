import type { CssFile } from "../parse/css.js";
import type { JsxElementInfo, TsxFile } from "../parse/tsx.js";
import type { ClassResolver, Declaration } from "../resolve/tailwind.js";
import type { ComponentIndex } from "../system/components.js";
import type { TokenIndex } from "../system/tokens.js";
import type { ComponentManifest, FileInput, FileKind, Fix, Range, ResolvedConfig, RuleId, Violation } from "../types.js";
import { suppressHint } from "../suppress.js";

/** One utility class as used in the file, with what it compiles to. */
export interface ClassUse {
  candidate: string;
  /** Candidate without variants, `!` or leading `-`. */
  base: string;
  range: Range;
  decls: Declaration[] | null;
  /** The JSX element the class is on, when attached to one. */
  element?: JsxElementInfo;
}

export interface RuleContext {
  file: FileInput;
  kind: FileKind;
  tsx?: TsxFile;
  css?: CssFile;
  tokens: TokenIndex;
  components: ComponentIndex;
  resolver: ClassResolver;
  config: ResolvedConfig;
  /** JSX elements that resolve to a system component through their import. */
  systemElements: Map<JsxElementInfo, ComponentManifest>;
  classUses: ClassUse[];
  report(rule: RuleId, v: { range: Range; found: string; message: string; fix: Fix; note?: string }): Violation;
}

export interface Rule {
  id: RuleId;
  check(ctx: RuleContext): Violation[];
}

export function makeReporter(file: FileInput, config: ResolvedConfig): RuleContext["report"] {
  return (rule, v) => ({
    rule,
    severity: config.rules[rule].severity,
    file: file.path,
    range: v.range,
    found: v.found,
    message: v.message,
    fix: v.fix,
    suppress: suppressHint(rule),
    ...(v.note ? { note: v.note } : {}),
  });
}

/** Rewrites a utility's theme key: `bg-[#3B82F6]` + `primary` -> `bg-primary`, `hover:px-[13px]` + `3` -> `hover:px-3`. */
export function rewriteKey(use: ClassUse, prefix: string, key: string): string {
  const head = use.candidate.slice(0, use.candidate.length - use.base.length);
  return `${head}${prefix}-${key}`;
}

/** Namespace of a theme variable: `--color-red-500` -> `color`, `--font-weight-bold` -> `font-weight`. */
export function varNamespace(v: string): string {
  const body = v.slice(2);
  for (const multi of MULTI_SEGMENT_NAMESPACES) {
    if (body === multi || body.startsWith(multi + "-")) return multi;
  }
  return body.split("-")[0]!;
}

const MULTI_SEGMENT_NAMESPACES = ["font-weight", "inset-shadow", "drop-shadow", "text-shadow", "inset-ring"];
