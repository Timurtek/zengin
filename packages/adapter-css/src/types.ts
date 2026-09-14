import { parse } from "@babel/parser";
import type { ComponentManifest } from "@zenginui/engine";

/**
 * A component manifest from a package's type declarations. A component is a `declare function X(props: XProps)`
 * or a `declare const X: ForwardRefExoticComponent<...>`; what it takes comes from the props type, which is an
 * interface, a type alias, or the parameter's own literal type; which enum values `variant` and `size` accept
 * comes from the `tailwind-variants` or `cva` constant named for the component. Prop kinds come from the
 * TypeScript types. `HTMLAttributes<HTMLButtonElement>` in the props chain says which element's attributes
 * pass through.
 */

export type Node = { type: string; [k: string]: unknown };

export const HTML_TAGS = new Set(["button", "table", "select", "textarea", "input", "form", "label", "dialog", "progress", "hr", "img", "a", "nav", "ul", "ol", "li", "p", "span", "code", "pre", "details", "summary", "menu"]);
export const PLACEMENT = ["margin", "width", "height", "flex-item", "grid-item", "position", "display", "overflow"];
export const SKIP_PROPS = new Set(["className", "children", "style", "ref", "key"]);

export interface TypesDerivation {
  components: ComponentManifest[];
  report: { components: number; withVariants: number; skipped: string[] };
}

/** Everything a props walker needs from a parsed module: the types it can open, and what came from where. */
export interface Declarations {
  /** component name -> its props type node (parameter annotation or const type) */
  functions: Map<string, Node | undefined>;
  interfaces: Map<string, Node>;
  aliases: Map<string, Node>;
  /** camel const name -> { variant: [...], size: [...] } */
  variants: Map<string, Record<string, string[]>>;
  exported: Set<string>;
  /** local name -> `source#imported` */
  imports: Map<string, string>;
}

export function emptyDeclarations(): Declarations {
  return { functions: new Map(), interfaces: new Map(), aliases: new Map(), variants: new Map(), exported: new Set(), imports: new Map() };
}

/** Reads one module's top-level declarations into `decls`. Call it per file to scan a whole directory. */
export function scanDeclarations(body: Node[], decls: Declarations = emptyDeclarations()): Declarations {
  const { functions, interfaces, aliases, variants, exported, imports } = decls;
  for (const node of body) {
    if (node.type === "ImportDeclaration") {
      const source = String((node["source"] as Node)["value"]);
      for (const sp of (node["specifiers"] as Node[]) ?? []) {
        const local = idName(sp["local"]);
        const imported = sp.type === "ImportSpecifier" ? idName(sp["imported"]) : sp.type === "ImportDefaultSpecifier" ? "default" : "*";
        if (local) imports.set(local, `${source}#${imported}`);
      }
    }
    if (node.type === "TSDeclareFunction" && isPascal(idName(node["id"]))) {
      const first = (node["params"] as Node[] | undefined)?.[0];
      functions.set(idName(node["id"]), (first?.["typeAnnotation"] as Node | undefined)?.["typeAnnotation"] as Node | undefined);
    }
    if (node.type === "TSInterfaceDeclaration") interfaces.set(idName(node["id"]), node);
    if (node.type === "TSTypeAliasDeclaration") aliases.set(idName(node["id"]), node["typeAnnotation"] as Node);
    if (node.type === "VariableDeclaration") {
      for (const d of node["declarations"] as Node[]) {
        const name = idName(d["id"]);
        const ann = ((d["id"] as Node)["typeAnnotation"] as Node | undefined)?.["typeAnnotation"] as Node | undefined;
        const map = variantMap(ann);
        if (map) variants.set(name, map);
        else if (isPascal(name) && ann && isComponentType(ann)) functions.set(name, componentPropsType(ann));
      }
    }
    if (node.type === "ExportNamedDeclaration") for (const s of (node["specifiers"] as Node[]) ?? []) exported.add(idName(s["exported"]));
  }
  return decls;
}

export type Info = { members: Node[]; extends?: string; found: boolean; variants: Record<string, string[]>; passthrough: string[] };

