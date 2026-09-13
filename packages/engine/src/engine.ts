import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parseCss } from "./parse/css.js";
import { parseTsx, type JsxElementInfo, type StringSpan } from "./parse/tsx.js";
import { comparePos } from "./parse/positions.js";
import { combineResolvers, type ClassResolver, type UtilityResolver } from "./resolve/resolver.js";
import { StylesheetIndex } from "./resolve/stylesheet.js";
import { baseUtility, createTailwindResolver, projectTailwindRules, splitClasses } from "./resolve/tailwind.js";
import { RULES } from "./rules/index.js";
import { makeReporter, type ClassUse, type RuleContext } from "./rules/context.js";
import { Scope } from "./scope.js";
import { applySuppressions } from "./suppress.js";
import { ComponentIndex } from "./system/components.js";
import { loadTokens, toThemeCss, TokenIndex } from "./system/tokens.js";
import { resolveProfiles, type ProfileView } from "./system/profiles.js";
import type { ComponentManifest, FileInput, FileInventory, FileKind, Inventory, InventoryTotals, ResolvedConfig, SystemDefinitions, Violation } from "./types.js";
import { parseSuppressions } from "./suppress.js";
import { readOwnedPragma } from "./scope.js";
import { RULE_IDS } from "./types.js";

export interface Engine {
  readonly config: ResolvedConfig;
  readonly definitions: SystemDefinitions;
  /** Checks a batch. Stylesheets in the batch resolve class names for the whole batch. */
  check(files: FileInput[]): Violation[];
  /** Checks one file against the stylesheets loaded with `loadStylesheets`. */
  checkFile(file: FileInput): Violation[];
  /** Registers the project's stylesheets so single-file checks can resolve class names. Replaces any previous set. */
  loadStylesheets(files: FileInput[]): void;
  /** How scope classifies a file: consumer, owned, foundation, or excluded. */
  kindOf(file: FileInput): FileKind;
  /** What the files do with the system: suppressions, owned components, component usage. Excluded files are skipped. */
  inventory(files: FileInput[]): Inventory;
}

/** Reads `tokens.json` and `components.json` from a definitions directory. */
export function loadDefinitions(dir: string): SystemDefinitions {
  const tokens = loadTokens(JSON.parse(readFileSync(join(dir, "tokens.json"), "utf8")));
  const components = JSON.parse(readFileSync(join(dir, "components.json"), "utf8")) as ComponentManifest[];
  return { tokens, components };
}

