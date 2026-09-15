import { parse } from "@babel/parser";
import postcss, { type Declaration, type Rule } from "postcss";
import type { ComponentManifest, PropManifest } from "@zenginui/engine";
import {
  componentPropsType,
  elementOf,
  emptyDeclarations,
  emptyInfo,
  idName,
  isPascal,
  makeCollector,
  PLACEMENT,
  propKind,
  scanDeclarations,
  SKIP_PROPS,
  unwrap,
  type Declarations,
  type Node,
} from "./types.js";

/**
 * A component manifest from a project's own source, rather than from an installed package's `.d.ts`.
 *
 * This is what closes the loop on a component a project invents. Building one under an ownership path
 * already silences the contract and substitution rules for the file itself, but nothing then holds the
 * rest of the project to it: the component joins the system's surface without joining its rules. Here the
 * props come from the TypeScript types the component already declares, the defaults from the destructuring
 * in its own signature, and `owns` from its stylesheet, since a property the component's class sets is a
 * property a consumer must not set from outside.
 */

export interface SourceComponent {
  manifest: ComponentManifest;
  /** The file it was read from, for the report. */
  file: string;
}

export interface SourceDerivation {
  components: ComponentManifest[];
  report: {
    files: number;
    components: number;
    /** Components whose stylesheet supplied an `owns` map. */
    withOwns: number;
    /** Names found but not usable, with the reason. */
    skipped: string[];
    /** Names the caller asked for that this pass never found, so the command can say so and fail. */
    notFound: string[];
    /** component -> the file it came from. */
    origin: Record<string, string>;
  };
}

export interface SourceFile {
  /** Path relative to the project root, forward slashes. */
  path: string;
  content: string;
}

interface ComponentSite {
  name: string;
  file: string;
  /** Defaults read from the destructuring pattern in the component's own signature. */
  defaults: Record<string, string | number | boolean>;
  /** The first class the component puts on its root element, e.g. `z-button`. */
  rootClass?: string;
}

export interface SourceOptions {
  importFrom: string;
  version?: string;
  only?: string[];
  /**
   * Which files hold the system's own components. Types are read from every file passed in, because a prop's
   * enum often lives in a shared module outside the component directory, but only these files contribute
   * components: a page that exports a PascalCase function is not a design-system component.
   */
  owned?: (path: string) => boolean;
}

