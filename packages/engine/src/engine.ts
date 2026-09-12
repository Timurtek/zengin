import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseCss } from "./parse/css.js";
import { parseTsx, type JsxElementInfo, type StringSpan } from "./parse/tsx.js";
import { comparePos } from "./parse/positions.js";
import { baseUtility, createTailwindResolver, splitClasses, type ClassResolver } from "./resolve/tailwind.js";
import { RULES } from "./rules/index.js";
import { makeReporter, type ClassUse, type RuleContext } from "./rules/context.js";
import { Scope } from "./scope.js";
import { applySuppressions } from "./suppress.js";
import { ComponentIndex } from "./system/components.js";
import { loadTokens, toThemeCss, TokenIndex } from "./system/tokens.js";
import type { ComponentManifest, FileInput, ResolvedConfig, SystemDefinitions, Violation } from "./types.js";
import { RULE_IDS } from "./types.js";

export interface Engine {
  readonly config: ResolvedConfig;
  readonly definitions: SystemDefinitions;
  check(files: FileInput[]): Violation[];
  checkFile(file: FileInput): Violation[];
}

/** Reads `tokens.json` and `components.json` from a definitions directory. */
export function loadDefinitions(dir: string): SystemDefinitions {
  const tokens = loadTokens(JSON.parse(readFileSync(join(dir, "tokens.json"), "utf8")));
  const components = JSON.parse(readFileSync(join(dir, "components.json"), "utf8")) as ComponentManifest[];
  return { tokens, components };
}

export async function createEngine(config: ResolvedConfig, definitions?: SystemDefinitions): Promise<Engine> {
  const defs = definitions ?? loadDefinitions(config.system.definitionsDir);
  const tokens = new TokenIndex(defs.tokens);
  const components = new ComponentIndex(defs.components, config.system.sources, config.rules["component-substitution"].map);
  const resolver = await createTailwindResolver(toThemeCss(defs.tokens));
  const scope = new Scope(config);
  const rules = RULES.filter((r) => config.rules[r.id].enabled);

  const checkFile = (file: FileInput): Violation[] => {
    const path = file.path.replace(/\\/g, "/");
    const kind = scope.kindOf(path, file.content);
    if (kind === "excluded") return [];

    const ctx: RuleContext = {
      file: { path, content: file.content },
      kind,
      tokens,
      components,
      resolver,
      config,
      systemElements: new Map(),
      classUses: [],
      report: makeReporter({ path, content: file.content }, config),
    };

    let comments: { text: string; line: number; endLine: number }[] = [];
    if (/\.(tsx|jsx|ts|js)$/.test(path)) {
      ctx.tsx = parseTsx(file.content);
      ctx.systemElements = resolveSystemElements(ctx.tsx.elements, ctx.tsx.imports, components);
      ctx.classUses = collectClassUses(ctx.tsx, resolver);
      comments = ctx.tsx.comments;
    } else if (/\.css$/.test(path)) {
      ctx.css = parseCss(file.content);
      comments = ctx.css.comments;
    } else {
      return [];
    }

    const violations: Violation[] = [];
    for (const rule of rules) {
      if (!scope.ruleApplies(rule.id, kind, path)) continue;
      violations.push(...rule.check(ctx));
    }
    return sortViolations(applySuppressions(violations, comments));
  };

  return {
    config,
    definitions: defs,
    checkFile,
    check(files) {
      return [...files]
        .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
        .flatMap((f) => checkFile(f));
    },
  };
}

function resolveSystemElements(
  elements: JsxElementInfo[],
  imports: { source: string; imported: string; local: string }[],
  components: ComponentIndex,
): Map<JsxElementInfo, ComponentManifest> {
  const map = new Map<JsxElementInfo, ComponentManifest>();
  const byLocal = new Map(imports.map((i) => [i.local, i]));
  for (const el of elements) {
    if (el.isIntrinsic) continue;
    const imp = byLocal.get(el.rootName);
    if (!imp) continue;
    const exported = imp.imported === "*" ? el.tag.split(".")[1] : imp.imported;
    if (!exported) continue;
    const comp = components.resolveImport(imp.source, exported);
    if (comp) map.set(el, comp);
  }
  return map;
}

function collectClassUses(tsx: ReturnType<typeof parseTsx>, resolver: ClassResolver): ClassUse[] {
  const uses: ClassUse[] = [];
  const add = (span: StringSpan, element?: JsxElementInfo) => {
    for (const { candidate, offset } of splitClasses(span.value)) {
      const start = span.offset + offset;
      uses.push({
        candidate,
        base: baseUtility(candidate),
        range: tsx.lines.range(start, start + candidate.length),
        decls: resolver.resolve(candidate),
        ...(element ? { element } : {}),
      });
    }
  };
  for (const el of tsx.elements) for (const attr of el.attrs) for (const span of attr.classSpans) add(span, el);
  for (const span of tsx.looseClassSpans) add(span);
  return uses;
}

export function sortViolations(violations: Violation[]): Violation[] {
  return [...violations].sort(
    (a, b) =>
      comparePos(a.range.start, b.range.start) ||
      RULE_IDS.indexOf(a.rule) - RULE_IDS.indexOf(b.rule) ||
      (a.found < b.found ? -1 : a.found > b.found ? 1 : 0),
  );
}