export async function createEngine(config: ResolvedConfig, definitions?: SystemDefinitions): Promise<Engine> {
  const defs = definitions ?? loadDefinitions(config.system.definitionsDir);
  // A project with profiles checks each file against the definitions for the profile that claims it, so the
  // indexes are built per view rather than once. A project without profiles has exactly one view, the base,
  // and pays nothing for the machinery.
  const profiles = resolveProfiles(config, defs);
  const indexes = new Map<ProfileView, { tokens: TokenIndex; components: ComponentIndex }>();
  for (const view of profiles.views) {
    indexes.set(view, {
      tokens: new TokenIndex(view.definitions.tokens),
      components: new ComponentIndex(view.definitions.components, config.system.sources, config.rules["component-substitution"].map),
    });
  }
  const indexFor = (view: ProfileView) => indexes.get(view) ?? indexes.get(profiles.base)!;
  const { tokens, components } = indexFor(profiles.base);
  const projectRules = config.classes.css
    .filter((p) => existsSync(p))
    .map((p) => projectTailwindRules(readFileSync(p, "utf8")))
    .join("\n");
  const utility: UtilityResolver | undefined = config.classes.tailwind
    ? await createTailwindResolver(toThemeCss(defs.tokens), projectRules)
    : undefined;
  // Utilities compile from the theme, so a profile with its own tokens compiles its own.
  const utilityFor = new Map<ProfileView, UtilityResolver | undefined>([[profiles.base, utility]]);
  if (config.classes.tailwind) {
    for (const view of profiles.views) {
      if (view === profiles.base) continue;
      utilityFor.set(view, view.definitions.tokens === defs.tokens ? utility : await createTailwindResolver(toThemeCss(view.definitions.tokens), projectRules));
    }
  }
  const scope = new Scope(config);
  const rules = RULES.filter((r) => config.rules[r.id].enabled);
  // Stylesheets named in classes.css are indexed too: a system that ships precompiled utilities
  // (`.w-full { width: 100% }`) resolves class names the project's own CSS never defines. They resolve
  // as `external`, so foundation rules judge the declarations at the use, as they do for compiled utilities.
  const external = StylesheetIndex.from(config.classes.css.filter((p) => existsSync(p)).map((p) => ({ path: normalize(p), content: readFileSync(p, "utf8") })));
  let loaded = new StylesheetIndex();

  const checkWith = (file: FileInput, resolverFor: (view: ProfileView) => ClassResolver): Violation[] => {
    const path = normalize(file.path);
    const kind = scope.kindOf(path, file.content);
    if (kind === "excluded") return [];

    const view = profiles.viewFor(path);
    const index = indexFor(view);
    const resolver = resolverFor(view);
    const ctx: RuleContext = {
      file: { path, content: file.content },
      kind,
      tokens: index.tokens,
      components: index.components,
      resolver,
      config,
      systemElements: new Map(),
      classUses: [],
      report: makeReporter({ path, content: file.content }, config),
    };

    let comments: { text: string; line: number; endLine: number }[] = [];
    if (/\.(tsx|jsx|ts|js)$/.test(path)) {
      ctx.tsx = parseTsx(file.content);
      ctx.systemElements = resolveSystemElements(ctx.tsx.elements, ctx.tsx.imports, index.components);
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
    loadStylesheets(files) {
      loaded = StylesheetIndex.from(files.map((f) => ({ ...f, path: normalize(f.path) })));
    },
    checkFile(file) {
      return checkWith(file, (view) => combineResolvers(loaded, utilityFor.get(view) ?? utility, external));
    },
    check(files) {
      const batch = StylesheetIndex.from(files.map((f) => ({ ...f, path: normalize(f.path) })));
      const merged = loaded.merge(batch);
      const cache = new Map<ProfileView, ClassResolver>();
      const resolverFor = (view: ProfileView): ClassResolver => {
        let r = cache.get(view);
        if (!r) {
          r = combineResolvers(merged, utilityFor.get(view) ?? utility, external);
          cache.set(view, r);
        }
        return r;
      };
      return [...files]
        .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
        .flatMap((f) => checkWith(f, resolverFor));
    },
    kindOf: (file) => scope.kindOf(normalize(file.path), file.content),
    inventory(files) {
      const perFile: FileInventory[] = [];
      for (const f of [...files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))) {
        const path = normalize(f.path);
        const kind = scope.kindOf(path, f.content);
        if (kind === "excluded") continue;
        const profile = profiles.viewFor(path).name;
        const entry: FileInventory = { file: path, kind, ...(profile ? { profile } : {}), suppressions: [], components: {} };
        if (kind === "owned") {
          const pragma = readOwnedPragma(f.content);
          entry.owned = { file: path, ...(pragma?.component ? { component: pragma.component } : {}), ...(pragma?.forkedFrom ? { forkedFrom: pragma.forkedFrom } : {}) };
        }
        let comments: { text: string; line: number; endLine: number }[] = [];
        if (/\.(tsx|jsx|ts|js)$/.test(path)) {
          const tsx = parseTsx(f.content);
          comments = tsx.comments;
          for (const [, comp] of resolveSystemElements(tsx.elements, tsx.imports, components)) {
            entry.components[comp.name] = (entry.components[comp.name] ?? 0) + 1;
          }
        } else if (/\.css$/.test(path)) {
          comments = parseCss(f.content).comments;
        } else {
          continue;
        }
        for (const s of parseSuppressions(comments)) {
          entry.suppressions.push({ file: path, line: s.line, rules: [...s.rules], ...(s.reason ? { reason: s.reason } : {}) });
        }
        perFile.push(entry);
      }

      const totals: InventoryTotals = { files: perFile.length, consumerFiles: 0, ownedFiles: 0, suppressions: 0, suppressionsWithoutReason: 0, components: {}, uncontracted: [] };
      const uncontracted = new Set<string>();
      for (const e of perFile) {
        if (e.kind === "consumer") totals.consumerFiles++;
        if (e.kind === "owned") totals.ownedFiles++;
        totals.suppressions += e.suppressions.length;
        totals.suppressionsWithoutReason += e.suppressions.filter((s) => !s.reason).length;
        for (const [name, uses] of Object.entries(e.components)) {
          const c = (totals.components[name] ??= { uses: 0, files: 0 });
          c.uses += uses;
          c.files += 1;
          const m = components.byName.get(name);
          if (m && !m.extends && Object.keys(m.props ?? {}).filter((k) => k !== "asChild").length === 0) uncontracted.add(name);
        }
      }
      totals.uncontracted = [...uncontracted].sort();
      return { files: perFile, totals };
    },
  };
}

function normalize(path: string): string {
  return path.replace(/\\/g, "/");
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
      const resolution = resolver.resolve(candidate);
      uses.push({
        candidate,
        base: baseUtility(candidate),
        range: tsx.lines.range(start, start + candidate.length),
        decls: resolution?.decls ?? null,
        ...(resolution ? { source: resolution.source } : {}),
        ...(resolution?.origin ? { origin: resolution.origin } : {}),
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