export function deriveManifestFromSource(files: SourceFile[], opts: SourceOptions): SourceDerivation {
  const code = files.filter((f) => /\.(tsx|ts|jsx|js)$/.test(f.path) && !/\.(test|spec|stories)\./.test(f.path));
  const css = files.filter((f) => /\.css$/.test(f.path));

  const decls = emptyDeclarations();
  const sites = new Map<string, ComponentSite>();
  for (const f of code) {
    let body: Node[];
    try {
      const ast = parse(f.content, { sourceType: "module", plugins: ["typescript", "jsx"], errorRecovery: true }) as unknown as { program: { body: Node[] } };
      body = ast.program.body;
    } catch {
      continue;
    }
    scanDeclarations(body.map(unwrap), decls);
    if (opts.owned && !opts.owned(f.path)) continue;
    for (const site of componentsIn(body, f.path)) if (!sites.has(site.name)) sites.set(site.name, site);
  }

  const collect = makeCollector(decls, { strictElements: true });
  // Source names its enums: `variant?: ButtonVariant` with `type ButtonVariant = "solid" | "soft"`. The prop
  // kind is only an enum if the alias is opened, so the walker gets a resolver the package path does not need.
  const resolveAlias = (name: string): Node | undefined => decls.aliases.get(name);
  const ownsByClass = ownsFromCss(css);
  const components: ComponentManifest[] = [];
  const skipped: string[] = [];
  const origin: Record<string, string> = {};
  let withOwns = 0;

  for (const name of [...sites.keys()].sort()) {
    if (opts.only && !opts.only.includes(name)) continue;
    const site = sites.get(name)!;
    const info = emptyInfo();
    collect(decls.functions.get(name) ?? { type: "TSTypeReference", typeName: { type: "Identifier", name: `${name}Props` } }, new Set(), info);
    if (!info.found) {
      skipped.push(`${name}: no props type found (${site.file})`);
      continue;
    }

    const props: NonNullable<ComponentManifest["props"]> = {};
    for (const m of info.members) {
      if (m.type !== "TSPropertySignature") continue;
      const key = idName(m["key"]);
      if (!key || SKIP_PROPS.has(key) || key in props) continue;
      const kind = propKind((m["typeAnnotation"] as Node | undefined)?.["typeAnnotation"] as Node | undefined, resolveAlias);
      if (!kind) continue;
      const def = site.defaults[key];
      props[key] = def === undefined ? kind : { ...kind, default: def };
    }
    for (const [prop, values] of Object.entries(info.variants)) props[prop] = { type: "enum", values };

    const owns = decideOwns(site.rootClass ? ownsByClass.get(site.rootClass) : undefined, props);
    if (Object.keys(owns).length) withOwns++;
    // The package path guesses `extends` and `replaces` from a component's name, because a `.d.ts` for a
    // library called Dialog usually is a dialog. Source knows better and should not guess: this project's
    // Dialog is a Radix dialog, not an HTML one, and its Avatar renders a span whose props type says
    // HTMLElement. Only an element actually read from the props type is recorded.
    components.push({
      name,
      since: opts.version ?? "0.0.0",
      export: { from: opts.importFrom, name },
      ...(info.extends ? { extends: info.extends } : {}),
      props,
      className: { allow: PLACEMENT },
      ...(Object.keys(owns).length ? { owns } : {}),
      ...(info.passthrough.length ? { passthrough: [...new Set(info.passthrough)] } : {}),
    } as ComponentManifest);
    origin[name] = site.file;
  }

  // A name the caller asked for and this pass never saw. Reported rather than swallowed: `define Shell`
  // used to answer "the manifest already describes this source" for a component it had never found.
  const notFound = (opts.only ?? []).filter((n) => !sites.has(n));

  return { components, report: { files: code.length, components: components.length, withOwns, skipped, notFound, origin } };
}

// ---------------------------------------------------------------------------
// Finding the components in a source module
// ---------------------------------------------------------------------------

/**
 * A component in source is an exported `function X(props)`, an exported `const X = forwardRef<E, P>(fn)`,
 * or an exported `const X = Object.assign(Root, {...})` for a compound. The compound takes the root's props,
 * which is what the manifest records: one entry named for the root, never one per part.
 */
function componentsIn(body: Node[], file: string): ComponentSite[] {
  const out: ComponentSite[] = [];
  const locals = new Map<string, Node>(); // local function/const name -> the function node, for Object.assign roots
  const seen = (name: string, fn: Node | undefined): void => {
    // PascalCase, and not SCREAMING_CASE: `TONES` in a lib module passed the old test and arrived in the
    // manifest as a component with no props, where one false positive blocked a whole `--write`.
    if (!isPascal(name) || name === name.toUpperCase()) return;
    out.push({ name, file, defaults: fn ? defaultsOf(fn) : {}, ...(fn ? { rootClass: rootClassOf(fn) } : {}) });
  };

  for (const node of body) {
    const inner = node.type === "ExportNamedDeclaration" || node.type === "ExportDefaultDeclaration" ? ((node["declaration"] as Node | undefined) ?? node) : node;
    if (inner.type === "FunctionDeclaration") locals.set(idName(inner["id"]), inner);
    if (inner.type === "VariableDeclaration") {
      for (const d of (inner["declarations"] as Node[]) ?? []) {
        const fn = functionOf(d["init"] as Node | undefined, locals);
        if (fn) locals.set(idName(d["id"]), fn);
      }
    }
  }

  for (const node of body) {
    if (node.type !== "ExportNamedDeclaration" && node.type !== "ExportDefaultDeclaration") continue;
    const decl = node["declaration"] as Node | undefined;
    if (!decl) continue;
    if (decl.type === "FunctionDeclaration") seen(idName(decl["id"]), decl);
    if (decl.type === "VariableDeclaration") {
      for (const d of (decl["declarations"] as Node[]) ?? []) seen(idName(d["id"]), functionOf(d["init"] as Node | undefined, locals));
    }
  }
  return out;
}