export function emptyInfo(): Info {
  return { members: [], found: false, variants: {}, passthrough: [] };
}

/**
   * Walks a props type: interface members, alias bodies, intersections and literals. Records the element whose
   * attributes pass through, the variant maps reached through `VariantProps<typeof x>`, and the types it cannot
   * open (imported from another package): those become the manifest's `passthrough`.
   */
export function makeCollector(decls: Declarations, opts: { strictElements?: boolean } = {}): (t: Node | undefined, seen: Set<string>, into: Info) => void {
  const { interfaces, aliases, variants, imports } = decls;
  const collect = (t: Node | undefined, seen: Set<string>, into: Info): void => {
    if (!t) return;
    if (t.type === "TSTypeLiteral") {
      into.found = true;
      into.members.push(...(t["members"] as Node[]));
    } else if (t.type === "TSIntersectionType") {
      for (const p of t["types"] as Node[]) collect(p, seen, into);
    } else if (t.type === "TSTypeReference") {
      const name = refName(t["typeName"] as Node);
      const args = ((t["typeArguments"] ?? t["typeParameters"]) as Node | undefined)?.["params"] as Node[] | undefined;
      if ((t["typeName"] as Node).type === "TSQualifiedName" && !isReactNamespace(t["typeName"] as Node, imports)) {
        // `ProgressRoot.Props`, `Popover$1.Positioner.Props`: a namespace path, which only an import provides here.
        // `react.RefAttributes<T>` is the exception: React's own helpers are read by their last segment below.
        into.found = true;
        const q = qualifiedName(t["typeName"] as Node, imports);
        if (q) into.passthrough.push(q);
        return;
      }
      if (name === "Omit" || name === "Partial" || name === "Pick" || name === "Readonly" || name === "Required") return collect(args?.[0], seen, into);
      if (name === "VariantProps") {
        const q = args?.[0];
        const target = q?.type === "TSTypeQuery" ? idName(q["exprName"]) : "";
        const map = variants.get(target);
        if (map) {
          into.found = true;
          Object.assign(into.variants, map);
        }
        return;
      }
      const el = elementOf(name, args, opts.strictElements);
      if (el) {
        into.found = true;
        into.extends ??= el;
        return;
      }
      if (opts.strictElements && /^([A-Z][A-Za-z]*?)?HTMLAttributes$|^(ComponentProps|ComponentPropsWithoutRef|ComponentPropsWithRef|HTMLProps)$/.test(name)) {
        // The props are real and pass through; which element renders them is not stated here.
        into.found = true;
        return;
      }
      if (/^(RefAttributes|PropsWithChildren|PropsWithoutRef|Attributes|ClassAttributes)$/.test(name)) {
        if (name === "PropsWithChildren" || name === "PropsWithoutRef") collect(args?.[0], seen, into);
        return;
      }
      if (seen.has(name)) return;
      seen.add(name);
      const iface = interfaces.get(name);
      if (iface) {
        into.found = true;
        into.members.push(...((iface["body"] as Node)["body"] as Node[]));
        for (const e of (iface["extends"] as Node[] | undefined) ?? []) {
          collect({ type: "TSTypeReference", typeName: toEntityName(e["expression"] as Node), typeArguments: e["typeArguments"] ?? e["typeParameters"] } as Node, seen, into);
        }
        return;
      }
      const alias = aliases.get(name);
      if (alias) return collect(alias, seen, into);
      // Declared elsewhere: a Base UI, Radix or react-hook-form type. Its props are real and unknowable here.
      into.found = true;
      const q = qualifiedName(t["typeName"] as Node, imports);
      if (q) into.passthrough.push(q);
    }
  };

  return collect;
}