/** The function a component's initialiser wraps: `forwardRef(fn)`, `memo(fn)`, `Object.assign(Root, ...)`, or a bare arrow. */
function functionOf(init: Node | undefined, locals: Map<string, Node>): Node | undefined {
  if (!init) return undefined;
  if (init.type === "FunctionExpression" || init.type === "ArrowFunctionExpression") return init;
  if (init.type === "Identifier") return locals.get(idName(init));
  if (init.type !== "CallExpression") return undefined;
  const callee = init["callee"] as Node;
  const name = callee.type === "MemberExpression" ? idName(callee["property"]) : idName(callee);
  const args = ((init["arguments"] as Node[] | undefined) ?? []).filter(Boolean);
  if (name === "assign") return functionOf(args[0], locals); // Object.assign(Root, { Trigger, Content })
  if (/^(forwardRef|memo)$/.test(name)) return functionOf(args[0], locals);
  return undefined;
}

/** `function Button({ variant = "solid", size = "md" }, ref)` -> `{ variant: "solid", size: "md" }`. */
function defaultsOf(fn: Node): Record<string, string | number | boolean> {
  const first = ((fn["params"] as Node[] | undefined) ?? [])[0];
  if (!first || first.type !== "ObjectPattern") return {};
  const out: Record<string, string | number | boolean> = {};
  for (const p of (first["properties"] as Node[]) ?? []) {
    if (p.type !== "ObjectProperty") continue;
    const value = p["value"] as Node;
    if (value?.type !== "AssignmentPattern") continue;
    const key = idName(p["key"]);
    const right = value["right"] as Node;
    if (!key) continue;
    if (right.type === "StringLiteral") out[key] = String(right["value"]);
    else if (right.type === "NumericLiteral") out[key] = Number(right["value"]);
    else if (right.type === "BooleanLiteral") out[key] = Boolean(right["value"]);
  }
  return out;
}

/**
 * The class a component puts on its root: the first token of the first class-name string in its body.
 * `cx("z-button z-focusable", className)` and `className="z-card"` both give `z-button` / `z-card`.
 */
function rootClassOf(fn: Node): string | undefined {
  let found: string | undefined;
  const visit = (n: unknown): void => {
    if (found || !n || typeof n !== "object") return;
    if (Array.isArray(n)) {
      for (const c of n) visit(c);
      return;
    }
    const node = n as Node;
    if (node.type === "JSXAttribute" && idName(node["name"]) === "className") {
      const v = node["value"] as Node | undefined;
      const literal = v?.type === "StringLiteral" ? String(v["value"]) : firstStringIn(v?.type === "JSXExpressionContainer" ? (v["expression"] as Node) : v);
      const token = literal?.trim().split(/\s+/)[0];
      if (token) {
        found = token;
        return;
      }
    }
    for (const key of Object.keys(node)) {
      if (key === "loc" || key === "start" || key === "end") continue;
      visit(node[key]);
    }
  };
  visit(fn["body"]);
  return found;
}