export function deriveManifestFromTypes(dts: string, opts: { importFrom: string; version?: string; only?: string[] }): TypesDerivation {
  const ast = parse(dts, { sourceType: "module", plugins: [["typescript", { dts: true }]], errorRecovery: true }) as unknown as { program: { body: Node[] } };
  const decls = scanDeclarations(ast.program.body.map(unwrap));
  const { functions, variants, exported } = decls;
  const collect = makeCollector(decls);

  const components: ComponentManifest[] = [];
  const skipped: string[] = [];
  let withVariants = 0;
  const names = [...functions.keys()].filter((n) => (exported.size === 0 || exported.has(n)) && (!opts.only || opts.only.includes(n))).sort();
  for (const name of names) {
    const props: NonNullable<ComponentManifest["props"]> = {};
    const info: Info = emptyInfo();
    const paramType = functions.get(name);
    collect(paramType ?? { type: "TSTypeReference", typeName: { type: "Identifier", name: `${name}Props` } }, new Set(), info);
    if (!paramType && !info.found) collect({ type: "TSTypeReference", typeName: { type: "Identifier", name: `${name}Props` } }, new Set(), info);
    for (const m of info.members) {
      if (m.type !== "TSPropertySignature") continue;
      const key = idName(m["key"]);
      if (!key || SKIP_PROPS.has(key) || key in props) continue;
      const kind = propKind((m["typeAnnotation"] as Node | undefined)?.["typeAnnotation"] as Node | undefined);
      if (kind) props[key] = kind;
    }
    const camel = name.charAt(0).toLowerCase() + name.slice(1);
    const v = variants.get(camel) ?? (Object.keys(info.variants).length ? info.variants : undefined);
    if (v) {
      withVariants++;
      for (const [prop, values] of Object.entries(v)) props[prop] = { type: "enum", values, ...(values.includes("default") ? { default: "default" } : {}) };
    }
    if (!info.found && !v) {
      skipped.push(`${name}: no props type found`);
      continue;
    }
    const owns: Record<string, string | null> = {};
    if (v?.["variant"]) Object.assign(owns, { "background-color": "variant", color: "variant", "border-color": "variant" });
    if (v?.["size"]) Object.assign(owns, { padding: "size", font: "size" });
    const lower = name.toLowerCase();
    const ext = HTML_TAGS.has(lower) ? lower : info.extends;
    components.push({
      name,
      since: opts.version ?? "0.0.0",
      export: { from: opts.importFrom, name },
      replaces: HTML_TAGS.has(lower) ? [lower] : [],
      ...(ext ? { extends: ext } : {}),
      props,
      className: { allow: PLACEMENT },
      owns,
      states: ["default"],
      ...(info.passthrough.length ? { passthrough: [...new Set(info.passthrough)] } : {}),
    } as ComponentManifest);
  }
  return { components, report: { components: components.length, withVariants, skipped } };
}

/** `declare const button: TVReturnType<{ variant: { a: ...; b: ... }; size: {...} }, ...>` to `{ variant: [a, b], size: [...] }`. */
export function variantMap(ann: Node | undefined): Record<string, string[]> | undefined {
  if (!ann || ann.type !== "TSTypeReference") return undefined;
  const name = refName(ann["typeName"] as Node);
  if (!/^(TVReturnType|VariantProps)$/.test(name)) return undefined;
  const params = ((ann["typeArguments"] ?? ann["typeParameters"]) as Node | undefined)?.["params"] as Node[] | undefined;
  const first = params?.[0];
  if (!first || first.type !== "TSTypeLiteral") return undefined;
  const out: Record<string, string[]> = {};
  for (const m of first["members"] as Node[]) {
    if (m.type !== "TSPropertySignature") continue;
    const inner = (m["typeAnnotation"] as Node | undefined)?.["typeAnnotation"] as Node | undefined;
    if (!inner || inner.type !== "TSTypeLiteral") continue;
    const values = (inner["members"] as Node[]).filter((x) => x.type === "TSPropertySignature").map((x) => idName(x["key"]));
    if (values.length) out[idName(m["key"])] = values;
  }
  return Object.keys(out).length ? out : undefined;
}

/**
 * The manifest kind for a prop's type. `resolve` opens a named type alias, which is how source declares an
 * enum: `variant?: ButtonVariant` where `ButtonVariant = "solid" | "soft"`. A `.d.ts` usually inlines the
 * union or carries it on a variant function, so the package path passes no resolver and behaves as before.
 */
export function propKind(
  t: Node | undefined,
  resolve?: (name: string) => Node | undefined,
  seen: Set<string> = new Set(),
): NonNullable<ComponentManifest["props"]>[string] | undefined {
  if (!t) return undefined;
  switch (t.type) {
    case "TSBooleanKeyword":
      return { type: "boolean" };
    case "TSStringKeyword":
      return { type: "string" };
    case "TSNumberKeyword":
      return { type: "number" };
    case "TSFunctionType":
      return { type: "function" };
    case "TSLiteralType":
      return typeof (t["literal"] as Node)["value"] === "string" ? { type: "enum", values: [String((t["literal"] as Node)["value"])] } : { type: "string" };
    case "TSUnionType": {
      const parts = t["types"] as Node[];
      const literals = parts.filter((p) => p.type === "TSLiteralType" && typeof (p["literal"] as Node)["value"] === "string").map((p) => String((p["literal"] as Node)["value"]));
      const rest = parts.filter((p) => p.type !== "TSLiteralType" && p.type !== "TSUndefinedKeyword" && p.type !== "TSNullKeyword");
      if (literals.length && rest.length === 0) return { type: "enum", values: literals };
      if (parts.some((p) => p.type === "TSBooleanKeyword") && rest.every((p) => p.type === "TSBooleanKeyword")) return { type: "boolean" };
      if (resolve && rest.length > 1) {
        // A union of aliases, each a union of literals: `Side | Align`. Opening them keeps the enum whole.
        const opened = rest.map((p) => propKind(p, resolve, seen));
        if (opened.every((o) => o?.type === "enum")) return { type: "enum", values: [...new Set(opened.flatMap((o) => o!.values ?? []))] };
      }
      return rest.length === 1 ? propKind(rest[0], resolve, seen) : { type: "node" };
    }
    case "TSTypeReference": {
      const name = refName(t["typeName"] as Node);
      if (/^(Date)$/.test(name)) return { type: "string" };
      if (resolve && name && !seen.has(name)) {
        const alias = resolve(name);
        if (alias) {
          seen.add(name);
          return propKind(alias, resolve, seen);
        }
      }
      return { type: "node" };
    }
    default:
      return { type: "node" };
  }
}

export function isComponentType(ann: Node): boolean {
  if (ann.type === "TSTypeReference") return /^(FC|FunctionComponent|ForwardRefExoticComponent|ComponentType|MemoExoticComponent|NamedExoticComponent)$/.test(refName(ann["typeName"] as Node));
  return ann.type === "TSFunctionType";
}

/** The props type of a `ForwardRefExoticComponent<P>` or `FC<P>`; a function type's first parameter. */
export function componentPropsType(ann: Node): Node | undefined {
  if (ann.type === "TSTypeReference") return (((ann["typeArguments"] ?? ann["typeParameters"]) as Node | undefined)?.["params"] as Node[] | undefined)?.[0];
  if (ann.type === "TSFunctionType") {
    const first = ((ann["params"] ?? ann["parameters"]) as Node[] | undefined)?.[0];
    return (first?.["typeAnnotation"] as Node | undefined)?.["typeAnnotation"] as Node | undefined;
  }
  return undefined;
}

/**
 * `HTMLAttributes<HTMLButtonElement>` -> `button`; `ComponentProps<"div">` -> `div`; `ButtonHTMLAttributes<...>`
 * -> `button`.
 *
 * With `strict`, a shape that names no element at all reports nothing instead of falling back to `div`.
 * `ComponentPropsWithoutRef<typeof RadixSeparator.Root>` says which component's props pass through and not
 * which element renders, and guessing `div` there is only right by luck. The package path keeps the guess,
 * because a manifest derived from a stranger's `.d.ts` is better off with a likely answer than none; reading
 * a project's own source, a wrong `extends` quietly widens what `unknown-prop` accepts.
 */