function firstStringIn(n: Node | undefined): string | undefined {
  if (!n) return undefined;
  if (n.type === "StringLiteral") return String(n["value"]);
  if (n.type === "CallExpression") {
    for (const a of ((n["arguments"] as Node[] | undefined) ?? []).filter(Boolean)) {
      const s = firstStringIn(a);
      if (s) return s;
    }
  }
  if (n.type === "TemplateLiteral") {
    const q = ((n["quasis"] as Node[] | undefined) ?? [])[0];
    const raw = ((q?.["value"] as { raw?: string } | undefined) ?? {}).raw;
    if (raw?.trim()) return raw;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// owns, from the component's own stylesheet
// ---------------------------------------------------------------------------

/** Properties a consumer must not set from outside, because the component's own rules set them. */
const OWNABLE = new Set([
  "background-color", "background", "color", "border", "border-color", "border-width", "border-style", "border-radius",
  "padding", "padding-block", "padding-inline", "font", "font-size", "font-weight", "font-family", "line-height",
  "box-shadow", "opacity", "gap", "text-transform", "letter-spacing", "min-height", "height",
]);

/** property -> how often each data attribute governed a rule that set it, and whether any rule set it bare. */
export type OwnsTally = Record<string, { by: Record<string, number>; bare: boolean }>;

/**
 * Reads each stylesheet into `class -> tally`. Two things decide whether a rule counts.
 *
 * The rule must be *about* the class, not about one of its children: `.z-tabs[data-variant="pill"] .z-tabs__list`
 * styles the list, and attributing its radius to Tabs would say the root owns something it does not. Only the
 * rightmost compound selector, the one the rule actually styles, is read.
 *
 * And a rule behind a pseudo-class is a state, not a prop. `.z-card[data-interactive]:hover` sets a border
 * color because the pointer is over it, so counting `interactive` there would name the wrong lever for someone
 * asking which prop to reach for. The property is still owned; it just is not attributed to that attribute.
 */
function ownsFromCss(files: SourceFile[]): Map<string, OwnsTally> {
  const out = new Map<string, OwnsTally>();
  for (const f of files) {
    let root;
    try {
      root = postcss.parse(f.content);
    } catch {
      continue;
    }
    root.walkRules((rule: Rule) => {
      for (const selector of rule.selectors ?? []) {
        const subject = subjectOf(selector);
        const cls = /\.([A-Za-z0-9_-]+)/.exec(subject)?.[1];
        if (!cls) continue;
        const stateful = /:(?!not\()[a-z-]/.test(subject);
        const attrs = stateful ? [] : [...subject.matchAll(/\[data-([a-z-]+)/g)].map((m) => camel(m[1]!));
        // A prop set on the root governs what it switches, even when the declaration lands on a child of the
        // block: `.z-field[data-font="mono"] .z-field__input { font-family }` is owned by the `font` prop, and
        // reading only the subject concluded that nothing owned it. That mattered: `define --force` would then
        // have set the owner to null and undone the prop the manifest exists to point people at.
        const governing = governedBy(selector, cls);
        const entry = out.get(governing?.block ?? cls) ?? {};
        rule.walkDecls((decl: Declaration) => {
          const name = decl.prop.toLowerCase();
          if (name.startsWith("--") || !OWNABLE.has(name)) return;
          const slot = (entry[name] ??= { by: {}, bare: false });
          const by = governing?.props ?? attrs;
          if (by.length) for (const a of by) slot.by[a] = (slot.by[a] ?? 0) + 1;
          else if (!governing) slot.bare = true;
        });
        if (Object.keys(entry).length) out.set(governing?.block ?? cls, entry);
      }
    });
  }
  return out;
}

/**
 * The block whose prop switches this rule on, when the subject is a child of that block.
 *
 * Only a data attribute on an ancestor that is the subject's own BEM block counts. An ancestor from somewhere
 * else in the page is not this component's business, and an ancestor with no data attribute is unconditional
 * child styling, which is what the deriver was taught to stop attributing to the component.
 */
function governedBy(selector: string, subjectClass: string): { block: string; props: string[] } | undefined {
  const compounds = selector.trim().split(/\s*[>+~]\s*|\s+/);
  for (const compound of compounds.slice(0, -1)) {
    if (/:(?!not\()[a-z-]/.test(compound)) continue; // a state, not a prop
    const block = /\.([A-Za-z0-9_-]+)/.exec(compound)?.[1];
    if (!block) continue;
    if (subjectClass !== block && !subjectClass.startsWith(`${block}__`)) continue;
    const props = [...compound.matchAll(/\[data-([a-z-]+)/g)].map((m) => camel(m[1]!));
    if (props.length) return { block, props };
  }
  return undefined;
}

/** The compound a rule actually styles: everything after the last combinator. */
function subjectOf(selector: string): string {
  const parts = selector.trim().split(/\s*[>+~]\s*|\s+/);
  return parts[parts.length - 1] ?? "";
}

/**
 * Turns a tally into the manifest's `owns`. Every prop that governs a property is named, most frequent first,
 * because more than one commonly does: a Button's background takes its hue from `tone` and its treatment from
 * `variant`, and naming only the winner of a count sends a reader to the wrong half. Only props the component
 * declares are named at all, so an attribute the component sets for itself is never mistaken for a lever.
 * A property nothing declared governs is owned by the component and nobody in particular, which is null.
 */
function decideOwns(tally: OwnsTally | undefined, props: NonNullable<ComponentManifest["props"]>): Record<string, string | string[] | null> {
  if (!tally) return {};
  const out: Record<string, string | string[] | null> = {};
  for (const [property, slot] of Object.entries(tally)) {
    const ranked = Object.entries(slot.by)
      .filter(([prop]) => prop in props)
      .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
      .map(([prop]) => prop);
    out[property] = ranked.length === 0 ? null : ranked.length === 1 ? ranked[0]! : ranked;
  }
  return out;
}

function camel(s: string): string {
  return s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Merging into an existing manifest
// ---------------------------------------------------------------------------

export interface MergePlan {
  merged: ComponentManifest[];
  added: string[];
  changed: { name: string; fields: string[] }[];
  unchanged: string[];
  /** Where the stylesheet and the manifest disagree about who controls a property. Reported, never resolved. */
  disagreed: string[];
}

/**
 * Folds derived entries into the manifest the project already has. With `takeStylesheet`, a disagreement
 * about who controls a property is resolved in the stylesheet's favour instead of only being reported, which
 * is the right way round when the manifest was written by hand and has fallen behind the CSS.
 *
 * Folds derived entries into the manifest the project already has. An entry the manifest does not carry is
 * added whole. One it does carry is updated field by field, and only where the source is the better authority:
 * props, owns and extends come from the code, while `replaces`, `migrations`, `since`, `className` and any
 * hand-written note stay exactly as they are. `className.allow` is a policy call rather than something the
 * source states, so it is written once with a new entry and never overwritten. Nothing is ever removed,
 * because the manifest may legitimately know things the source cannot say.
 */
export function mergeIntoManifest(existing: ComponentManifest[], derived: ComponentManifest[], takeStylesheet = false): MergePlan {
  const byName = new Map(existing.map((e) => [e.name, e]));
  const added: string[] = [];
  const changed: { name: string; fields: string[] }[] = [];
  const unchanged: string[] = [];
  const disagreed: string[] = [];
  const merged = existing.map((e) => ({ ...e }));

  for (const d of derived) {
    const prior = byName.get(d.name);
    if (!prior) {
      merged.push(d);
      added.push(d.name);
      continue;
    }
    const next: ComponentManifest = { ...prior };
    const fields: string[] = [];

    const props = mergeProps(prior.props, d.props);
    if (props && JSON.stringify(props) !== JSON.stringify(prior.props)) {
      next.props = props;
      fields.push("props");
    }
    if (d.owns && Object.keys(d.owns).length) {
      // The manifest's existing answer stands: which prop controls a property is a judgment the stylesheet
      // cannot overrule, and silently rewriting it would change what classname-policy rejects. Properties the
      // manifest has no answer for are added, and a disagreement is reported rather than resolved.
      const owns = { ...(prior.owns ?? {}) };
      for (const [property, prop] of Object.entries(d.owns)) {
        if (property in owns) {
          if (JSON.stringify(owns[property]) === JSON.stringify(prop)) continue;
          disagreed.push(`${d.name}.${property}: manifest says ${show(owns[property])}, stylesheet says ${show(prop)}`);
          if (!takeStylesheet) continue;
        }
        owns[property] = prop;
      }
      if (JSON.stringify(owns) !== JSON.stringify(prior.owns)) {
        next.owns = owns;
        fields.push("owns");
      }
    }
    // Which element's attributes pass through is a judgment the manifest may hold more precisely than the
    // types do, so it is filled in when absent and never overwritten.
    if (d.extends && !prior.extends) {
      next.extends = d.extends;
      fields.push("extends");
    }
    if (fields.length) {
      merged[merged.findIndex((m) => m.name === d.name)] = next;
      changed.push({ name: d.name, fields });
    } else unchanged.push(d.name);
  }
  return { merged, added, changed, unchanged, disagreed };
}

/** How specific a derived kind is. Source that could not open a type reports `node`, which must never win. */
function specificity(p: PropManifest | undefined): number {
  if (!p) return 0;
  if (p.type === "node") return 1;
  if (p.type === "enum") return p.values?.length ? 3 : 1;
  return 2;
}

/**
 * Props are merged key by key, never replaced. A prop the source declares and the manifest does not is added;
 * one both carry takes the source's reading only when the source read it more precisely, so a hand-declared
 * enum survives a source file whose type the walker could not open. A prop the manifest carries and the source
 * does not is kept: it may come from a passthrough type, or from a compound the source cannot attribute.
 */
function mergeProps(prior: ComponentManifest["props"], derived: ComponentManifest["props"]): ComponentManifest["props"] | undefined {
  if (!derived) return prior;
  const out: NonNullable<ComponentManifest["props"]> = { ...(prior ?? {}) };
  for (const [key, next] of Object.entries(derived)) {
    const had = out[key];
    if (!had) {
      out[key] = next;
      continue;
    }
    if (specificity(next) < specificity(had)) {
      // Keep the better reading, but a default the source states is always worth taking.
      if (next.default !== undefined && had.default === undefined) out[key] = { ...had, default: next.default };
      continue;
    }
    out[key] = { ...had, ...next };
  }
  return out;
}

export function renderDefineReport(d: SourceDerivation, plan: MergePlan, write: boolean, took = false): string {
  const lines: string[] = [];
  lines.push(`${d.report.files} source files read, ${d.report.components} components derived.`);
  if (plan.added.length) lines.push(`\nNew to the manifest (${plan.added.length}):`);
  for (const name of plan.added) {
    const entry = d.components.find((c) => c.name === name)!;
    const props = Object.keys(entry.props ?? {});
    lines.push(`  ${name}  ${d.report.origin[name] ?? ""}`);
    lines.push(`    props: ${props.length ? props.join(", ") : "none"}`);
    if (entry.owns && Object.keys(entry.owns).length) lines.push(`    owns: ${Object.keys(entry.owns).join(", ")}`);
    if (entry.extends) lines.push(`    extends: ${entry.extends}`);
  }
  if (plan.changed.length) {
    lines.push(`\nUpdated (${plan.changed.length}):`);
    for (const c of plan.changed) lines.push(`  ${c.name}: ${c.fields.join(", ")}`);
  }
  if (plan.unchanged.length) lines.push(`\nAlready current: ${plan.unchanged.join(", ")}`);
  if (plan.disagreed.length) {
    lines.push(`\nThe manifest and the stylesheet disagree (${plan.disagreed.length}). ${took ? "The stylesheet was taken (--force):" : "The manifest was kept; --force takes the stylesheet:"}`);
    for (const d of plan.disagreed) lines.push(`  ${d}`);
  }
  if (d.report.skipped.length) {
    lines.push(`\nSkipped (${d.report.skipped.length}):`);
    for (const s of d.report.skipped) lines.push(`  ${s}`);
  }
  const changes = plan.added.length + plan.changed.length;
  lines.push("");
  lines.push(changes === 0 ? "The manifest already describes this source." : write ? `Wrote ${changes} ${changes === 1 ? "entry" : "entries"} to components.json.` : `${changes} ${changes === 1 ? "entry" : "entries"} to write. Run again with --write.`);
  return lines.join("\n");
}

/** A controlling prop, or several, or none, as one readable phrase. */
function show(v: string | string[] | null | undefined): string {
  if (v === null || v === undefined) return "null";
  return Array.isArray(v) ? v.join(" and ") : v;
}