export function elementOf(name: string, args: Node[] | undefined, strict = false): string | undefined {
  const m = /^([A-Z][A-Za-z]*?)?HTMLAttributes$/.exec(name);
  if (m) {
    const arg = args?.[0];
    const el = arg && arg.type === "TSTypeReference" ? /^HTML([A-Za-z]*)Element$/.exec(refName(arg["typeName"] as Node))?.[1] : undefined;
    const fromArg = el ? htmlTag(el) : undefined;
    const fromName = m[1] && m[1] !== "All" ? htmlTag(m[1]) : undefined;
    return fromArg ?? fromName ?? (strict ? undefined : "div");
  }
  if (/^(ComponentProps|ComponentPropsWithoutRef|ComponentPropsWithRef|HTMLProps)$/.test(name)) {
    const arg = args?.[0];
    if (arg?.type === "TSLiteralType" && typeof (arg["literal"] as Node)["value"] === "string") return String((arg["literal"] as Node)["value"]);
    return strict ? undefined : "div";
  }
  return undefined;
}

const ELEMENT_TAGS: Record<string, string> = { Anchor: "a", Paragraph: "p", Image: "img", TableSection: "tbody", TableRow: "tr", TableCell: "td", TableCaption: "caption", UList: "ul", OList: "ol", LI: "li", Heading: "h2", Quote: "blockquote", Mod: "ins", Div: "div", Span: "span", Button: "button", Input: "input", Select: "select", TextArea: "textarea", Label: "label", Form: "form", Table: "table", Dialog: "dialog", Progress: "progress", Nav: "nav", Details: "details", Menu: "menu", Pre: "pre", Code: "code", HR: "hr", Fieldset: "fieldset", Legend: "legend", Option: "option", Canvas: "canvas", Video: "video", Audio: "audio", Iframe: "iframe" };

function htmlTag(name: string): string | undefined {
  if (!name) return undefined;
  if (ELEMENT_TAGS[name]) return ELEMENT_TAGS[name];
  const lower = name.toLowerCase();
  return HTML_TAGS.has(lower) ? lower : undefined;
}

/** `react.X` when `import * as react from 'react'`: React's helpers, not a foreign component's props. */
function isReactNamespace(n: Node, imports: Map<string, string>): boolean {
  let cur: Node = n;
  while (cur.type === "TSQualifiedName") cur = cur["left"] as Node;
  return imports.get(idName(cur)) === "react#*";
}

/** Heritage clauses carry `A.B` as a MemberExpression; type positions carry it as a TSQualifiedName. One shape here. */
function toEntityName(n: Node): Node {
  if (n.type === "MemberExpression") return { type: "TSQualifiedName", left: toEntityName(n["object"] as Node), right: n["property"] } as Node;
  return n;
}

function refName(n: Node): string {
  return n.type === "TSQualifiedName" ? idName(n["right"]) : idName(n);
}

/** `Popover$1.Positioner.Props` with `import { Popover as Popover$1 } from '@base-ui/react/popover'` -> `@base-ui/react/popover#Popover.Positioner.Props`. */
function qualifiedName(n: Node, imports: Map<string, string>): string {
  const parts: string[] = [];
  let cur: Node | undefined = n;
  while (cur) {
    if (cur.type === "TSQualifiedName") {
      parts.unshift(idName(cur["right"]));
      cur = cur["left"] as Node;
    } else {
      parts.unshift(idName(cur));
      cur = undefined;
    }
  }
  if (!parts[0]) return "";
  const head = imports.get(parts[0]);
  const rest = parts.slice(1);
  if (head) return rest.length ? `${head}.${rest.join(".")}` : head;
  return parts.map((p) => p.replace(/\$\d+$/, "")).join(".");
}

export function unwrap(node: Node): Node {
  return node.type === "ExportNamedDeclaration" && node["declaration"] ? (node["declaration"] as Node) : node;
}

export function idName(n: unknown): string {
  const node = n as Node | undefined;
  if (!node) return "";
  if (typeof node["name"] === "string") return node["name"];
  if (node.type === "StringLiteral") return String(node["value"]);
  return "";
}

export function isPascal(name: string): boolean {
  return /^[A-Z][A-Za-z0-9]*$/.test(name);
}
